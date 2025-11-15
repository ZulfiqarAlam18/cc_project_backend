// Debug script to identify undefined functions
try {
  console.log('Checking parentReportController...');
  const controller = require('./src/controllers/parentReportController');
  console.log('Available functions:', Object.keys(controller));
  
  console.log('Checking middleware...');
  const { authenticate } = require('./src/middleware/authMiddleware');
  console.log('authenticate:', typeof authenticate);
  
  const { uploadCaseImages } = require('./src/middleware/uploadMiddleware');
  console.log('uploadCaseImages:', typeof uploadCaseImages);
  
  const { validateCreateParentReport, validateUpdateParentReport } = require('./src/middleware/validateMiddleware');
  console.log('validateCreateParentReport:', typeof validateCreateParentReport);
  console.log('validateUpdateParentReport:', typeof validateUpdateParentReport);
  
} catch (error) {
  console.error('Error in debug:', error.message);
}