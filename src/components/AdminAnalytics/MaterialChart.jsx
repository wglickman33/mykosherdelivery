import { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  LineChart, 
  BarChart,
  PieChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Line,
  Bar,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent, IconButton, Box, Typography } from '@mui/material';
import { BarChart3, TrendingUp } from 'lucide-react';

const MaterialChart = ({ 
  data, 
  valueKey, 
  labelKey, 
  tooltipContent,
  chartColor = '#3b82f6',
  title = 'Chart',
  type = 'line' // 'line', 'bar', 'pie'
}) => {
  const [chartType, setChartType] = useState(type);

  if (!data || data.length === 0) {
    return (
      <Card sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CardContent>
          <p>No data available</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for Material UI charts
  const formattedData = data.map(item => ({
    ...item,
    [labelKey]: item[labelKey],
    [valueKey]: item[valueKey] || 0
  }));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      if (tooltipContent) {
        return (
          <Box 
            sx={{ 
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              boxShadow: 2,
              minWidth: 200
            }}
          >
            {tooltipContent(data)}
          </Box>
        );
      }
      
      return (
        <Box 
          sx={{ 
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            boxShadow: 2
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
          <p style={{ margin: 0, color: payload[0].color }}>
            {`${valueKey}: ${payload[0].value}`}
          </p>
        </Box>
      );
    }
    return null;
  };

  // Add PropTypes for CustomTooltip
  CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.array,
    label: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  };

  // Color palette for pie charts
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const renderChart = () => {
    const commonProps = {
      data: formattedData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey={labelKey} 
                tick={{ fontSize: 11 }}
                stroke="#666"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                tickFormatter={(value) => 
                  valueKey === 'revenue' ? `$${value.toLocaleString()}` : value.toLocaleString()
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey={valueKey} 
                fill={chartColor}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie': {
        const pieData = formattedData.filter(item => item[valueKey] > 0);
        const legendPayload = pieData.map((entry, index) => ({
          value: entry[labelKey],
          description: entry.description,
          type: 'circle',
          color: entry.color || COLORS[index % COLORS.length]
        }));
        
        console.log('Pie Chart Debug:', {
          formattedData,
          valueKey,
          labelKey,
          pieData,
          legendPayload
        });
        
        return (
          <div>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ [labelKey]: label, percent }) => percent > 0 ? `${label} ${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey={valueKey}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              flexWrap: 'wrap', 
              gap: '20px', 
              marginTop: '24px',
              marginBottom: '32px',
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              {legendPayload.map((item, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    border: '2px solid #ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: '600' }}>{item.value}</span>
                    {item.description && (
                      <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey={labelKey} 
                tick={{ fontSize: 12, angle: -45, textAnchor: 'end', height: 60 }}
                stroke="#666"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                tickFormatter={(value) => 
                  valueKey === 'revenue' ? `$${value.toLocaleString()}` : value.toLocaleString()
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey={valueKey} 
                stroke={chartColor}
                strokeWidth={3}
                dot={{ fill: chartColor, strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: chartColor, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#061757' }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setChartType('bar')}
              color={chartType === 'bar' ? 'primary' : 'default'}
              sx={{ 
                bgcolor: chartType === 'bar' ? 'primary.main' : 'transparent',
                color: chartType === 'bar' ? 'white' : 'inherit',
                '&:hover': {
                  bgcolor: chartType === 'bar' ? 'primary.dark' : 'action.hover'
                }
              }}
            >
              <BarChart3 size={16} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setChartType('line')}
              color={chartType === 'line' ? 'primary' : 'default'}
              sx={{ 
                bgcolor: chartType === 'line' ? 'primary.main' : 'transparent',
                color: chartType === 'line' ? 'white' : 'inherit',
                '&:hover': {
                  bgcolor: chartType === 'line' ? 'primary.dark' : 'action.hover'
                }
              }}
            >
              <TrendingUp size={16} />
            </IconButton>
          </Box>
        </Box>
      )}
      {renderChart()}
    </div>
  );
};

MaterialChart.propTypes = {
  data: PropTypes.array.isRequired,
  valueKey: PropTypes.string.isRequired,
  labelKey: PropTypes.string.isRequired,
  tooltipContent: PropTypes.func,
  chartColor: PropTypes.string,
  title: PropTypes.string,
  type: PropTypes.oneOf(['line', 'bar', 'pie'])
};

export default MaterialChart;
