import { useAuth } from '../context/AuthContext';
import { googleAuthEnabled } from '../utils/auth';

export function useGoogleAuth() {
  const { loginWithGoogle } = useAuth();
  const isEnabled = googleAuthEnabled();

  return {
    isEnabled,
    loginWithGoogle,
  };
}
