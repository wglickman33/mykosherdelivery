// Utility functions for countdown logic

// Helper function to get current time in a specific timezone
const getTimeInTimezone = (timezone = 'America/New_York') => {
  const now = new Date();
  
  // Use Intl.DateTimeFormat to get timezone-specific time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const dayName = parts.find(part => part.type === 'weekday').value;
  const hour = parseInt(parts.find(part => part.type === 'hour').value);
  const minute = parseInt(parts.find(part => part.type === 'minute').value);
  const second = parseInt(parts.find(part => part.type === 'second').value);
  
  // Convert day name to number (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayMap = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6
  };
  
  return {
    day: dayMap[dayName],
    hour,
    minute,
    second
  };
};

// Function to check if current time is in the "past due" period
export const isInPastDuePeriod = (settings) => {
  const timezone = settings.timezone || 'America/New_York';
  const current = getTimeInTimezone(timezone);
  
  const targetDay = settings.targetDay;
  const targetHour = parseInt(settings.targetTime.split(':')[0]);
  const targetMinute = parseInt(settings.targetTime.split(':')[1]);
  const resetDay = settings.resetDay;
  const resetHour = parseInt(settings.resetTime.split(':')[0]);
  const resetMinute = parseInt(settings.resetTime.split(':')[1]);

  // Check if it's after target day/time
  if (current.day === targetDay) {
    if (current.hour > targetHour || (current.hour === targetHour && current.minute >= targetMinute)) {
      // If reset is same day, check if we're before reset time
      if (resetDay === targetDay) {
        return current.hour < resetHour || (current.hour === resetHour && current.minute < resetMinute);
      }
      // If reset is different day, we're in past due period
      return true;
    }
  }

  // Check if it's between target day and reset day (for different days)
  if (resetDay !== targetDay) {
    if (current.day > targetDay || (current.day < targetDay && targetDay > resetDay)) {
      // Handle week wraparound (e.g., Saturday to Sunday)
      if (targetDay > resetDay && (current.day > targetDay || current.day < resetDay)) {
        return true;
      } else if (targetDay < resetDay && current.day > targetDay && current.day < resetDay) {
        return true;
      }
    }
  }

  return false;
};
