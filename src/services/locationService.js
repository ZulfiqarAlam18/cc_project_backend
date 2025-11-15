const { prisma } = require('../config/db');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

/**
 * Convert degrees to radians
 * @param {number} degrees - Degrees to convert
 * @returns {number} Radians
 */
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Geocode an address to coordinates (placeholder implementation)
 * @param {string} address - Address to geocode
 * @returns {Object} Coordinates object with lat and lng
 */
const geocodeAddress = async (address) => {
  try {
    // In a real implementation, you would use a geocoding service like Google Maps API
    // For now, return mock coordinates
    console.log(`Geocoding address: ${address}`);
    
    // Mock coordinates for common Pakistani cities
    const mockCoordinates = {
      'karachi': { lat: 24.8607, lng: 67.0011 },
      'lahore': { lat: 31.5204, lng: 74.3587 },
      'islamabad': { lat: 33.6844, lng: 73.0479 },
      'rawalpindi': { lat: 33.5651, lng: 73.0169 },
      'faisalabad': { lat: 31.4504, lng: 73.1350 },
      'multan': { lat: 30.1575, lng: 71.5249 },
      'peshawar': { lat: 34.0151, lng: 71.5249 },
      'quetta': { lat: 30.1798, lng: 66.9750 }
    };
    
    const cityName = address.toLowerCase();
    for (const [city, coords] of Object.entries(mockCoordinates)) {
      if (cityName.includes(city)) {
        return coords;
      }
    }
    
    // Default to Karachi if no match found
    return mockCoordinates.karachi;
    
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};

/**
 * Reverse geocode coordinates to address (placeholder implementation)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Address string
 */
const reverseGeocodeCoordinates = async (lat, lng) => {
  try {
    // In a real implementation, you would use a reverse geocoding service
    console.log(`Reverse geocoding coordinates: ${lat}, ${lng}`);
    
    // Mock address based on coordinates
    if (lat >= 24.8 && lat <= 25.0 && lng >= 66.9 && lng <= 67.2) {
      return 'Karachi, Sindh, Pakistan';
    } else if (lat >= 31.4 && lat <= 31.6 && lng >= 74.2 && lng <= 74.4) {
      return 'Lahore, Punjab, Pakistan';
    } else if (lat >= 33.6 && lat <= 33.8 && lng >= 73.0 && lng <= 73.2) {
      return 'Islamabad, Pakistan';
    }
    
    return 'Pakistan';
    
  } catch (error) {
    console.error('Error reverse geocoding coordinates:', error);
    throw error;
  }
};

/**
 * Find nearby cases within a specified radius
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @param {string} caseType - 'PARENT' or 'FINDER' or 'ALL'
 * @returns {Array} Array of nearby cases
 */
const findNearbyCases = async (lat, lng, radiusKm = 10, caseType = 'ALL') => {
  try {
    let parentReports = [];
    let finderReports = [];
    
    if (caseType === 'PARENT' || caseType === 'ALL') {
      parentReports = await prisma.parentReport.findMany({
        where: {
          status: { in: ['ACTIVE', 'UNDER_INVESTIGATION'] },
          latitude: { not: null },
          longitude: { not: null }
        },
        include: {
          caseImages: {
            where: { isPrimary: true },
            select: { imageUrl: true },
            take: 1
          },
          reportedByUser: {
            select: { name: true, phone: true }
          }
        }
      });
    }
    
    if (caseType === 'FINDER' || caseType === 'ALL') {
      finderReports = await prisma.finderReport.findMany({
        where: {
          status: 'ACTIVE',
          latitude: { not: null },
          longitude: { not: null }
        },
        include: {
          caseImages: {
            where: { isPrimary: true },
            select: { imageUrl: true },
            take: 1
          },
          reportedByUser: {
            select: { name: true, phone: true }
          }
        }
      });
    }
    
    const nearbyCases = [];
    
    // Filter parent reports by distance
    for (const report of parentReports) {
      if (report.latitude && report.longitude) {
        const distance = calculateDistance(lat, lng, report.latitude, report.longitude);
        if (distance <= radiusKm) {
          nearbyCases.push({
            ...report,
            type: 'PARENT',
            distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
          });
        }
      }
    }
    
    // Filter finder reports by distance
    for (const report of finderReports) {
      if (report.latitude && report.longitude) {
        const distance = calculateDistance(lat, lng, report.latitude, report.longitude);
        if (distance <= radiusKm) {
          nearbyCases.push({
            ...report,
            type: 'FINDER',
            distance: Math.round(distance * 100) / 100
          });
        }
      }
    }
    
    // Sort by distance
    nearbyCases.sort((a, b) => a.distance - b.distance);
    
    return nearbyCases;
    
  } catch (error) {
    console.error('Error finding nearby cases:', error);
    throw error;
  }
};

/**
 * Update location coordinates for a case
 * @param {string} caseId - Case ID
 * @param {string} caseType - 'PARENT' or 'FINDER'
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
const updateCaseLocation = async (caseId, caseType, lat, lng) => {
  try {
    const updateData = {
      latitude: lat,
      longitude: lng,
      updatedAt: new Date()
    };
    
    if (caseType === 'PARENT') {
      await prisma.parentReport.update({
        where: { id: caseId },
        data: updateData
      });
    } else if (caseType === 'FINDER') {
      await prisma.finderReport.update({
        where: { id: caseId },
        data: updateData
      });
    } else {
      throw new Error('Invalid case type');
    }
    
    console.log(`Location updated for ${caseType} case ${caseId}`);
    
  } catch (error) {
    console.error('Error updating case location:', error);
    throw error;
  }
};

/**
 * Get location statistics for a region
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Object} Location statistics
 */
const getLocationStatistics = async (lat, lng, radiusKm = 50) => {
  try {
    const nearbyCases = await findNearbyCases(lat, lng, radiusKm, 'ALL');
    
    const stats = {
      totalCases: nearbyCases.length,
      parentReports: nearbyCases.filter(c => c.type === 'PARENT').length,
      finderReports: nearbyCases.filter(c => c.type === 'FINDER').length,
      averageDistance: 0,
      hotspots: []
    };
    
    if (nearbyCases.length > 0) {
      stats.averageDistance = nearbyCases.reduce((sum, c) => sum + c.distance, 0) / nearbyCases.length;
      stats.averageDistance = Math.round(stats.averageDistance * 100) / 100;
    }
    
    // Find hotspots (areas with multiple cases)
    const gridSize = 0.01; // ~1km grid
    const grid = {};
    
    for (const caseItem of nearbyCases) {
      const gridLat = Math.floor(caseItem.latitude / gridSize) * gridSize;
      const gridLng = Math.floor(caseItem.longitude / gridSize) * gridSize;
      const gridKey = `${gridLat},${gridLng}`;
      
      if (!grid[gridKey]) {
        grid[gridKey] = {
          lat: gridLat,
          lng: gridLng,
          count: 0,
          cases: []
        };
      }
      
      grid[gridKey].count++;
      grid[gridKey].cases.push(caseItem.id);
    }
    
    // Get top hotspots
    stats.hotspots = Object.values(grid)
      .filter(spot => spot.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return stats;
    
  } catch (error) {
    console.error('Error getting location statistics:', error);
    throw error;
  }
};

/**
 * Track user location for real-time updates (for authorized users)
 * @param {string} userId - User ID
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} accuracy - Location accuracy in meters
 */
const trackUserLocation = async (userId, lat, lng, accuracy = null) => {
  try {
    // Store location in a location tracking table (you'd need to create this)
    // For now, we'll just log it
    console.log(`User ${userId} location: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
    
    // In a real implementation, you might:
    // 1. Store in a separate location_tracking table
    // 2. Use Redis for real-time tracking
    // 3. Implement geofencing alerts
    // 4. Check for nearby cases and send notifications
    
    // Example: Check if user is near any active cases
    const nearbyCases = await findNearbyCases(lat, lng, 1, 'ALL'); // 1km radius
    
    if (nearbyCases.length > 0) {
      console.log(`User ${userId} is near ${nearbyCases.length} active cases`);
      // Could send notification about nearby cases
    }
    
  } catch (error) {
    console.error('Error tracking user location:', error);
    throw error;
  }
};

/**
 * Get suggested search areas based on case patterns
 * @param {string} caseId - Case ID to get suggestions for
 * @param {string} caseType - 'PARENT' or 'FINDER'
 * @returns {Array} Array of suggested search areas
 */
const getSuggestedSearchAreas = async (caseId, caseType) => {
  try {
    let caseData;
    
    if (caseType === 'PARENT') {
      caseData = await prisma.parentReport.findUnique({
        where: { id: caseId },
        select: {
          latitude: true,
          longitude: true,
          lastSeenLocation: true,
          lastSeenDateTime: true,
          age: true
        }
      });
    } else {
      caseData = await prisma.finderReport.findUnique({
        where: { id: caseId },
        select: {
          latitude: true,
          longitude: true,
          foundLocation: true,
          foundDateTime: true,
          estimatedAge: true
        }
      });
    }
    
    if (!caseData || !caseData.latitude || !caseData.longitude) {
      return [];
    }
    
    const suggestions = [];
    const baseLat = caseData.latitude;
    const baseLng = caseData.longitude;
    
    // Generate search areas in expanding circles
    const searchRadii = [0.5, 1, 2, 5]; // km
    
    for (const radius of searchRadii) {
      // Generate points around the circle
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = toRadians(angle);
        const deltaLat = (radius / 111) * Math.cos(rad); // 111 km per degree latitude
        const deltaLng = (radius / 111) * Math.sin(rad) / Math.cos(toRadians(baseLat));
        
        const searchLat = baseLat + deltaLat;
        const searchLng = baseLng + deltaLng;
        
        suggestions.push({
          latitude: searchLat,
          longitude: searchLng,
          radius: radius,
          priority: 1 / radius, // Closer areas have higher priority
          description: await reverseGeocodeCoordinates(searchLat, searchLng)
        });
      }
    }
    
    return suggestions.slice(0, 10); // Return top 10 suggestions
    
  } catch (error) {
    console.error('Error getting suggested search areas:', error);
    throw error;
  }
};

/**
 * Setup WebSocket handlers for real-time location sharing
 * @param {Object} io - Socket.IO server instance
 */
const setupSocketHandlers = (io) => {
  try {
    console.log('Setting up WebSocket handlers for location service');
    
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);
      
      // Handle user joining location tracking
      socket.on('join-location-tracking', (data) => {
        const { userId, userRole } = data;
        socket.join(`user:${userId}`);
        socket.userInfo = { userId, userRole };
        console.log(`User ${userId} joined location tracking`);
      });
      
      // Handle real-time location updates
      socket.on('location-update', async (data) => {
        try {
          const { userId, latitude, longitude, accuracy } = data;
          
          if (socket.userInfo && socket.userInfo.userId === userId) {
            // Track the location
            await trackUserLocation(userId, latitude, longitude, accuracy);
            
            // Broadcast to relevant users (admins, authorized personnel)
            socket.to('admin-room').emit('user-location-update', {
              userId,
              latitude,
              longitude,
              accuracy,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('Error handling location update:', error);
          socket.emit('error', { message: 'Failed to update location' });
        }
      });
      
      // Handle joining admin room for location monitoring
      socket.on('join-admin-room', (data) => {
        const { userRole } = data;
        if (userRole === 'ADMIN' || userRole === 'POLICE') {
          socket.join('admin-room');
          console.log(`Admin user joined monitoring room: ${socket.id}`);
        }
      });
      
      // Handle nearby case requests
      socket.on('get-nearby-cases', async (data) => {
        try {
          const { latitude, longitude, radius = 10, caseType = 'ALL' } = data;
          const nearbyCases = await findNearbyCases(latitude, longitude, radius, caseType);
          
          socket.emit('nearby-cases-response', {
            cases: nearbyCases,
            location: { latitude, longitude },
            radius
          });
        } catch (error) {
          console.error('Error getting nearby cases:', error);
          socket.emit('error', { message: 'Failed to get nearby cases' });
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.userInfo) {
          console.log(`User ${socket.userInfo.userId} stopped location tracking`);
        }
      });
    });
    
  } catch (error) {
    console.error('Error setting up WebSocket handlers:', error);
  }
};

module.exports = {
  calculateDistance,
  geocodeAddress,
  reverseGeocodeCoordinates,
  findNearbyCases,
  updateCaseLocation,
  getLocationStatistics,
  trackUserLocation,
  getSuggestedSearchAreas,
  setupSocketHandlers
};
