require('dotenv').config();

const logger = require('../utils/logger');

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const shouldUseSSL = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=prefer')) {
    return true;
  }
  
  if (dbUrl.includes('sslmode=disable')) {
    return false;
  }
  
  if (nodeEnv === 'production') {
    const isLocal = dbUrl.includes('localhost') || 
                    dbUrl.includes('127.0.0.1') || 
                    dbUrl.match(/@(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/);
    
    return !isLocal;
  }
  
  return false;
};

const commonConfig = {
  dialect: 'postgres',
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true,
    freezeTableName: true
  },
  retry: {
    max: 3,
    timeout: 5000,
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ESOCKETTIMEDOUT/,
      /EHOSTUNREACH/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ]
  }
};

module.exports = {
  development: {
    ...commonConfig,
    url: process.env.DATABASE_URL,
    dialectOptions: {
      ssl: false,
      connectTimeout: 60000,
      requestTimeout: 30000
    },
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
      evict: 1000,
      handleDisconnects: true
    },
    logging: (msg) => logger.debug('Database Query:', msg)
  },
  test: {
    ...commonConfig,
    url: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL,
    dialectOptions: {
      ssl: false,
      connectTimeout: 60000,
      requestTimeout: 30000
    },
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000,
      evict: 1000,
      handleDisconnects: true
    },
    logging: false
  },
  production: {
    ...commonConfig,
    url: process.env.DATABASE_URL,
    dialectOptions: {
      ...(shouldUseSSL() ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {
        ssl: false
      }),
      connectTimeout: 60000,
      requestTimeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 0
    },
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 30000,
      evict: 5000,
      handleDisconnects: true
    },
    logging: false
  }
}; 