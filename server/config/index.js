require('dotenv').config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me')) {
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/taskmanager',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET || 'taskflow-default-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
};

module.exports = config;
