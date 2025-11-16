const axios = require('axios');

const FACE_MATCH_SERVICE_URL = process.env.FACE_MATCH_SERVICE_URL || 'http://localhost:5001';

/**
 * Check if face matching service is available
 */
const checkServiceHealth = async () => {
  try {
    const response = await axios.get(`${FACE_MATCH_SERVICE_URL}/health`, {
      timeout: 5000
    });
    return response.data.status === 'healthy';
  } catch (error) {
    console.error('Face matching service is not available:', error.message);
    return false;
  }
};

/**
 * Compare two face images
 * @param {string} image1Url - URL of first image
 * @param {string} image2Url - URL of second image
 * @param {number} tolerance - Matching tolerance (default: 0.6, lower = stricter)
 * @returns {Object} Match result with confidence
 */
const compareTwoFaces = async (image1Url, image2Url, tolerance = 0.6) => {
  try {
    const response = await axios.post(
      `${FACE_MATCH_SERVICE_URL}/compare-faces`,
      {
        image1: image1Url,
        image2: image2Url,
        tolerance
      },
      {
        timeout: 30000 // 30 seconds
      }
    );
    
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    console.error('Error comparing faces:', error.message);
    return {
      success: false,
      error: error.message,
      match: false,
      confidence: 0
    };
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
    const response = await axios.post(
      `${FACE_MATCH_SERVICE_URL}/compare-multiple`,
      {
        source_image: sourceImageUrl,
        target_images: targetImageUrls,
        tolerance,
        min_confidence: minConfidence
      },
      {
        timeout: 60000 // 60 seconds for multiple comparisons
      }
    );
    
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    console.error('Error comparing multiple faces:', error.message);
    return {
      success: false,
      error: error.message,
      matches: [],
      matches_found: 0
    };
  }
};

/**
 * Extract face encoding from an image
 * @param {string} imageUrl - Image URL
 * @returns {Object} Encoding data
 */
const extractFaceEncoding = async (imageUrl) => {
  try {
    const response = await axios.post(
      `${FACE_MATCH_SERVICE_URL}/extract-encoding`,
      {
        image: imageUrl
      },
      {
        timeout: 30000
      }
    );
    
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    console.error('Error extracting face encoding:', error.message);
    return {
      success: false,
      error: error.message,
      encoding: null
    };
  }
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
