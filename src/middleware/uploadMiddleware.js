// AWS S3 Upload (commented out for now)
// const { uploadSingle: s3UploadSingle, uploadMultiple: s3UploadMultiple } = require('../config/awsS3');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for local storage
const localStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = req.uploadFolder || 'images';
    const folderPath = path.join(uploadsDir, folder);
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Middleware for single file upload to local storage
const uploadSingle = (fieldName, folder = 'images') => {
  return (req, res, next) => {
    req.uploadFolder = folder;
    
    const upload = multer({
      storage: localStorage,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
      },
      fileFilter: imageFilter
    }).single(fieldName);
    
    upload(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        
        if (err.message === 'Only image files are allowed!') {
          return res.status(400).json({
            success: false,
            message: 'Only image files are allowed'
          });
        }
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB'
          });
        }
        
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: err.message
        });
      }
      
      // Add file URL for local storage
      if (req.file) {
        req.file.location = `/uploads/${folder}/${req.file.filename}`;
        req.file.url = `${req.protocol}://${req.get('host')}${req.file.location}`;
      }
      
      next();
    });
  };
};

/* AWS S3 Upload Single (commented out)
const uploadSingle = (fieldName, folder = 'images') => {
  return (req, res, next) => {
    const upload = s3UploadSingle(fieldName, folder);
    
    upload(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        
        if (err.message === 'Only image files are allowed!') {
          return res.status(400).json({
            success: false,
            message: 'Only image files are allowed'
          });
        }
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB'
          });
        }
        
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: err.message
        });
      }
      
      next();
    });
  };
};
*/

// Middleware for multiple file upload to local storage
const uploadMultiple = (fieldName, maxCount = 5, folder = 'images') => {
  return (req, res, next) => {
    req.uploadFolder = folder;
    
    const upload = multer({
      storage: localStorage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: maxCount
      },
      fileFilter: imageFilter
    }).array(fieldName, maxCount);
    
    upload(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        
        if (err.message === 'Only image files are allowed!') {
          return res.status(400).json({
            success: false,
            message: 'Only image files are allowed'
          });
        }
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB per file'
          });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Too many files. Maximum ${maxCount} files allowed`
          });
        }
        
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected file field'
          });
        }
        
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: err.message
        });
      }
      
      // Validate that files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one image file is required'
        });
      }
      
      // Add file URLs for local storage
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          file.location = `/uploads/${folder}/${file.filename}`;
          file.url = `${req.protocol}://${req.get('host')}${file.location}`;
        });
      }
      
      next();
    });
  };
};

/* AWS S3 Upload Multiple (commented out)
// Middleware for multiple file upload to S3
const uploadMultiple = (fieldName, maxCount = 5, folder = 'images') => {
  return (req, res, next) => {
    const upload = s3UploadMultiple(fieldName, maxCount, folder);
    
    upload(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        
        if (err.message === 'Only image files are allowed!') {
          return res.status(400).json({
            success: false,
            message: 'Only image files are allowed'
          });
        }
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB per file'
          });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Too many files. Maximum ${maxCount} files allowed`
          });
        }
        
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected file field'
          });
        }
        
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: err.message
        });
      }
      
      // Validate that files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one image file is required'
        });
      }
      
      next();
    });
  };
};
*/

// Error handling middleware for upload errors
const handleUploadError = (err, req, res, next) => {
  console.error('Upload middleware error:', err);
  
  if (err.message.includes('image')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid image file'
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB per file'
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Too many files uploaded'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'File upload error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
};

// Validate uploaded files middleware
const validateFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one image file is required'
    });
  }

  // Additional validation for each file
  for (const file of req.files) {
    // Check if file was uploaded successfully (local storage)
    if (!file.path && !file.location) {
      return res.status(400).json({
        success: false,
        message: 'File upload failed'
      });
    }

    // Check file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPEG and PNG files are allowed'
      });
    }
  }

  next();
};

/* AWS S3 Validate Files (commented out)
// Validate uploaded files middleware
const validateFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one image file is required'
    });
  }

  // Additional validation for each file
  for (const file of req.files) {
    // Check if file was uploaded to S3 successfully
    if (!file.location) {
      return res.status(400).json({
        success: false,
        message: 'File upload to cloud storage failed'
      });
    }

    // Check file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPEG and PNG files are allowed'
      });
    }
  }

  next();
};
*/

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  validateFiles
};
