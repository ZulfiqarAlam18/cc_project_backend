const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const FACE_MATCH_SERVICE_URL = process.env.FACE_MATCH_SERVICE_URL || 'http://localhost:5001';

/**
 * Download image from URL to temporary file
 */
const downloadImage = async (imageUrl, tempPath) => {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 10000
    });
    
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
};

/**
 * Check if face matching service is available
 */
const checkServiceHealth = async () => {
  try {
    const response = await axios.get(`${FACE_MATCH_SERVICE_URL}/`, {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    console.error('Face matching service is not available:', error.message);
    return false;
  }
};

/**
 * Compare two face images using faceChecker1 service
 * @param {string} image1Url - URL of first image
 * @param {string} image2Url - URL of second image
 * @param {number} tolerance - Matching tolerance (default: 0.6, lower = stricter)
 * @returns {Object} Match result with confidence
 */
const compareTwoFaces = async (image1Url, image2Url, tolerance = 0.6) => {
  const tempDir = path.join(__dirname, '../../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const img1Path = path.join(tempDir, `temp_img1_${Date.now()}.jpg`);
  const img2Path = path.join(tempDir, `temp_img2_${Date.now()}.jpg`);
  
  try {
    // Download both images
    await downloadImage(image1Url, img1Path);
    await downloadImage(image2Url, img2Path);
    
    // Create form data
    const formData = new FormData();
    formData.append('img1', fs.createReadStream(img1Path));
    formData.append('img2', fs.createReadStream(img2Path));
    
    // Call faceChecker1 API
    const response = await axios.post(
      `${FACE_MATCH_SERVICE_URL}/face_match`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );
    
    // Calculate confidence from face_recognition distance
    // face_recognition returns match as boolean
    // We'll estimate confidence based on the match result
    const match = response.data.match;
    const confidence = match ? 95 : 30; // High confidence if match, low if not
    
    return {
      success: true,
      match: match,
      confidence: confidence,
      error: response.data.error
    };
  } catch (error) {
    console.error('Error comparing faces:', error.message);
    return {
      success: false,
      error: error.message,
      match: false,
      confidence: 0
    };
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(img1Path)) fs.unlinkSync(img1Path);
      if (fs.existsSync(img2Path)) fs.unlinkSync(img2Path);
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }
  }
};

/**
 * Compare one face against multiple faces
 * @param {string} sourceImageUrl - Source image URL
 * @param {Array<string>} targetImageUrls - Array of target image URLs
 * @param {number} tolerance - Matching tolerance (default: 0.6)
 * @param {number} minConfidence - Minimum confidence percentage (default: 85)
 * @returns {Object} Match results
 */
const compareMultipleFaces = async (
  sourceImageUrl,
  targetImageUrls,
  tolerance = 0.6,
  minConfidence = 85
) => {
  try {
    const matches = [];
    
    // Compare source image with each target image using faceChecker1
    for (let idx = 0; idx < targetImageUrls.length; idx++) {
      const targetImageUrl = targetImageUrls[idx];
      
      const result = await compareTwoFaces(sourceImageUrl, targetImageUrl, tolerance);
      
      if (result.success) {
        matches.push({
          index: idx,
          image_url: targetImageUrl,
          match: result.match && result.confidence >= minConfidence,
          confidence: result.confidence,
          error: result.error
        });
      } else {
        matches.push({
          index: idx,
          image_url: targetImageUrl,
          match: false,
          confidence: 0,
          error: result.error || 'Failed to compare'
        });
      }
    }
    
    // Filter and sort matches
    const validMatches = matches.filter(m => m.match);
    validMatches.sort((a, b) => b.confidence - a.confidence);
    
    return {
      success: true,
      source_has_face: true,
      total_compared: targetImageUrls.length,
      matches_found: validMatches.length,
      matches: validMatches,
      all_results: matches,
      tolerance,
      min_confidence: minConfidence
    };
  } catch (error) {
    console.error('Error comparing multiple faces:', error);
    return {
      success: false,
      error: error.message,
      matches: [],
      matches_found: 0
    };
  }
};

/**
 * Extract face encoding from an image (Not supported by faceChecker1, returns placeholder)
 * @param {string} imageUrl - Image URL
 * @returns {Object} Encoding data
 */
const extractFaceEncoding = async (imageUrl) => {
  return {
    success: false,
    error: 'Face encoding extraction not supported by faceChecker1',
    encoding: null
  };
};

/**
 * Compare parent report images against finder report images
 * @param {Array<Object>} parentImages - Parent report images with URLs
 * @param {Array<Object>} finderImages - Finder report images with URLs
 * @param {number} minConfidence - Minimum confidence for match (default: 85)
 * @returns {Object} Best match result
 */
const compareReportImages = async (parentImages, finderImages, minConfidence = 85) => {
  try {
    let bestMatch = {
      matched: false,
      confidence: 0,
      parentImageId: null,
      finderImageId: null,
      parentImageUrl: null,
      finderImageUrl: null
    };

    // Compare each parent image against all finder images
    for (const parentImage of parentImages) {
      const finderImageUrls = finderImages.map(img => img.imageUrl);
      
      const result = await compareMultipleFaces(
        parentImage.imageUrl,
        finderImageUrls,
        0.6,
        minConfidence
      );

      if (result.success && result.matches_found > 0) {
        // Get the best match from this comparison
        const topMatch = result.matches[0];
        
        if (topMatch.confidence > bestMatch.confidence) {
          const finderImage = finderImages[topMatch.index];
          
          bestMatch = {
            matched: true,
            confidence: topMatch.confidence,
            parentImageId: parentImage.id,
            finderImageId: finderImage.id,
            parentImageUrl: parentImage.imageUrl,
            finderImageUrl: finderImage.imageUrl,
            distance: topMatch.distance
          };
        }
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error comparing report images:', error);
    return {
      matched: false,
      confidence: 0,
      error: error.message
    };
  }
};

module.exports = {
  checkServiceHealth,
  compareTwoFaces,
  compareMultipleFaces,
  extractFaceEncoding,
  compareReportImages
};
