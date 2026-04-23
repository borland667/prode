/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshUser = async (providedToken) => {
    const token = providedToken || localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return null;
    }

    const response = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      localStorage.removeItem('token');
      setUser(null);
      return null;
    }

    const userData = await response.json();
    const nextUser = userData.user || userData;
    setUser(nextUser);
    return nextUser;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const url = new URL(window.location.href);
      const tokenFromQuery = url.searchParams.get('token');
      const pendingRedirect = sessionStorage.getItem('postAuthRedirect');

      if (tokenFromQuery) {
        localStorage.setItem('token', tokenFromQuery);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
      }

      const token = localStorage.getItem('token');
      if (token) {
        try {
          await refreshUser(token);
        } catch (err) {
          console.error('Auth check failed:', err);
          localStorage.removeItem('token');
        }
      }

      if (tokenFromQuery && pendingRedirect) {
        sessionStorage.removeItem('postAuthRedirect');
        window.location.replace(pendingRedirect);
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (name, email, password) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const loginWithGoogle = () => {
    window.location.href = '/api/auth/google';
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.error('Logout failed:', err);
    }

    localStorage.removeItem('token');
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, register, loginWithGoogle, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
