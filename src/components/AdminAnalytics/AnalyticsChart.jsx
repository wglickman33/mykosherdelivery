import { useState } from 'react';
import PropTypes from 'prop-types';
import './AnalyticsChart.scss';

const AnalyticsChart = ({ 
  data, 
  valueKey, 
  labelKey, 
  tooltipContent,
  chartColor = '#3b82f6',
  period = 'quarterly'
}) => {
  const [chartType, setChartType] = useState('bar');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Helper function to adjust color brightness
  const adjustColor = (color, amount) => {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  };

  if (!data || data.length === 0) {
    return (
      <div className="analytics-chart-card">
        <div className="analytics-chart-empty">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(item => item[valueKey] || 0));

  const handleMouseEnter = (index, event) => {
    setHoveredIndex(index);
    const rect = event.currentTarget.getBoundingClientRect();
    
    // For line charts, position tooltips above the dots
    if (chartType === 'line') {
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 80
      });
    } else {
      // For bar charts, use smart positioning
      const tooltipHeight = 80;
      const wouldGoOffBottom = rect.top - tooltipHeight < 0;
      
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: wouldGoOffBottom ? rect.bottom + 10 : rect.top - 10
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const renderBarChart = () => {
    return (
      <div className="analytics-chart-container">
        <div className="analytics-chart-bars">
          {data.map((item, index) => {
            const height = maxVal > 0 ? ((item[valueKey] || 0) / maxVal) * 100 : 0;
            return (
              <div 
                key={index} 
                className="analytics-chart-bar"
                onMouseEnter={(e) => handleMouseEnter(index, e)}
                onMouseLeave={handleMouseLeave}
              >
                <div 
                  className="analytics-bar-fill"
                  style={{ 
                    height: `${Math.max(height, 2)}%`,
                    background: `linear-gradient(180deg, ${chartColor} 0%, ${adjustColor(chartColor, -20)} 100%)`
                  }}
                  title={`${item[labelKey]}: ${item[valueKey] || 0}`}
                />
                <span className="analytics-bar-label">{item[labelKey]}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLineChart = () => {
    // Dynamic viewBox width based on period to prevent squishing
    let viewBoxWidth = 160; // Default for quarterly (4 data points)
    if (period === 'monthly') {
      viewBoxWidth = 195; // Slightly wider for monthly (12 data points)
    } else if (period === 'weekly') {
      viewBoxWidth = 195; // Slightly wider for weekly (12 data points)
    }
    
    const points = data.map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * viewBoxWidth;
      const y = maxVal > 0 ? 100 - ((item[valueKey] || 0) / maxVal) * 100 : 100;
      return `${x},${y}`;
    }).join(' ');

    // Create area path for gradient fill
    const areaPoints = data.map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * viewBoxWidth;
      const y = maxVal > 0 ? 100 - ((item[valueKey] || 0) / maxVal) * 100 : 100;
      return `${x},${y}`;
    });
    const areaPath = `M ${areaPoints[0]} L ${areaPoints.join(' L ')} L ${viewBoxWidth},100 L 0,100 Z`;

    return (
      <div className="analytics-chart-container">
        <svg className="analytics-line-chart" viewBox={`0 0 ${viewBoxWidth} 100`} preserveAspectRatio="xMidYMid meet">
          {/* Define gradients */}
          <defs>
            <linearGradient id={`analyticsGradient-${chartColor.slice(1)}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={chartColor} stopOpacity="0.8" />
              <stop offset="50%" stopColor={adjustColor(chartColor, -20)} stopOpacity="1" />
              <stop offset="100%" stopColor={adjustColor(chartColor, -40)} stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id={`analyticsAreaGradient-${chartColor.slice(1)}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={chartColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={chartColor} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#analyticsAreaGradient-${chartColor.slice(1)})`}
            className="analytics-chart-area"
          />
          
          {/* Main line */}
          <polyline
            points={points}
            fill="none"
            stroke={`url(#analyticsGradient-${chartColor.slice(1)})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="analytics-chart-line"
          />
          
          {/* Data points */}
          {data.map((item, index) => {
            const x = (index / Math.max(data.length - 1, 1)) * viewBoxWidth;
            const y = maxVal > 0 ? 100 - ((item[valueKey] || 0) / maxVal) * 100 : 100;
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill={chartColor}
                  onMouseEnter={(e) => handleMouseEnter(index, e)}
                  onMouseLeave={handleMouseLeave}
                  className="analytics-chart-point"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="2.5"
                  fill="white"
                  stroke={chartColor}
                  strokeWidth="1"
                  onMouseEnter={(e) => handleMouseEnter(index, e)}
                  onMouseLeave={handleMouseLeave}
                  className="analytics-chart-point-inner"
                />
              </g>
            );
          })}
        </svg>
        <div className="analytics-chart-labels">
          {data.map((item, index) => (
            <span key={index} className="analytics-chart-label">{item[labelKey]}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <div className="analytics-chart-controls">
          <div className="analytics-chart-type-toggle">
            <button 
              className={`analytics-chart-type-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
              title="Bar Chart"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
            </button>
            <button 
              className={`analytics-chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
              title="Line Chart"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div className="analytics-chart-content">
        {chartType === 'bar' ? renderBarChart() : renderLineChart()}
      </div>

      {/* Tooltip */}
      {hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.length && (
        <div 
          className="analytics-chart-tooltip"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translateX(-50%)'
          }}
        >
          {tooltipContent ? tooltipContent(data[hoveredIndex]) : (
            <div>
              <div className="tooltip-title">{data[hoveredIndex][labelKey]}</div>
              <div className="tooltip-value">{data[hoveredIndex][valueKey] || 0}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AnalyticsChart.propTypes = {
  data: PropTypes.array.isRequired,
  valueKey: PropTypes.string.isRequired,
  labelKey: PropTypes.string.isRequired,
  tooltipContent: PropTypes.func,
  chartColor: PropTypes.string,
  period: PropTypes.string
};

export default AnalyticsChart;
