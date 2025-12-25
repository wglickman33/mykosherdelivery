require('dotenv').config();
const { Client } = require('pg');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'mkd_development'
};

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  DB_CONFIG.host = url.hostname;
  DB_CONFIG.port = url.port || 5432;
  DB_CONFIG.user = url.username;
  DB_CONFIG.password = url.password;
  DB_CONFIG.database = url.pathname.slice(1);
}

async function createDatabase() {
  const client = new Client({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: 'postgres'
  });

  try {
    await client.connect();
    logger.info('Connected to PostgreSQL server');

    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [DB_CONFIG.database]
    );

    if (result.rows.length === 0) {
      await client.query(`CREATE DATABASE "${DB_CONFIG.database}"`);
      logger.info(`Database "${DB_CONFIG.database}" created successfully`);
    } else {
      logger.info(`Database "${DB_CONFIG.database}" already exists`);
    }

    if (process.env.NODE_ENV === 'development') {
      try {
        await client.query(`CREATE USER mkd_user WITH PASSWORD 'secure_password'`);
        await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${DB_CONFIG.database}" TO mkd_user`);
        logger.info('Database user "mkd_user" created and granted privileges');
      } catch (error) {
        if (error.code === '42710') {
          logger.info('Database user "mkd_user" already exists');
        } else {
          logger.warn('Failed to create database user:', error.message);
        }
      }
    }

  } catch (error) {
    logger.error('Failed to create database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  try {
    logger.info('Running database migrations...');
    execSync('npx sequelize-cli db:migrate', { 
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Failed to run migrations:', error);
    throw error;
  }
}

async function seedDatabase() {
  try {
    logger.info('Seeding database with initial data...');
    execSync('npx sequelize-cli db:seed:all', { 
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Failed to seed database:', error);
    throw error;
  }
}

async function testConnection() {
  const client = new Client({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database
  });

  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as current_time');
    logger.info('Database connection test successful:', result.rows[0].current_time);
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  } finally {
    await client.end();
  }
}

async function createExtensions() {
  const client = new Client({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database
  });

  try {
    await client.connect();
    
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    logger.info('UUID extension created/verified');
    
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    logger.info('pgcrypto extension created/verified');
    
  } catch (error) {
    logger.error('Failed to create extensions:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function setupDatabase() {
  try {
    logger.info('Starting database setup...');
    logger.info('Database configuration:', {
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      database: DB_CONFIG.database
    });

    await createDatabase();

    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    await createExtensions();

    await runMigrations();

    if (process.env.NODE_ENV === 'development' || process.argv.includes('--seed')) {
      await seedDatabase();
    }

    logger.info('Database setup completed successfully!');
    logger.info('You can now start the application with: npm run dev');

  } catch (error) {
    logger.error('Database setup failed:', error);
    process.exit(1);
  }
}

async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    logger.error('Database reset is not allowed in production');
    process.exit(1);
  }

  try {
    logger.warn('Resetting database - this will delete all data!');
    
    execSync('npx sequelize-cli db:migrate:undo:all', { 
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
    
    await runMigrations();
    
    await seedDatabase();
    
    logger.info('Database reset completed successfully!');
  } catch (error) {
    logger.error('Database reset failed:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

switch (command) {
  case 'setup':
    setupDatabase();
    break;
  case 'reset':
    resetDatabase();
    break;
  case 'test':
    testConnection().then(success => {
      process.exit(success ? 0 : 1);
    });
    break;
  case 'migrate':
    runMigrations();
    break;
  case 'seed':
    seedDatabase();
    break;
  default:
    console.log(`
Usage: node setup-database.js <command>

Commands:
  setup   - Create database, run migrations, and seed data
  reset   - Reset database (development only)
  test    - Test database connection
  migrate - Run migrations only
  seed    - Seed database only

Examples:
  node setup-database.js setup
  node setup-database.js setup --seed
  node setup-database.js reset
  node setup-database.js test
    `);
    process.exit(1);
}