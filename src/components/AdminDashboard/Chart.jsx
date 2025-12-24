import { useState } from 'react';
import PropTypes from 'prop-types';
import './Chart.scss';

const Chart = ({ 
  data, 
  type = 'bar', 
  title, 
  subtitle, 
  maxValue, 
  valueKey, 
  labelKey, 
  tooltipContent,
  onChartTypeChange
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [chartType, setChartType] = useState(type);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipAbove, setTooltipAbove] = useState(true);

  const handleChartTypeChange = (newType) => {
    setChartType(newType);
    if (onChartTypeChange) {
      onChartTypeChange(newType);
    }
  };

  const handleMouseEnter = (index, event) => {
    setHoveredIndex(index);
    const rect = event.currentTarget.getBoundingClientRect();
    
    // For line charts, always position tooltips above the dots
    if (chartType === 'line') {
      setTooltipAbove(true);
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 80
      });
    } else {
      // For bar charts, use smart positioning
      const tooltipHeight = 80;
      const wouldGoOffBottom = rect.top - tooltipHeight < 0;
      
      setTooltipAbove(!wouldGoOffBottom);
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: wouldGoOffBottom ? rect.bottom + 10 : rect.top - 10
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const formatValue = (value) => {
    if (valueKey === 'revenue') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    }
    return value.toLocaleString();
  };

  const getMaxValue = () => {
    if (maxValue) return maxValue;
    return Math.max(...data.map(item => item[valueKey]));
  };

  const renderBarChart = () => (
    <div className="chart-container">
      <div className="chart-bars">
        {data.map((item, index) => {
          const height = (item[valueKey] / getMaxValue()) * 100;
          return (
            <div 
              key={index}
              className="chart-bar"
              onMouseEnter={(e) => handleMouseEnter(index, e)}
              onMouseLeave={handleMouseLeave}
            >
              <div 
                className={`bar ${valueKey === 'revenue' ? 'revenue-bar' : 'orders-bar'}`}
                style={{ height: `${height}%` }}
              ></div>
              <span className="bar-label">{item[labelKey]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderLineChart = () => {
    const maxVal = getMaxValue();
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 160;
      const y = 100 - ((item[valueKey] / maxVal) * 100);
      return `${x},${y}`;
    }).join(' ');

    // Create area path for gradient fill
    const areaPoints = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 160;
      const y = 100 - ((item[valueKey] / maxVal) * 100);
      return `${x},${y}`;
    });
    const areaPath = `M ${areaPoints[0]} L ${areaPoints.join(' L ')} L 160,100 L 0,100 Z`;

    const lineColor = valueKey === 'revenue' ? '#3b82f6' : '#10b981';
    const gradientId = valueKey === 'revenue' ? 'revenueGradient' : 'ordersGradient';

    return (
      <div className="chart-container">
        <svg className="line-chart" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">
          {/* Define gradients */}
          <defs>
            <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#2563eb" stopOpacity="1" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="ordersGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#059669" stopOpacity="1" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id={`${gradientId}Area`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#${gradientId}Area)`}
            className="chart-area"
          />
          
          {/* Main line */}
          <polyline
            points={points}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`chart-line ${valueKey === 'revenue' ? 'revenue-line' : 'orders-line'}`}
          />
          
          {/* Data points */}
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 160;
            const y = 100 - ((item[valueKey] / maxVal) * 100);
            return (
              <g key={index}>
                {/* Outer circle */}
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill={lineColor}
                  onMouseEnter={(e) => handleMouseEnter(index, e)}
                  onMouseLeave={handleMouseLeave}
                  className="chart-point"
                />
                {/* Inner white circle */}
                <circle
                  cx={x}
                  cy={y}
                  r="2"
                  fill="white"
                  stroke={lineColor}
                  strokeWidth="1"
                  className="chart-point-inner"
                  onMouseEnter={(e) => handleMouseEnter(index, e)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>
            );
          })}
        </svg>
        <div className="chart-labels">
          {data.map((item, index) => (
            <span key={index} className="chart-label">{item[labelKey]}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="chart-controls">
          <button
            className={`chart-type-btn ${chartType === 'bar' ? 'active' : ''}`}
            onClick={() => handleChartTypeChange('bar')}
            title="Bar Chart"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4-4h2v18h-2V3zm4-2h2v20h-2V1z"/>
            </svg>
          </button>
          <button
            className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => handleChartTypeChange('line')}
            title="Line Chart"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M3 17l6-6 4 4 8-8v2.83l-8 8-4-4-6 6V17z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="chart-content">
        {chartType === 'bar' ? renderBarChart() : renderLineChart()}
        
        {hoveredIndex !== null && (
          <div 
            className={`chart-tooltip ${tooltipAbove ? 'tooltip-above' : 'tooltip-below'}`}
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translateX(-50%)'
            }}
          >
            {tooltipContent ? tooltipContent(data[hoveredIndex]) : (
              <div>
                <div className="tooltip-title">{data[hoveredIndex][labelKey]}</div>
                <div className="tooltip-value">
                  {formatValue(data[hoveredIndex][valueKey])}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

Chart.propTypes = {
  data: PropTypes.array.isRequired,
  type: PropTypes.oneOf(['bar', 'line']),
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  maxValue: PropTypes.number,
  valueKey: PropTypes.string.isRequired,
  labelKey: PropTypes.string.isRequired,
  tooltipContent: PropTypes.func,
  onChartTypeChange: PropTypes.func
};

export default Chart;
