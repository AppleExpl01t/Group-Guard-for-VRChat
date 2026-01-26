# GroupGuard Backend

Cloud backend for GroupGuard - handles authentication, backup storage, and sync.

## Setup

```bash
cd backend
npm install
```

## Generate JWT Keys

```bash
# Create keys directory
mkdir -p keys

# Generate private key
openssl genpkey -algorithm RSA -out keys/private_key.pem -pkeyopt rsa_keygen_bits:2048

# Extract public key
openssl rsa -pubout -in keys/private_key.pem -out keys/public_key.pem
```

⚠️ **IMPORTANT**: Move `private_key.pem` to `SENSITIVE/jwt/` and keep it secret!

## Development

```bash
npm run dev
```

## Generate Access Tokens

```bash
npm run generate-token -- --userId usr_abc123 --displayName "UserName" --tier personal
```

## API Endpoints

### Auth

- `POST /api/v1/auth/activate` - Start activation (get verification code)
- `POST /api/v1/auth/verify` - Complete verification (check VRChat status)
- `POST /api/v1/auth/refresh` - Refresh session
- `GET /api/v1/auth/status` - Check session status

### Backup

- `POST /api/v1/backup` - Create backup
- `GET /api/v1/backups` - List backups
- `GET /api/v1/backup/:id` - Download backup
- `DELETE /api/v1/backup/:id` - Delete backup
