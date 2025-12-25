import apiClient from '../lib/api';

export const getCountdownSettings = async () => {
  try {
    const response = await apiClient.get('/countdown/settings');
    return response;
  } catch (error) {
    console.error('Error fetching countdown settings:', error);
    return {
      targetDay: 4,
      targetTime: '18:00',
      resetDay: 6,
      resetTime: '00:00',
      timezone: 'America/New_York',
      targetDayName: 'Thursday',
      resetDayName: 'Saturday',
    };
  }
};

export const updateCountdownSettings = async (settings) => {
  try {
    const response = await apiClient.put('/countdown/settings', settings);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error updating countdown settings:', error);
    return { success: false, error: error.message };
  }
};

export const resetCountdownSettings = async () => {
  try {
    const response = await apiClient.post('/countdown/settings/reset');
    return { success: true, data: response };
  } catch (error) {
    console.error('Error resetting countdown settings:', error);
    return { success: false, error: error.message };
  }
};

export const getDayName = (dayNumber) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
};

export const getDayNumber = (dayName) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days.indexOf(dayName);
};

export const formatTimeForDisplay = (timeString) => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

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
