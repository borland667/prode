# Google OAuth Security Configuration

## Overview

This document describes the Google OAuth security configuration implemented in Prode to prevent unauthorized OAuth setup and ensure proper environment variable handling.

## Problem Statement

Previously, the Google OAuth login button would appear even when:
1. Google OAuth was not properly configured in the backend
2. Environment variables were missing or incomplete
3. Developers were running without OAuth credentials

This could lead to:
- Confusing user experience (button appears but doesn't work)
- Potential security confusion about OAuth state
- Difficulty distinguishing between "no OAuth configured" vs "OAuth configured but failed"

## Solution

The implementation adds proper frontend environment variable configuration and conditional rendering to ensure Google OAuth only appears when properly configured.

## Environment Variables

### Backend Configuration (Required for Google OAuth to work)

These environment variables are used by the Express backend:

- `GOOGLE_CLIENT_ID` - Your Google Cloud OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google Cloud OAuth Client Secret (MUST be kept secret!)
- `GOOGLE_CALLBACK_URL` - The callback URL registered with Google Cloud (e.g., `http://localhost:3001/api/auth/google/callback`)

**Important:** All three variables must be set together for Google OAuth to be enabled on the backend.

### Frontend Configuration (Optional, only needed to show the button)

- `VITE_GOOGLE_CLIENT_ID` - Your Google Cloud Client ID (can be public, NOT the secret)

**Important:** This only exposes the Client ID to the browser (not the secret). If not set, the Google login button will not appear.

## How It Works

### Backend (`api/app.cjs`)

The backend already checks for complete OAuth configuration:

```javascript
const GOOGLE_AUTH_CONFIGURED = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

if (GOOGLE_AUTH_PARTIALLY_CONFIGURED && !GOOGLE_AUTH_CONFIGURED) {
  console.warn(
    '[auth] Google OAuth is disabled because GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL must all be set together.'
  );
}
```

If `GOOGLE_AUTH_CONFIGURED` is false, the Google Passport strategy is not registered.

### Frontend (`src/utils/analytics.js`)

A new function `googleAuthEnabled()` checks for the frontend environment variable:

```javascript
export function googleAuthEnabled() {
  // Google OAuth is enabled on the frontend if the backend has proper configuration
  // We check for the presence of a non-empty environment variable
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}
```

### Conditional Rendering (`src/pages/Login.jsx` and `src/pages/Register.jsx`)

The Google login button is only rendered when OAuth is enabled:

```javascript
{googleAuthEnabled() && (
  <>
    <div className="app-divider">
      <span>{t('common.or')}</span>
    </div>

    <Button
      onClick={() => {
        sessionStorage.setItem('postAuthRedirect', redirectTo);
        loginWithGoogle();
      }}
      variant="secondary"
      block
    >
      {t('auth.loginGoogle')}
    </Button>
  </>
)}
```

## Usage

### Local Development (No OAuth)

If you don't have Google OAuth credentials:

1. Don't set any `GOOGLE_*` or `VITE_GOOGLE_*` environment variables
2. The Google login button will not appear
3. Email/password authentication will still work normally

### Local Development (With OAuth)

To test Google OAuth locally:

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. Set backend variables in `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
   ```
3. Set frontend variable:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
4. Run `npm run dev`
5. The Google login button should appear on login/register pages

### Production

For production deployment:

1. Create OAuth credentials for your production domain
2. Set backend variables in production environment:
   ```env
   GOOGLE_CLIENT_ID=production-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=production-client-secret
   GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback
   ```
3. Set frontend variable:
   ```env
   VITE_GOOGLE_CLIENT_ID=production-client-id.apps.googleusercontent.com
   ```
4. Ensure the exact callback URL is registered in Google Cloud Console
5. Deploy and test

## Security Considerations

1. **Backend Secret Protection**: `GOOGLE_CLIENT_SECRET` is NEVER exposed to the frontend. It's only used in the backend Express app.

2. **Frontend Client ID**: `VITE_GOOGLE_CLIENT_ID` is safe to expose because it's not a secret - it's just the public identifier for your OAuth app.

3. **Complete Configuration Check**: The backend will only enable Google OAuth if ALL three required variables are set.

4. **Explicit Control**: The frontend Google login button only appears when `VITE_GOOGLE_CLIENT_ID` is explicitly set.

5. **Environment Variable Naming**: Using `VITE_` prefix for frontend variables clearly indicates they're meant for client-side use.

## Migration Guide

### Before This Change

- Google login button could appear even without proper configuration
- Users might click it and see confusing errors
- No clear indication of OAuth configuration status

### After This Change

- Google login button only appears when properly configured
- Clear separation between backend and frontend configuration
- No button = no OAuth available (not a broken button)

### How to Get Back to Previous Behavior (Not Recommended)

If you want the old behavior where the button always appears:

```javascript
// In Login.jsx and Register.jsx, remove the conditional:
{googleAuthEnabled() && ( ... )}

// And replace with:
<>
  <div className="app-divider">
    <span>{t('common.or')}</span>
  </div>

  <Button onClick={loginWithGoogle} variant="secondary" block>
    {t('auth.loginGoogle')}
  </Button>
</>
```

But this is not recommended because it would show a button that doesn't work.

## Testing

To verify the Google OAuth security configuration:

1. **Without any Google OAuth variables set**: Google login button should NOT appear
2. **With only `VITE_GOOGLE_CLIENT_ID` set**: Button should appear, but backend will reject the request (backend has complete OAuth disabled)
3. **With complete backend config + `VITE_GOOGLE_CLIENT_ID`**: Both backend and frontend should work together

## Files Changed

1. `src/utils/analytics.js` - Added `googleAuthEnabled()` function
2. `src/pages/Login.jsx` - Conditionally render Google login button
3. `src/pages/Register.jsx` - Conditionally render Google signup button
4. `src/hooks/useGoogleAuth.ts` - Added TypeScript hook for Google OAuth state
5. `.env.example` - Added `VITE_GOOGLE_CLIENT_ID` documentation
6. `README.md` - Added Google OAuth configuration section
7. `AGENTS.md` - Added authentication security guidelines

## Future Improvements

Potential enhancements:

1. Add runtime check in `loginWithGoogle()` to show a user-friendly message if backend OAuth is disabled
2. Add admin UI to check OAuth configuration status
3. Add warnings in console if frontend variable is set but backend is missing
4. Consider implementing OAuth provider discovery for better UX