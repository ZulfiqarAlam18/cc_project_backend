const redis = require('redis');
require('dotenv').config();

// Create Redis client
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
});

// Redis connection function
async function connectRedis() {
  try {
    await client.connect();
    console.log('✅ Connected to Redis successfully');
    
    // Test the connection
    await client.ping();
    console.log('✅ Redis ping test successful');
    
    return client;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
}

// Error handling
client.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

// Cache utility functions
const cache = {
  async set(key, value, expireInSeconds = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      await client.setEx(key, expireInSeconds, serializedValue);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  async get(key) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async del(key) {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  },

  async incr(key, expireInSeconds = 3600) {
    try {
      const result = await client.incr(key);
      if (result === 1) {
        await client.expire(key, expireInSeconds);
      }
      return result;
    } catch (error) {
      console.error('Cache incr error:', error);
      return null;
    }
  }
};

module.exports = {
  client,
  connectRedis,
  cache
};

