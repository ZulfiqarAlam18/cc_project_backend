const Bull = require('bull');
const { findMatches } = require('../services/caseService');
const { processImageForMatching } = require('../services/imageMatchingService');
const { prisma } = require('../config/db');
const { cache } = require('../config/redis');

// Create queue
const matchQueue = new Bull('match processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: 1 // Use different DB for Bull
  },
  defaultJobOptions: {
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Process image embeddings job
matchQueue.process('process-image-embeddings', 5, async (job) => {
  const { imageId, imageUrl } = job.data;
  
  try {
    console.log(`Processing image embeddings for image ${imageId}`);
    
    // Generate embeddings
    const embeddings = await processImageForMatching(imageUrl);
    
    // Update database with embeddings
    await prisma.caseImage.update({
      where: { id: imageId },
      data: {
        embeddings: JSON.stringify(embeddings),
        processed: true
      }
    });
    
    console.log(`Image embeddings processed successfully for image ${imageId}`);
    
    // Update progress
    job.progress(100);
    
    return { success: true, imageId, embeddingsLength: embeddings.length };
    
  } catch (error) {
    console.error(`Error processing image embeddings for image ${imageId}:`, error);
    throw error;
  }
});

// Find matches job
matchQueue.process('find-matches', 3, async (job) => {
  const { reportId, reportType } = job.data;
  
  try {
    console.log(`Finding matches for ${reportType} report ${reportId}`);
    
    const matches = await findMatches(reportId, reportType);
    
    console.log(`Found ${matches.length} matches for ${reportType} report ${reportId}`);
    
    // Update progress
    job.progress(100);
    
    return { success: true, reportId, reportType, matchCount: matches.length };
    
  } catch (error) {
    console.error(`Error finding matches for ${reportType} report ${reportId}:`, error);
    throw error;
  }
});

// Batch process images job
matchQueue.process('batch-process-images', 2, async (job) => {
  const { reportId, reportType, imageIds } = job.data;
  
  try {
    console.log(`Batch processing ${imageIds.length} images for ${reportType} report ${reportId}`);
    
    const total = imageIds.length;
    let processed = 0;
    
    for (const imageId of imageIds) {
      try {
        // Get image data
        const image = await prisma.caseImage.findUnique({
          where: { id: imageId },
          select: { imageUrl: true }
        });
        
        if (image) {
          // Process image
          const embeddings = await processImageForMatching(image.imageUrl);
          
          // Update database
          await prisma.caseImage.update({
            where: { id: imageId },
            data: {
              embeddings: JSON.stringify(embeddings),
              processed: true
            }
          });
        }
        
        processed++;
        
        // Update progress
        const progress = Math.round((processed / total) * 90); // Reserve 10% for match finding
        job.progress(progress);
        
      } catch (imageError) {
        console.error(`Error processing image ${imageId}:`, imageError);
        // Continue with other images
      }
    }
    
    // Now find matches
    job.progress(95);
    const matches = await findMatches(reportId, reportType);
    
    job.progress(100);
    
    return { 
      success: true, 
      reportId, 
      reportType, 
      processedImages: processed,
      matchCount: matches.length 
    };
    
  } catch (error) {
    console.error(`Error in batch processing for ${reportType} report ${reportId}:`, error);
    throw error;
  }
});

// Clean old processed data job
matchQueue.process('cleanup-old-data', 1, async (job) => {
  try {
    console.log('Starting cleanup of old processed data');
    
    const daysOld = job.data.daysOld || 30;
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    // Clean old notifications
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true
      }
    });
    
    // Clean old refresh tokens
    const deletedTokens = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    
    // Clear old cache entries
    await cache.flushdb();
    
    console.log(`Cleanup completed: ${deletedNotifications.count} notifications, ${deletedTokens.count} tokens`);
    
    return { 
      success: true, 
      deletedNotifications: deletedNotifications.count,
      deletedTokens: deletedTokens.count
    };
    
  } catch (error) {
    console.error('Error in cleanup job:', error);
    throw error;
  }
});

// Job event handlers
matchQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

matchQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

matchQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});

// Add jobs helper functions
const addImageProcessingJob = async (imageId, imageUrl, priority = 0) => {
  try {
    const job = await matchQueue.add('process-image-embeddings', {
      imageId,
      imageUrl
    }, {
      priority,
      delay: 1000 // Small delay to allow database transaction to complete
    });
    
    console.log(`Added image processing job ${job.id} for image ${imageId}`);
    return job;
    
  } catch (error) {
    console.error('Error adding image processing job:', error);
    throw error;
  }
};

const addMatchFindingJob = async (reportId, reportType, priority = 0) => {
  try {
    const job = await matchQueue.add('find-matches', {
      reportId,
      reportType
    }, {
      priority,
      delay: 5000 // Wait for image processing to complete
    });
    
    console.log(`Added match finding job ${job.id} for ${reportType} report ${reportId}`);
    return job;
    
  } catch (error) {
    console.error('Error adding match finding job:', error);
    throw error;
  }
};

const addBatchProcessingJob = async (reportId, reportType, imageIds, priority = 0) => {
  try {
    const job = await matchQueue.add('batch-process-images', {
      reportId,
      reportType,
      imageIds
    }, {
      priority,
      delay: 2000
    });
    
    console.log(`Added batch processing job ${job.id} for ${reportType} report ${reportId}`);
    return job;
    
  } catch (error) {
    console.error('Error adding batch processing job:', error);
    throw error;
  }
};

const addCleanupJob = async (daysOld = 30) => {
  try {
    const job = await matchQueue.add('cleanup-old-data', {
      daysOld
    }, {
      repeat: { cron: '0 2 * * *' }, // Run daily at 2 AM
      removeOnComplete: 1,
      removeOnFail: 1
    });
    
    console.log(`Added cleanup job ${job.id}`);
    return job;
    
  } catch (error) {
    console.error('Error adding cleanup job:', error);
    throw error;
  }
};

// Get queue statistics
const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      matchQueue.getWaiting(),
      matchQueue.getActive(),
      matchQueue.getCompleted(),
      matchQueue.getFailed(),
      matchQueue.getDelayed()
    ]);
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
    
  } catch (error) {
    console.error('Error getting queue stats:', error);
    throw error;
  }
};

// Initialize match queue
const initializeMatchQueue = async () => {
  try {
    console.log('Initializing match queue...');
    
    // Wait for queue to be ready
    await matchQueue.isReady();
    
    // Add recurring cleanup job
    await addCleanupJob();
    
    console.log('✅ Match queue initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize match queue:', error);
    throw error;
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    console.log('Shutting down match queue...');
    await matchQueue.close();
    console.log('Match queue shut down gracefully');
  } catch (error) {
    console.error('Error shutting down match queue:', error);
  }
};

module.exports = {
  matchQueue,
  addImageProcessingJob,
  addMatchFindingJob,
  addBatchProcessingJob,
  addCleanupJob,
  getQueueStats,
  initializeMatchQueue,
  gracefulShutdown
};
