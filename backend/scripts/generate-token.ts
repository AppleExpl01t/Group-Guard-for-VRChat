import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Token Generation Script for GroupGuard Cloud
 * 
 * Usage: npm run generate-token -- --userId usr_xxx --displayName "User Name" --tier personal
 * 
 * This script is for DEV USE ONLY to issue access tokens to users.
 */

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
}

const userId = getArg('userId');
const displayName = getArg('displayName') || 'User';
const tier = (getArg('tier') || 'personal') as 'personal' | 'pro' | 'team';
const expiryDays = parseInt(getArg('expiryDays') || '365', 10);
const teamIds = getArg('teamIds')?.split(',') || [];

if (!userId) {
  console.error('Usage: npm run generate-token -- --userId usr_xxx --displayName "Name" --tier personal');
  console.error('');
  console.error('Required:');
  console.error('  --userId       VRChat User ID (e.g., usr_abc123)');
  console.error('');
  console.error('Optional:');
  console.error('  --displayName  Display name for the user');
  console.error('  --tier         Tier level: personal, pro, team (default: personal)');
  console.error('  --expiryDays   Token expiry in days (default: 365)');
  console.error('  --teamIds      Comma-separated team IDs for team tier');
  process.exit(1);
}

// Load private key
const keyPath = path.join(__dirname, '../keys/private_key.pem');
let privateKey: string;

try {
  privateKey = fs.readFileSync(keyPath, 'utf8');
} catch {
  console.error('❌ Private key not found at:', keyPath);
  console.error('   Generate keys first with: openssl genpkey -algorithm RSA -out keys/private_key.pem');
  process.exit(1);
}

// Create token payload
const payload = {
  sub: userId,
  displayName,
  tier,
  teamIds: teamIds.length > 0 ? teamIds : undefined,
  iss: 'groupguard',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60),
  jti: uuidv4(), // Unique token ID
};

// Sign the token
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('                 GroupGuard Access Token Generated             ');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('User ID:      ', userId);
console.log('Display Name: ', displayName);
console.log('Tier:         ', tier);
console.log('Expires:      ', new Date(payload.exp * 1000).toISOString());
if (teamIds.length > 0) {
  console.log('Teams:        ', teamIds.join(', '));
}
console.log('');
console.log('───────────────────────────────────────────────────────────────');
console.log('ACCESS TOKEN (send this to the user):');
console.log('───────────────────────────────────────────────────────────────');
console.log('');
console.log(token);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
