import { useState, useEffect } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import {
  getCountdownSettings,
  updateCountdownSettings,
  resetCountdownSettings,
  getDayName,
  formatTimeForDisplay,
  parseDisplayTime
} from '../../services/countdownService';

const SettingsCountdownTimer = () => {
  const [countdownSettings, setCountdownSettings] = useState({
    targetDay: 4,
    targetTime: '18:00',
    resetDay: 6,
    resetTime: '00:00',
    timezone: 'America/New_York',
    targetDayName: 'Thursday',
    resetDayName: 'Saturday',
  });
  const [countdownLoading, setCountdownLoading] = useState(false);
  const [countdownMessage, setCountdownMessage] = useState('');

  useEffect(() => {
    fetchCountdownSettings();
  }, []);

  const fetchCountdownSettings = async () => {
    setCountdownLoading(true);
    try {
      const settings = await getCountdownSettings();
      setCountdownSettings(settings);
      setCountdownMessage('');
    } catch {
      setCountdownMessage('Error loading countdown settings');
    }
    setCountdownLoading(false);
  };

  const handleCountdownUpdate = async () => {
    setCountdownLoading(true);
    setCountdownMessage('');

    try {
      const result = await updateCountdownSettings({
        targetDay: countdownSettings.targetDay,
        targetTime: countdownSettings.targetTime,
        resetDay: countdownSettings.resetDay,
        resetTime: countdownSettings.resetTime,
        timezone: countdownSettings.timezone,
      });

      if (result.success) {
        setCountdownSettings(result.data.settings);
        setCountdownMessage('Settings updated successfully!');
        setTimeout(() => setCountdownMessage(''), 3000);
      } else {
        setCountdownMessage(`Error: ${result.error}`);
      }
    } catch {
      setCountdownMessage('Error updating settings');
    }

    setCountdownLoading(false);
  };

  const handleCountdownReset = async () => {
    setCountdownLoading(true);
    setCountdownMessage('');

    try {
      const result = await resetCountdownSettings();

      if (result.success) {
        await fetchCountdownSettings();
        setCountdownMessage('Settings reset to defaults successfully!');
        setTimeout(() => setCountdownMessage(''), 3000);
      } else {
        setCountdownMessage(`Error: ${result.error}`);
      }
    } catch {
      setCountdownMessage('Error resetting settings');
    }

    setCountdownLoading(false);
  };

  const handleCountdownSettingChange = (field, value) => {
    if (field === 'targetDay' || field === 'resetDay') {
      const dayName = getDayName(parseInt(value));
      setCountdownSettings(prev => ({
        ...prev,
        [field]: parseInt(value),
        [`${field.replace('Day', 'DayName')}`]: dayName
      }));
    } else if (field === 'targetTime' || field === 'resetTime') {
      const time24 = parseDisplayTime(value);
      setCountdownSettings(prev => ({
        ...prev,
        [field]: time24
      }));
    } else {
      setCountdownSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <div className="countdown-timer-tab">
      <div className="countdown-settings-section">
        <h3>Countdown Timer Configuration</h3>
        <p className="section-description">
          Configure when orders close for the week and when they reset.
          Changes take effect immediately across the platform.
        </p>

        {countdownLoading && (
          <div className="loading-overlay">
            <LoadingSpinner size="medium" />
            <p>Loading settings...</p>
          </div>
        )}

        {countdownMessage && (
          <div className={`message ${countdownMessage.includes('successfully') ? 'success' : 'error'}`}>
            {countdownMessage}
          </div>
        )}

        <div className="countdown-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="targetDay">Order Close Day</label>
              <select
                id="targetDay"
                value={countdownSettings.targetDay}
                onChange={(e) => handleCountdownSettingChange('targetDay', e.target.value)}
                disabled={countdownLoading}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="targetTime">Order Close Time</label>
              <input
                id="targetTime"
                type="time"
                value={countdownSettings.targetTime}
                onChange={(e) => handleCountdownSettingChange('targetTime', e.target.value)}
                disabled={countdownLoading}
              />
              <small>Current: {formatTimeForDisplay(countdownSettings.targetTime)} EST</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="resetDay">Order Reset Day</label>
              <select
                id="resetDay"
                value={countdownSettings.resetDay}
                onChange={(e) => handleCountdownSettingChange('resetDay', e.target.value)}
                disabled={countdownLoading}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="resetTime">Order Reset Time</label>
              <input
                id="resetTime"
                type="time"
                value={countdownSettings.resetTime}
                onChange={(e) => handleCountdownSettingChange('resetTime', e.target.value)}
                disabled={countdownLoading}
              />
              <small>Current: {formatTimeForDisplay(countdownSettings.resetTime)} EST</small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="timezone">Timezone</label>
            <select
              id="timezone"
              value={countdownSettings.timezone}
              onChange={(e) => handleCountdownSettingChange('timezone', e.target.value)}
              disabled={countdownLoading}
            >
              <option value="America/New_York">Eastern Time (EST/EDT)</option>
              <option value="America/Chicago">Central Time (CST/CDT)</option>
              <option value="America/Denver">Mountain Time (MST/MDT)</option>
              <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
            </select>
            <small>Automatically handles daylight saving time transitions</small>
          </div>

          <div className="current-settings">
            <h4>Current Configuration</h4>
            <div className="settings-summary">
              <p>
                <strong>Orders close:</strong> {countdownSettings.targetDayName}s at {formatTimeForDisplay(countdownSettings.targetTime)} EST
              </p>
              <p>
                <strong>Orders reset:</strong> {countdownSettings.resetDayName}s at {formatTimeForDisplay(countdownSettings.resetTime)} EST
              </p>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleCountdownUpdate}
              disabled={countdownLoading}
              className="btn btn-primary"
            >
              {countdownLoading ? 'Updating...' : 'Save Settings'}
            </button>

            <button
              type="button"
              onClick={handleCountdownReset}
              disabled={countdownLoading}
              className="btn btn-secondary"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsCountdownTimer;
