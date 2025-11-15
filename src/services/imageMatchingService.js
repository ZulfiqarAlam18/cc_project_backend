const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const fetch = require('node-fetch');
const path = require('path');

// Setup face-api
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Load face recognition models
let modelsLoaded = false;

const loadModels = async () => {
  if (modelsLoaded) return;
  
  try {
    const modelPath = path.join(__dirname, '../models');
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
      faceapi.nets.faceExpressionNet.loadFromDisk(modelPath),
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath)
    ]);
    
    modelsLoaded = true;
    console.log('Face recognition models loaded successfully');
  } catch (error) {
    console.error('Error loading face recognition models:', error);
    // Fallback to a simpler approach if models fail to load
  }
};

/**
 * Process image and extract face embeddings
 * @param {string} imageUrl - URL or path to the image
 * @returns {Array} Face embeddings array
 */
const processImageForMatching = async (imageUrl) => {
  try {
    await loadModels();
    
    // Load image
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    
    // Create canvas and load image
    const img = new Image();
    img.src = buffer;
    
    // Wait for image to load
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    
    const canvas = new Canvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);
    
    if (!modelsLoaded) {
      // Fallback: Generate simple image hash/features
      return generateSimpleImageFeatures(buffer);
    }
    
    // Detect faces and extract embeddings
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    if (detections.length === 0) {
      console.log('No faces detected in image, using image features');
      return generateSimpleImageFeatures(buffer);
    }
    
    // Extract face descriptors (embeddings)
    const embeddings = detections.map(detection => 
      Array.from(detection.descriptor)
    );
    
    return embeddings[0] || []; // Return first face embedding
    
  } catch (error) {
    console.error('Error processing image for matching:', error);
    // Fallback to simple image features
    return generateSimpleImageFeatures(buffer);
  }
};

/**
 * Generate simple image features as fallback
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Array} Simple feature vector
 */
const generateSimpleImageFeatures = (imageBuffer) => {
  try {
    // Create a simple hash-based feature vector
    const features = [];
    
    // Use image size and basic byte analysis
    features.push(imageBuffer.length % 1000 / 1000); // Normalized size
    
    // Sample bytes at regular intervals
    for (let i = 0; i < 128; i++) {
      const index = Math.floor((i / 128) * imageBuffer.length);
      features.push(imageBuffer[index] / 255);
    }
    
    return features;
  } catch (error) {
    console.error('Error generating simple image features:', error);
    return new Array(128).fill(0); // Return zero vector as last resort
  }
};

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {Array} embedding1 - First embedding vector
 * @param {Array} embedding2 - Second embedding vector
 * @returns {number} Similarity score between 0 and 1
 */
const calculateSimilarity = (embedding1, embedding2) => {
  try {
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      return 0;
    }
    
    if (embedding1.length !== embedding2.length) {
      return 0;
    }
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    const similarity = dotProduct / (norm1 * norm2);
    
    // Convert to 0-1 range (cosine similarity ranges from -1 to 1)
    return Math.max(0, (similarity + 1) / 2);
    
  } catch (error) {
    console.error('Error calculating similarity:', error);
    return 0;
  }
};

/**
 * Batch process multiple images
 * @param {Array} imageUrls - Array of image URLs
 * @returns {Array} Array of embeddings
 */
const batchProcessImages = async (imageUrls) => {
  try {
    const embeddings = await Promise.all(
      imageUrls.map(url => processImageForMatching(url))
    );
    
    return embeddings;
  } catch (error) {
    console.error('Error in batch processing images:', error);
    throw error;
  }
};

/**
 * Find best matches for an image against a database of embeddings
 * @param {Array} queryEmbedding - Query image embedding
 * @param {Array} databaseEmbeddings - Array of {id, embedding} objects
 * @param {number} threshold - Minimum similarity threshold
 * @param {number} topK - Number of top matches to return
 * @returns {Array} Array of match objects with id and similarity score
 */
const findBestMatches = (queryEmbedding, databaseEmbeddings, threshold = 0.7, topK = 5) => {
  try {
    const matches = [];
    
    for (const dbItem of databaseEmbeddings) {
      const similarity = calculateSimilarity(queryEmbedding, dbItem.embedding);
      
      if (similarity >= threshold) {
        matches.push({
          id: dbItem.id,
          similarity: similarity,
          metadata: dbItem.metadata || {}
        });
      }
    }
    
    // Sort by similarity (descending) and return top K
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, topK);
    
  } catch (error) {
    console.error('Error finding best matches:', error);
    return [];
  }
};

/**
 * Validate and normalize embedding vector
 * @param {Array} embedding - Embedding vector to validate
 * @returns {Array} Normalized embedding vector
 */
const normalizeEmbedding = (embedding) => {
  try {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return new Array(128).fill(0); // Default size
    }
    
    // Calculate magnitude
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    
    if (magnitude === 0) {
      return embedding;
    }
    
    // Normalize to unit vector
    return embedding.map(val => val / magnitude);
    
  } catch (error) {
    console.error('Error normalizing embedding:', error);
    return embedding;
  }
};

/**
 * Compare two images directly and return similarity score
 * @param {string} imageUrl1 - First image URL
 * @param {string} imageUrl2 - Second image URL
 * @returns {number} Similarity score between 0 and 1
 */
const compareImages = async (imageUrl1, imageUrl2) => {
  try {
    const [embedding1, embedding2] = await Promise.all([
      processImageForMatching(imageUrl1),
      processImageForMatching(imageUrl2)
    ]);
    
    return calculateSimilarity(embedding1, embedding2);
    
  } catch (error) {
    console.error('Error comparing images:', error);
    return 0;
  }
};

/**
 * Legacy function for backward compatibility
 * @param {Array} newReportImages - New report images
 * @param {Array} existingReports - Existing reports to match against
 * @returns {Array} Array of matches
 */
const matchImages = async (newReportImages, existingReports) => {
  try {
    console.warn('matchImages function is deprecated, use findMatches from caseService instead');
    
    const matches = [];
    
    // Process new report images
    for (const imageFile of newReportImages) {
      const queryEmbedding = await processImageForMatching(imageFile.location || imageFile.path);
      
      // Compare against existing reports
      for (const existingReport of existingReports) {
        if (existingReport.caseImages && existingReport.caseImages.length > 0) {
          for (const existingImage of existingReport.caseImages) {
            if (existingImage.embeddings) {
              try {
                const existingEmbedding = JSON.parse(existingImage.embeddings);
                const similarity = calculateSimilarity(queryEmbedding, existingEmbedding);
                
                if (similarity > 0.7) {
                  matches.push({
                    reportId: existingReport.id,
                    similarity: similarity,
                    matchedImageId: existingImage.id
                  });
                }
              } catch (parseError) {
                console.error('Error parsing existing embedding:', parseError);
              }
            }
          }
        }
      }
    }
    
    // Sort by similarity and return top matches
    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
    
  } catch (error) {
    console.error('Error in matchImages:', error);
    return [];
  }
};

module.exports = {
  processImageForMatching,
  calculateSimilarity,
  batchProcessImages,
  findBestMatches,
  normalizeEmbedding,
  compareImages,
  matchImages, // Legacy function
  loadModels
};

