import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../keys/public_key.pem'),
  jwtPrivateKeyPath: process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../../keys/private_key.pem'),
  sessionExpiryDays: parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10),
  
  // OCI
  ociConfigPath: process.env.OCI_CONFIG_PATH || path.join(__dirname, '../../SENSITIVE/oci/config/oci_config.json'),
  ociBucketName: process.env.OCI_BUCKET_NAME || 'groupguard-data',
  ociNamespace: process.env.OCI_NAMESPACE || '',
  
  // VRChat API (public endpoints only)
  vrchatApiBase: 'https://api.vrchat.cloud/api/1',
  
  // Rate Limiting
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100, // requests per window
  
  // Verification
  verificationCodeExpiryMs: 5 * 60 * 1000, // 5 minutes
};
