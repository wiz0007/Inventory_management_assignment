import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-super-secret-inventory-jwt-key-2026',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
