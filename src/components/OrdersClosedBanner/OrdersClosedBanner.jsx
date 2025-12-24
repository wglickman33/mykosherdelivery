import { useState, useEffect } from 'react';
import './OrdersClosedBanner.scss';
import { isInPastDuePeriod } from '../../utils/countdownUtils';
import { getCountdownSettings, formatTimeForDisplay } from '../../services/countdownService';

const OrdersClosedBanner = () => {
  const [isOrdersClosed, setIsOrdersClosed] = useState(false);
  const [settings, setSettings] = useState({
    targetDay: 4, // Thursday
    targetTime: '18:00', // 6:00 PM
    resetDay: 6, // Saturday
    resetTime: '00:00', // 12:00 AM
    timezone: 'America/New_York',
    targetDayName: 'Thursday',
    resetDayName: 'Saturday',
  });

  // Load countdown settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const fetchedSettings = await getCountdownSettings();
        setSettings(fetchedSettings);
      } catch (error) {
        console.error('Failed to load countdown settings for banner, using defaults:', error);
        // Keep default settings
      }
    };
    
    loadSettings();
  }, []);

  // Update orders closed status
  useEffect(() => {
    const updateStatus = () => {
      setIsOrdersClosed(isInPastDuePeriod(settings));
    };

    // Initial check
    updateStatus();

    // Update every minute to handle transitions
    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, [settings]);

  if (!isOrdersClosed) {
    return null;
  }

  return (
    <div className="orders-closed-banner" role="alert" aria-live="polite">
      <div className="orders-closed-banner__content">
        <div className="orders-closed-banner__icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        <div className="orders-closed-banner__text">
          <strong>Orders are closed for this week</strong>
          <span>New orders will be available starting {settings.resetDayName}s at {formatTimeForDisplay(settings.resetTime)} EST</span>
        </div>
      </div>
    </div>
  );
};

export default OrdersClosedBanner;
