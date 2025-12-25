import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import "./Countdown.scss";
import { getCountdownSettings } from "../../services/countdownService";
import { isInPastDuePeriod } from "../../utils/countdownUtils";

const Countdown = ({ variant = "default", className = "" }) => {
  const [settings, setSettings] = useState({
    targetDay: 4,
    targetTime: '18:00',
    resetDay: 6,
    resetTime: '00:00',
    timezone: 'America/New_York',
    targetDayName: 'Thursday',
    resetDayName: 'Saturday',
  });

  const checkIsInPastDuePeriod = useCallback(() => {
    return isInPastDuePeriod(settings);
  }, [settings]);

  const getNextTargetDate = useCallback(() => {
    const now = new Date();
    const timezone = settings.timezone || 'America/New_York';
    
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

    let daysUntilTarget;

    if (currentDay === targetDay) {
      if (currentHour < targetHour || (currentHour === targetHour && currentMinute < targetMinute)) {
        daysUntilTarget = 0;
      } else {
        const isPastDue = checkIsInPastDuePeriod();
        daysUntilTarget = isPastDue ? 0 : 7;
      }
    } else if (currentDay < targetDay) {
      daysUntilTarget = targetDay - currentDay;
    } else {
      daysUntilTarget = 7 - (currentDay - targetDay);
    }

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);
    targetDate.setHours(targetHour, targetMinute, 0, 0);
    
    return targetDate;
  }, [settings, checkIsInPastDuePeriod]);

  const calculateTimeRemaining = useCallback((target) => {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const now = new Date();
    const difference = target - now;

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



  const [targetDate, setTargetDate] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isPastDue, setIsPastDue] = useState(false);

  const formatTime = (value) => {
    return value.toString().padStart(2, "0");
  };

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

  const checkForPeriodTransition = useCallback(() => {
    const now = new Date();
    const timezone = settings.timezone || 'America/New_York';
    
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

    if (currentDay === resetDay && currentHour === resetHour && currentMinute < resetMinute + 1) {
      const newTarget = getNextTargetDate();
      setTargetDate(newTarget);
      setIsPastDue(false);
    }
  }, [settings, getNextTargetDate]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const fetchedSettings = await getCountdownSettings();
        setSettings(fetchedSettings);
      } catch (error) {
        console.error('Failed to load countdown settings, using defaults:', error);
      }
    };
    
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings.targetDay !== undefined) {
      const initialTarget = getNextTargetDate();
      setTargetDate(initialTarget);
      setTimeRemaining(calculateTimeRemaining(initialTarget));
      
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

  useEffect(() => {
    const updateCountdown = () => {
      checkForPeriodTransition();

      const pastDueStatus = (() => {
        if (checkIsInPastDuePeriod()) {
          return true;
        }

        const now = new Date();
        const difference = targetDate - now;
        return difference <= 0;
      })();
      
      setIsPastDue(pastDueStatus);

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
