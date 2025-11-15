const { prisma } = require('../config/db');
const admin = require('firebase-admin');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (!firebaseInitialized && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      
      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized');
    } catch (error) {
      console.error('Error initializing Firebase:', error);
    }
  }
};

// Initialize Twilio
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Initialize Nodemailer
let emailTransporter = null;
if (process.env.EMAIL_HOST) {
  emailTransporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
}

/**
 * Send notification to a user
 * @param {Object} params - Notification parameters
 * @param {string} params.userId - User ID (null for admin notifications)
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.type - Notification type
 * @param {Object} params.data - Additional data
 * @param {Array} params.channels - Channels to send to ['push', 'email', 'sms']
 */
const sendNotification = async ({
  userId,
  title,
  message,
  type = 'GENERAL',
  data = {},
  channels = ['push']
}) => {
  try {
    // Store notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: type.toUpperCase(),
        data: JSON.stringify(data),
        isRead: false
      }
    });

    // If userId is null, this is an admin notification
    if (!userId) {
      console.log(`Admin notification: ${title} - ${message}`);
      return notification;
    }

    // Get user preferences and contact info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        fcmToken: true
      }
    });

    if (!user) {
      console.error('User not found for notification:', userId);
      return notification;
    }

    // Parse user preferences
    // Default preferences (since notificationPreferences field doesn't exist)
    const preferences = {
      email: true,
      push: true,
      sms: false,
      types: {
        MATCH_FOUND: true,
        MATCH_CONFIRMED: true,
        STATUS_UPDATE: true,
        ADMIN_ALERT: true,
        GENERAL: true
      }
    };

    // Check if user wants this type of notification
    if (preferences.types[type] === false) {
      console.log(`User ${userId} has disabled ${type} notifications`);
      return notification;
    }

    // Send push notification
    if (channels.includes('push') && preferences.push && user.fcmToken) {
      await sendPushNotification(user.fcmToken, title, message, data);
    }

    // Send email notification
    if (channels.includes('email') && preferences.email && user.email) {
      await sendEmailNotification(user.email, title, message, data);
    }

    // Send SMS notification
    if (channels.includes('sms') && preferences.sms && user.phone) {
      await sendSMSNotification(user.phone, title, message);
    }

    return notification;

  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Send push notification via Firebase Cloud Messaging
 * @param {string} fcmToken - FCM token
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Additional data
 */
const sendPushNotification = async (fcmToken, title, message, data = {}) => {
  try {
    if (!firebaseInitialized) {
      initializeFirebase();
    }

    if (!firebaseInitialized) {
      console.log('Firebase not initialized, skipping push notification');
      return;
    }

    const payload = {
      notification: {
        title,
        body: message
      },
      data: {
        ...data,
        type: data.type || 'general',
        timestamp: new Date().toISOString()
      },
      token: fcmToken
    };

    const response = await admin.messaging().send(payload);
    console.log('Push notification sent successfully:', response);

  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // If token is invalid, remove it from user
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      await prisma.user.updateMany({
        where: { fcmToken },
        data: { fcmToken: null }
      });
    }
  }
};

/**
 * Send email notification
 * @param {string} email - Recipient email
 * @param {string} title - Email subject
 * @param {string} message - Email body
 * @param {Object} data - Additional data
 */
const sendEmailNotification = async (email, title, message, data = {}) => {
  try {
    if (!emailTransporter) {
      console.log('Email transporter not configured, skipping email notification');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: title,
      html: generateEmailTemplate(title, message, data)
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);

  } catch (error) {
    console.error('Error sending email notification:', error);
  }
};

/**
 * Send SMS notification via Twilio
 * @param {string} phone - Recipient phone number
 * @param {string} title - SMS title
 * @param {string} message - SMS message
 */
const sendSMSNotification = async (phone, title, message) => {
  try {
    if (!twilioClient) {
      console.log('Twilio not configured, skipping SMS notification');
      return;
    }

    const smsBody = `${title}\n\n${message}`;

    const result = await twilioClient.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });

    console.log('SMS sent successfully:', result.sid);

  } catch (error) {
    console.error('Error sending SMS notification:', error);
  }
};

/**
 * Send bulk notifications to multiple users
 * @param {Object} params - Bulk notification parameters
 * @param {Array} params.userIds - Array of user IDs
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.type - Notification type
 * @param {Object} params.data - Additional data
 * @param {Array} params.channels - Channels to send to
 */
const sendBulkNotification = async ({
  userIds,
  title,
  message,
  type = 'GENERAL',
  data = {},
  channels = ['push']
}) => {
  try {
    const results = [];
    const batchSize = 50; // Process in batches to avoid overwhelming the system

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(userId =>
        sendNotification({
          userId,
          title,
          message,
          type,
          data,
          channels
        }).catch(error => {
          console.error(`Error sending notification to user ${userId}:`, error);
          return { error: error.message, userId };
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Bulk notification sent to ${userIds.length} users`);
    return results;

  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
};

/**
 * Generate HTML email template
 * @param {string} title - Email title
 * @param {string} message - Email message
 * @param {Object} data - Additional data
 * @returns {string} HTML email content
 */
const generateEmailTemplate = (title, message, data = {}) => {
  const appName = process.env.APP_NAME || 'LocateLost';
  const appUrl = process.env.APP_URL || 'https://locatelost.app';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${appName}</h1>
            </div>
            <div class="content">
                <h2>${title}</h2>
                <p>${message}</p>
                ${data.actionUrl ? `<p><a href="${data.actionUrl}" class="button">View Details</a></p>` : ''}
            </div>
            <div class="footer">
                <p>This email was sent from ${appName}. If you no longer wish to receive these emails, you can update your notification preferences in the app.</p>
                <p><a href="${appUrl}">Visit ${appName}</a></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Update user's FCM token
 * @param {string} userId - User ID
 * @param {string} fcmToken - New FCM token
 */
const updateFCMToken = async (userId, fcmToken) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken }
    });

    console.log(`FCM token updated for user ${userId}`);
  } catch (error) {
    console.error('Error updating FCM token:', error);
    throw error;
  }
};

/**
 * Send emergency alert to nearby users
 * @param {Object} params - Emergency alert parameters
 * @param {string} params.location - Location of emergency
 * @param {string} params.title - Alert title
 * @param {string} params.message - Alert message
 * @param {number} params.radius - Alert radius in km
 */
const sendEmergencyAlert = async ({ location, title, message, radius = 10 }) => {
  try {
    // For now, send to all active users
    // In the future, this could be enhanced with geolocation-based filtering
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        fcmToken: { not: null }
      },
      select: { id: true }
    });

    await sendBulkNotification({
      userIds: activeUsers.map(u => u.id),
      title,
      message,
      type: 'EMERGENCY_ALERT',
      data: { location, radius },
      channels: ['push', 'sms']
    });

    console.log(`Emergency alert sent to ${activeUsers.length} users`);
  } catch (error) {
    console.error('Error sending emergency alert:', error);
    throw error;
  }
};

module.exports = {
  sendNotification,
  sendBulkNotification,
  sendPushNotification,
  sendEmailNotification,
  sendSMSNotification,
  updateFCMToken,
  sendEmergencyAlert,
  initializeFirebase
};
