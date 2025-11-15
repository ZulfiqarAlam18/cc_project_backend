const Joi = require('joi');

// User validation schemas
const signupSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().trim(),
  email: Joi.string().email().required().trim().lowercase(),
  phone: Joi.string().pattern(/^(\+92|0)?[0-9]{10,11}$/).required().trim(), // Pakistani phone format
  password: Joi.string().min(6).max(128).required(), // Simplified password requirement
  role: Joi.string().valid('PARENT', 'FINDER', 'ADMIN').optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().required()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  newPassword: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
});

// Update profile validation schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional().trim(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().trim()
});

// Change password validation schema
const chanupdateProfileSchemagePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
});

// Delete account validation schema
const deleteAccountSchema = Joi.object({
  password: Joi.string().required(),
  confirmText: Joi.string().valid('DELETE').required()
});

// Update user (admin) validation schema
const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional().trim(),
  email: Joi.string().email().optional().trim().lowercase(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().trim(),
  role: Joi.string().valid('PARENT', 'FINDER', 'ADMIN', 'POLICE').optional(),
  isActive: Joi.boolean().optional(),
  isVerified: Joi.boolean().optional()
});

// Parent report validation schema
const parentReportSchema = Joi.object({
  childName: Joi.string().min(2).max(50).required().trim(),
  age: Joi.number().integer().min(0).max(18).required(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required().uppercase(),
  placeLost: Joi.string().min(5).max(200).required().trim(),
  lostTime: Joi.date().iso().max('now').required(),
  clothes: Joi.string().max(500).optional().trim(),
  additionalDetails: Joi.string().max(1000).optional().trim(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  locationName: Joi.string().max(100).optional().trim()
});

// Finder report validation schema
const finderReportSchema = Joi.object({
  childName: Joi.string().min(2).max(50).optional().trim(),
  age: Joi.number().integer().min(0).max(18).optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional().uppercase(),
  placeFound: Joi.string().min(5).max(200).required().trim(),
  foundTime: Joi.date().iso().max('now').required(),
  state: Joi.string().valid('ALIVE', 'INJURED', 'DEAD', 'UNKNOWN').required().uppercase(),
  clothes: Joi.string().max(500).optional().trim(),
  additionalDetails: Joi.string().max(1000).optional().trim(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  locationName: Joi.string().max(100).optional().trim(),
  // For backward compatibility with your current request format
  description: Joi.string().max(500).optional().trim(),
  estimatedAge: Joi.number().integer().min(0).max(18).optional(),
  clothingDescription: Joi.string().max(500).optional().trim(),
  physicalDescription: Joi.string().max(500).optional().trim(),
  contactInfo: Joi.string().max(200).optional().trim(),
  additionalInfo: Joi.string().max(1000).optional().trim()
});

// Validation middleware functions
const validateSignup = (data) => {
  return signupSchema.validate(data, { abortEarly: false });
};

const validateLogin = (data) => {
  return loginSchema.validate(data, { abortEarly: false });
};

const validateResetPassword = (data) => {
  return resetPasswordSchema.validate(data, { abortEarly: false });
};

const validateParentReport = (data) => {
  return parentReportSchema.validate(data, { abortEarly: false });
};

const validateFinderReport = (data) => {
  return finderReportSchema.validate(data, { abortEarly: false });
};

const validateUpdateProfile = (data) => {
  return updateProfileSchema.validate(data, { abortEarly: false });
};

const validateChangePassword = (data) => {
  return changePasswordSchema.validate(data, { abortEarly: false });
};

const validateDeleteAccount = (data) => {
  return deleteAccountSchema.validate(data, { abortEarly: false });
};

const validateUpdateUser = (data) => {
  return updateUserSchema.validate(data, { abortEarly: false });
};

// Express middleware wrapper
const createValidationMiddleware = (validationFunction) => {
  return (req, res, next) => {
    const { error } = validationFunction(req.body);
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errorMessages
      });
    }
    
    next();
  };
};

module.exports = {
  validateSignup,
  validateLogin,
  validateResetPassword,
  validateParentReport,
  validateFinderReport,
  validateUpdateProfile,
  validateChangePassword,
  validateDeleteAccount,
  validateUpdateUser,
  signupValidation: createValidationMiddleware(validateSignup),
  loginValidation: createValidationMiddleware(validateLogin),
  resetPasswordValidation: createValidationMiddleware(validateResetPassword),
  parentReportValidation: createValidationMiddleware(validateParentReport),
  finderReportValidation: createValidationMiddleware(validateFinderReport),
  updateProfileValidation: createValidationMiddleware(validateUpdateProfile),
  changePasswordValidation: createValidationMiddleware(validateChangePassword),
  deleteAccountValidation: createValidationMiddleware(validateDeleteAccount),
  updateUserValidation: createValidationMiddleware(validateUpdateUser)
};
