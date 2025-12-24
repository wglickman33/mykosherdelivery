import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import "./Countdown.scss";
import { getCountdownSettings } from "../../services/countdownService";
import { isInPastDuePeriod } from "../../utils/countdownUtils";

const Countdown = ({ variant = "default", className = "" }) => {
  // State for countdown settings
  const [settings, setSettings] = useState({
    targetDay: 4, // Thursday
    targetTime: '18:00', // 6:00 PM
    resetDay: 6, // Saturday
    resetTime: '00:00', // 12:00 AM
    timezone: 'America/New_York',
    targetDayName: 'Thursday',
    resetDayName: 'Saturday',
  });

  // Memoized function to check if current time is in the "past due" period
  const checkIsInPastDuePeriod = useCallback(() => {
    return isInPastDuePeriod(settings);
  }, [settings]);

  // Function to get the next target date
  const getNextTargetDate = useCallback(() => {
    const now = new Date();
    const timezone = settings.timezone || 'America/New_York';
    
    // Get current time in the target timezone using Intl.DateTimeFormat
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
    const currentHour = parseInt(parts.find(part => part.type === 'hour').value);
    const currentMinute = parseInt(parts.find(part => part.type === 'minute').value);
    
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
    const currentDay = dayMap[dayName];
    
    const targetDay = settings.targetDay;
    const targetHour = parseInt(settings.targetTime.split(':')[0]);
    const targetMinute = parseInt(settings.targetTime.split(':')[1]);

    // Calculate days to next target day
    let daysUntilTarget;

    if (currentDay === targetDay) {
      // It's the target day
      if (currentHour < targetHour || (currentHour === targetHour && currentMinute < targetMinute)) {
        // Before target time, use today
        daysUntilTarget = 0;
      } else {
        // After target time, check if we're still in "past due" period
        const isPastDue = checkIsInPastDuePeriod();
        daysUntilTarget = isPastDue ? 0 : 7;
      }
    } else if (currentDay < targetDay) {
      // Before target day in the week
      daysUntilTarget = targetDay - currentDay;
    } else {
      // After target day in the week
      daysUntilTarget = 7 - (currentDay - targetDay);
    }

    // Create the target date
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);
    targetDate.setHours(targetHour, targetMinute, 0, 0);
    
    return targetDate;
  }, [settings, checkIsInPastDuePeriod]);

  // Function to calculate time remaining
  const calculateTimeRemaining = useCallback((target) => {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const now = new Date();
    const difference = target - now;

    // If in "past due" period or past target, return zeros
    if (difference <= 0 || checkIsInPastDuePeriod()) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }, [checkIsInPastDuePeriod]);



  // Initialize state
  const [targetDate, setTargetDate] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isPastDue, setIsPastDue] = useState(false);

  // Format time for display
  const formatTime = (value) => {
    return value.toString().padStart(2, "0");
  };

  // Format the target date for display
  const formatTargetDate = (date) => {
    if (!date) return "Calculating...";

    try {
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: settings.timezone,
      };

      const formattedDate = new Intl.DateTimeFormat("en-US", options).format(date);
      const timeStr = settings.targetTime;
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      const displayTime = `${displayHour}:${minutes} ${ampm}`;

      return `${formattedDate} at ${displayTime} EST`;
    } catch {
      return date.toLocaleDateString() + ` at ${settings.targetTime} EST`;
    }
  };

  // Check if we need to transition from "past due" period to next countdown
  const checkForPeriodTransition = useCallback(() => {
    const now = new Date();
    const timezone = settings.timezone || 'America/New_York';
    
    // Get current time in the target timezone using Intl.DateTimeFormat
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
    const currentHour = parseInt(parts.find(part => part.type === 'hour').value);
    const currentMinute = parseInt(parts.find(part => part.type === 'minute').value);
    
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
    const currentDay = dayMap[dayName];
    
    const resetDay = settings.resetDay;
    const resetHour = parseInt(settings.resetTime.split(':')[0]);
    const resetMinute = parseInt(settings.resetTime.split(':')[1]);

    // Check if we've just transitioned to reset time
    if (currentDay === resetDay && currentHour === resetHour && currentMinute < resetMinute + 1) {
      // Just after reset time, reset target date
      const newTarget = getNextTargetDate();
      setTargetDate(newTarget);
      setIsPastDue(false);
    }
  }, [settings, getNextTargetDate]);

  // Load countdown settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const fetchedSettings = await getCountdownSettings();
        setSettings(fetchedSettings);
      } catch (error) {
        console.error('Failed to load countdown settings, using defaults:', error);
        // Keep default settings
      }
    };
    
    loadSettings();
  }, []);

  // Initialize countdown when settings change
  useEffect(() => {
    if (settings.targetDay !== undefined) {
      const initialTarget = getNextTargetDate();
      setTargetDate(initialTarget);
      setTimeRemaining(calculateTimeRemaining(initialTarget));
      
      // Set initial past due status
      const initialPastDue = (() => {
        if (checkIsInPastDuePeriod()) {
          return true;
        }
        const now = new Date();
        const difference = initialTarget - now;
        return difference <= 0;
      })();
      setIsPastDue(initialPastDue);
    }
  }, [settings, getNextTargetDate, calculateTimeRemaining, checkIsInPastDuePeriod]);

  // Update countdown
  useEffect(() => {
    const updateCountdown = () => {
      // Check if we need to transition from "past due" to next countdown
      checkForPeriodTransition();

      // Update past due status - recalculate based on current targetDate
      const pastDueStatus = (() => {
        // If we're in the "past due" period, show past due message
        if (checkIsInPastDuePeriod()) {
          return true;
        }

        // If we've passed the target time but not in defined "past due" period
        const now = new Date();
        const difference = targetDate - now;
        return difference <= 0;
      })();
      
      setIsPastDue(pastDueStatus);

      // Update time remaining
      setTimeRemaining(calculateTimeRemaining(targetDate));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [targetDate, calculateTimeRemaining, checkForPeriodTransition, checkIsInPastDuePeriod]);

  return (
    <div 
      className={`countdown-container ${variant} ${className}`}
      role="timer"
      aria-live="polite"
      aria-label={isPastDue ? "Orders are past due" : "Time remaining until order deadline"}
    >
      <h2 className="countdown-header" id="countdown-title">
        {isPastDue
          ? "ORDERS FOR THIS WEEK ARE PAST DUE!"
          : "TIME REMAINING UNTIL DEADLINE"}
      </h2>

      <div 
        className="countdown-boxes"
        role="group"
        aria-labelledby="countdown-title"
        aria-describedby="countdown-target"
      >
        <div className="countdown-section">
          <div className="countdown-box-wrapper" role="group" aria-label="Days remaining">
            <div className="countdown-box" aria-label={`${timeRemaining.days} days, tens digit`}>
              {formatTime(timeRemaining.days)[0]}
            </div>
            <div className="countdown-box" aria-label={`${timeRemaining.days} days, ones digit`}>
              {formatTime(timeRemaining.days)[1]}
            </div>
          </div>
          <div className="countdown-label">Days</div>
        </div>

        <div className="countdown-section">
          <div className="countdown-box-wrapper" role="group" aria-label="Hours remaining">
            <div className="countdown-box" aria-label={`${timeRemaining.hours} hours, tens digit`}>
              {formatTime(timeRemaining.hours)[0]}
            </div>
            <div className="countdown-box" aria-label={`${timeRemaining.hours} hours, ones digit`}>
              {formatTime(timeRemaining.hours)[1]}
            </div>
          </div>
          <div className="countdown-label">Hours</div>
        </div>

        <div className="countdown-section">
          <div className="countdown-box-wrapper" role="group" aria-label="Minutes remaining">
            <div className="countdown-box" aria-label={`${timeRemaining.minutes} minutes, tens digit`}>
              {formatTime(timeRemaining.minutes)[0]}
            </div>
            <div className="countdown-box" aria-label={`${timeRemaining.minutes} minutes, ones digit`}>
              {formatTime(timeRemaining.minutes)[1]}
            </div>
          </div>
          <div className="countdown-label">Minutes</div>
        </div>

        <div className="countdown-section">
          <div className="countdown-box-wrapper" role="group" aria-label="Seconds remaining">
            <div className="countdown-box" aria-label={`${timeRemaining.seconds} seconds, tens digit`}>
              {formatTime(timeRemaining.seconds)[0]}
            </div>
            <div className="countdown-box" aria-label={`${timeRemaining.seconds} seconds, ones digit`}>
              {formatTime(timeRemaining.seconds)[1]}
            </div>
          </div>
          <div className="countdown-label">Seconds</div>
        </div>
      </div>

      <p className="countdown-target" id="countdown-target">
        Target: {formatTargetDate(targetDate)}
      </p>
    </div>
  );
};

Countdown.propTypes = {
  variant: PropTypes.string,
  className: PropTypes.string,
};

export default Countdown;
