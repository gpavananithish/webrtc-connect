import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(api.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          api.setToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    api.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
    return res;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    api.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    const res = await api.updateProfile(profileData);
    setUser(res.user);
    return res.user;
  };

  const updateStatus = async (status) => {
    const res = await api.updateProfile({ status });
    setUser(res.user);
    return res.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        updateStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
