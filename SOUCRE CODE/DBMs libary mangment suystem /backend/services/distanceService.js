/**
 * Distance Calculation Service
 * Uses Haversine spherical formula (earth radius R = 6371 km)
 */

/**
 * Calculates great-circle distance between two coordinate pairs in kilometers
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in kilometers rounded to 2 decimal places
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }

  const p1 = Number(lat1);
  const l1 = Number(lon1);
  const p2 = Number(lat2);
  const l2 = Number(lon2);

  if (p1 === p2 && l1 === l2) return 0;

  const R = 6371; // Earth's radius in kilometers
  const toRad = Math.PI / 180;
  const dLat = (p2 - p1) * toRad;
  const dLon = (l2 - l1) * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1 * toRad) * Math.cos(p2 * toRad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Generates MySQL-compatible Haversine formula SQL expression
 * @param {string} userLatParam Parameter placeholder for user latitude (e.g. '?')
 * @param {string} userLngParam Parameter placeholder for user longitude (e.g. '?')
 * @param {string} tableLatCol Column name for library latitude (default 'l.latitude')
 * @param {string} tableLngCol Column name for library longitude (default 'l.longitude')
 * @returns {string} SQL snippet
 */
function getHaversineSql(userLatParam = '?', userLngParam = '?', tableLatCol = 'l.latitude', tableLngCol = 'l.longitude') {
  return `ROUND(6371 * ACOS(LEAST(1.0,
    COS(RADIANS(${userLatParam})) * COS(RADIANS(${tableLatCol})) *
    COS(RADIANS(${tableLngCol}) - RADIANS(${userLngParam})) +
    SIN(RADIANS(${userLatParam})) * SIN(RADIANS(${tableLatCol}))
  )), 2)`;
}

module.exports = {
  haversineDistance,
  getHaversineSql
};
