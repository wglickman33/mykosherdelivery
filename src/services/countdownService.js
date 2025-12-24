import apiClient from '../lib/api';

// Get current countdown settings
export const getCountdownSettings = async () => {
  try {
    const response = await apiClient.get('/countdown/settings');
    return response;
  } catch (error) {
    console.error('Error fetching countdown settings:', error);
    // Return default settings if API fails
    return {
      targetDay: 4, // Thursday
      targetTime: '18:00', // 6:00 PM
      resetDay: 6, // Saturday
      resetTime: '00:00', // 12:00 AM
      timezone: 'America/New_York',
      targetDayName: 'Thursday',
      resetDayName: 'Saturday',
    };
  }
};

// Update countdown settings (admin only)
export const updateCountdownSettings = async (settings) => {
  try {
    const response = await apiClient.put('/countdown/settings', settings);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error updating countdown settings:', error);
    return { success: false, error: error.message };
  }
};

// Reset countdown settings to defaults (admin only)
export const resetCountdownSettings = async () => {
  try {
    const response = await apiClient.post('/countdown/settings/reset');
    return { success: true, data: response };
  } catch (error) {
    console.error('Error resetting countdown settings:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to convert day number to name
export const getDayName = (dayNumber) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
};

// Helper function to convert day name to number
export const getDayNumber = (dayName) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days.indexOf(dayName);
};

// Helper function to format time for display
export const formatTimeForDisplay = (timeString) => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Helper function to convert display time to 24-hour format
export const parseDisplayTime = (displayTime) => {
  if (!displayTime) return '00:00';
  const [time, ampm] = displayTime.split(' ');
  const [hours, minutes] = time.split(':');
  let hour = parseInt(hours);
  
  if (ampm === 'PM' && hour !== 12) {
    hour += 12;
  } else if (ampm === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
};
