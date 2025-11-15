const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allow only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Generate unique filename
const generateFileName = (originalname) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = path.extname(originalname);
  return `${timestamp}-${randomString}${extension}`;
};

// S3 upload configuration
const uploadS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const fileName = generateFileName(file.originalname);
      const folder = req.uploadFolder || 'images'; // Default folder
      cb(null, `${folder}/${fileName}`);
    },
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  }),
  fileFilter: fileFilter
});

// Upload single file
const uploadSingle = (fieldName, folder = 'images') => {
  return (req, res, next) => {
    req.uploadFolder = folder;
    uploadS3.single(fieldName)(req, res, next);
  };
};

// Upload multiple files
const uploadMultiple = (fieldName, maxCount = 5, folder = 'images') => {
  return (req, res, next) => {
    req.uploadFolder = folder;
    uploadS3.array(fieldName, maxCount)(req, res, next);
  };
};

// Delete file from S3
const deleteFromS3 = async (fileKey) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey
    };

    await s3.deleteObject(params).promise();
    console.log(`File deleted from S3: ${fileKey}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};

// Get signed URL for private files
const getSignedUrl = (fileKey, expires = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
      Expires: expires
    };

    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
};

// Upload buffer to S3 (for processed images)
const uploadBuffer = async (buffer, fileName, contentType = 'image/jpeg', folder = 'processed') => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `${folder}/${fileName}`,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read'
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('Error uploading buffer to S3:', error);
    throw error;
  }
};

// List files in S3 bucket
const listFiles = async (prefix = '', maxKeys = 1000) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys
    };

    const result = await s3.listObjectsV2(params).promise();
    return result.Contents;
  } catch (error) {
    console.error('Error listing files from S3:', error);
    throw error;
  }
};

// Copy file within S3
const copyFile = async (sourceKey, destinationKey) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      CopySource: `${process.env.AWS_S3_BUCKET_NAME}/${sourceKey}`,
      Key: destinationKey
    };

    const result = await s3.copyObject(params).promise();
    return result;
  } catch (error) {
    console.error('Error copying file in S3:', error);
    throw error;
  }
};

// Get file metadata
const getFileMetadata = async (fileKey) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey
    };

    const result = await s3.headObject(params).promise();
    return result;
  } catch (error) {
    console.error('Error getting file metadata from S3:', error);
    throw error;
  }
};

// Check if file exists
const fileExists = async (fileKey) => {
  try {
    await getFileMetadata(fileKey);
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
};

// Generate presigned URL for uploads
const getPresignedUploadUrl = (fileKey, contentType = 'image/jpeg', expires = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Expires: expires
    };

    return s3.getSignedUrl('putObject', params);
  } catch (error) {
    console.error('Error generating presigned upload URL:', error);
    throw error;
  }
};

module.exports = {
  s3,
  uploadS3,
  uploadSingle,
  uploadMultiple,
  deleteFromS3,
  getSignedUrl,
  uploadBuffer,
  listFiles,
  copyFile,
  getFileMetadata,
  fileExists,
  getPresignedUploadUrl,
  generateFileName
};
