/**
 * Holidays API Service
 * Fetches real holidays from public API to verify holiday dates
 * Uses Nager.Date API (free, no API key required)
 */

import axios from 'axios';

const API_BASE_URL = 'https://date.nager.at/api/v3';

/**
 * Get public holidays for a specific country and year
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'PH' for Philippines, 'US' for USA)
 * @param {number} year - Year (default: current year)
 * @returns {Promise<Array>} Array of holidays
 */
export const getPublicHolidays = async (year = new Date().getFullYear(), countryCode = 'PH') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/PublicHolidays/${year}/${countryCode}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching public holidays:', error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};

/**
 * Check if a specific date is a public holiday
 * @param {Date|string} date - Date to check
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {Promise<Object|null>} Holiday object if found, null otherwise
 */
export const checkIfHoliday = async (date, countryCode = 'PH') => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const holidays = await getPublicHolidays(year, countryCode);
    
    const dateString = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    return holidays.find(holiday => holiday.date === dateString) || null;
  } catch (error) {
    console.error('Error checking if date is holiday:', error);
    return null;
  }
};

/**
 * Get available countries for holiday API
 * @returns {Promise<Array>} Array of country objects
 */
export const getAvailableCountries = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/AvailableCountries`);
    return response.data;
  } catch (error) {
    console.error('Error fetching available countries:', error);
    throw error;
  }
};

/**
 * Get holidays for a date range
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {Promise<Array>} Array of holidays in the date range
 */
export const getHolidaysInRange = async (startDate, endDate, countryCode = 'PH') => {
  try {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    const allHolidays = [];
    
    // Fetch holidays for each year in the range
    for (let year = startYear; year <= endYear; year++) {
      const holidays = await getPublicHolidays(year, countryCode);
      allHolidays.push(...holidays);
    }
    
    // Filter holidays within the date range
    const startString = start.toISOString().split('T')[0];
    const endString = end.toISOString().split('T')[0];
    
    return allHolidays.filter(holiday => {
      return holiday.date >= startString && holiday.date <= endString;
    });
  } catch (error) {
    console.error('Error fetching holidays in range:', error);
    throw error;
  }
};



