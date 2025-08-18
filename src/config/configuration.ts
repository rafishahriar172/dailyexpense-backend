/* eslint-disable prettier/prettier */
export default () => ({
  port: parseInt(process.env.PORT ?? '5000', 10),
  database: {
    url: process.env.DATABASE_URL,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS ?? '10', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT ?? '60000', 10),
    poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT ?? '20000', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '30d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
    rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL ?? '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
});