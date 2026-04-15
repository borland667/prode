# Migration Path: Auth.js → Keycloak

## Current Architecture (Phase 1)
- **Auth Library:** Custom JWT + Passport.js
- **Providers:** Google OAuth 2.0 (direct), email/password (bcrypt)
- **Session:** JWT tokens stored in HTTP-only cookies + Authorization header
- **Database:** User table with `googleId`, `email`, `password` fields

## Target Architecture (Phase 2 - Kubernetes)
- **Identity Provider:** Keycloak (self-hosted on K8s)
- **Auth Library:** Same JWT verification, Keycloak issues tokens
- **Providers:** Keycloak brokers all social logins (Google, GitHub, Facebook, etc.)
- **Session:** OIDC tokens from Keycloak

---

## Step-by-Step Migration

### 1. Deploy Keycloak on Kubernetes

```yaml
# keycloak-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
spec:
  replicas: 1
  selector:
    matchLabels:
      app: keycloak
  template:
    metadata:
      labels:
        app: keycloak
    spec:
      containers:
        - name: keycloak
          image: quay.io/keycloak/keycloak:latest
          args: ["start-dev"]
          env:
            - name: KEYCLOAK_ADMIN
              value: admin
            - name: KEYCLOAK_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: keycloak-secrets
                  key: admin-password
            - name: KC_DB
              value: postgres
            - name: KC_DB_URL
              value: jdbc:postgresql://postgres-service:5432/keycloak
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: keycloak-service
spec:
  selector:
    app: keycloak
  ports:
    - port: 8080
      targetPort: 8080
  type: ClusterIP
```

### 2. Configure Keycloak Realm

1. Create a new realm: `prode`
2. Create a client: `prode-app`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `https://your-domain.com/*`
   - Web Origins: `https://your-domain.com`
3. Configure Identity Providers:
   - Add Google as an Identity Provider
   - Add any other social providers (GitHub, Facebook, etc.)
4. Import existing users (see step 4)

### 3. Update API Configuration

Replace the Passport.js Google strategy with Keycloak OIDC verification:

**Before (current):**
```javascript
// api/app.js
const GoogleStrategy = require('passport-google-oauth20').Strategy;
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  // find or create user
}));
```

**After (Keycloak):**
```javascript
// api/app.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: `${process.env.KEYCLOAK_URL}/realms/prode/protocol/openid-connect/certs`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Updated token verification middleware
function verifyToken(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, getKey, {
    algorithms: ['RS256'],
    issuer: `${process.env.KEYCLOAK_URL}/realms/prode`,
    audience: 'prode-app',
  }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.preferred_username,
      roles: decoded.realm_access?.roles || [],
    };
    next();
  });
}
```

### 4. Migrate Existing Users

```javascript
// scripts/migrate-users-to-keycloak.js
const prisma = require('../api/db');

async function migrateUsers() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Use Keycloak Admin REST API to create users
    const response = await fetch(
      `${KEYCLOAK_URL}/admin/realms/prode/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          username: user.email,
          email: user.email,
          firstName: user.name?.split(' ')[0],
          lastName: user.name?.split(' ').slice(1).join(' '),
          enabled: true,
          emailVerified: true,
          // If user had Google login, link the identity provider
          ...(user.googleId && {
            federatedIdentities: [{
              identityProvider: 'google',
              userId: user.googleId,
              userName: user.email,
            }],
          }),
        }),
      }
    );

    console.log(`Migrated: ${user.email}`);
  }
}
```

### 5. Update Environment Variables

**Before:**
```env
JWT_SECRET=your-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
```

**After:**
```env
KEYCLOAK_URL=https://keycloak.your-domain.com
KEYCLOAK_REALM=prode
KEYCLOAK_CLIENT_ID=prode-app
KEYCLOAK_CLIENT_SECRET=...
```

### 6. Update Frontend

Replace the direct Google OAuth redirect with Keycloak's authorization endpoint:

```javascript
// Before
const loginWithGoogle = () => {
  window.location.href = '/api/auth/google';
};

// After
const loginWithGoogle = () => {
  const params = new URLSearchParams({
    client_id: 'prode-app',
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: 'code',
    scope: 'openid profile email',
    kc_idp_hint: 'google', // Skip Keycloak login page, go straight to Google
  });
  window.location.href = `${KEYCLOAK_URL}/realms/prode/protocol/openid-connect/auth?${params}`;
};

// Generic login (Keycloak login page with all providers)
const login = () => {
  const params = new URLSearchParams({
    client_id: 'prode-app',
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: 'code',
    scope: 'openid profile email',
  });
  window.location.href = `${KEYCLOAK_URL}/realms/prode/protocol/openid-connect/auth?${params}`;
};
```

### 7. Kubernetes Deployment for the API

```yaml
# prode-api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prode-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: prode-api
  template:
    metadata:
      labels:
        app: prode-api
    spec:
      containers:
        - name: api
          image: your-registry/prode-api:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: prode-secrets
                  key: database-url
            - name: KEYCLOAK_URL
              value: http://keycloak-service:8080
            - name: KEYCLOAK_REALM
              value: prode
            - name: KEYCLOAK_CLIENT_ID
              value: prode-app
```

---

## Summary of Changes

| Component | Phase 1 (Current) | Phase 2 (Keycloak) |
|-----------|-------------------|---------------------|
| Auth Provider | Passport.js + custom JWT | Keycloak OIDC |
| Google Login | Direct OAuth2 | Keycloak Identity Brokering |
| Token Format | Custom JWT (HS256) | Keycloak JWT (RS256) |
| User Storage | Postgres (Prisma) | Keycloak + Postgres |
| Session | Cookie + Bearer | OIDC tokens |
| Hosting | Netlify Functions | Kubernetes pods |
| Database | Neon Postgres | Self-hosted / RDS Postgres |

## Benefits of Migration
- **Single Sign-On (SSO)** across all your apps
- **Centralized user management** via Keycloak admin console
- **Easy addition of new social providers** without code changes
- **RBAC and fine-grained permissions** built into Keycloak
- **Standards-compliant** OIDC/SAML support
- **Self-hosted** — full data ownership
