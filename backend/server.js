require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    // Start the server FIRST on 0.0.0.0 for Railway
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Health check available at http://0.0.0.0:${PORT}/api/health`);
    });
    
    // Then connect to database and sync models (non-blocking for health checks)
    sequelize.authenticate()
      .then(() => {
        logger.info('Database connection established successfully');
        // Sync models in production on first deploy
        return sequelize.sync({ alter: false });
      })
      .then(() => {
        logger.info('Database models synchronized successfully');
      })
      .catch((error) => {
        logger.error('Database connection/sync failed (non-fatal):', error);
        // Don't exit - let the server continue running for health checks
      });
    
    return server;
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  await sequelize.close();
  process.exit(0);
});

startServer(); 