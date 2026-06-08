import { googleAuthEnabled } from '../utils/analytics';

/**
 * Hook to check if Google OAuth is enabled
 * Returns true if VITE_GOOGLE_CLIENT_ID is set in environment variables
 */
export function useGoogleAuth() {
  const enabled = googleAuthEnabled();

  return {
    enabled,
    /**
     * Check if Google OAuth is properly configured
     */
    isConfigured: enabled,
  };
}

export default useGoogleAuth;