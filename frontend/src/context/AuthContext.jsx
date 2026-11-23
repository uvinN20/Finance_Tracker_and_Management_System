import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const normalizeUser = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = typeof value.id === 'string' ? value.id : typeof value._id === 'string' ? value._id : '';
  if (!id || typeof value.name !== 'string' || typeof value.email !== 'string') return null;

  const supportedCurrencies = ['LKR', 'USD', 'EUR', 'GBP', 'INR'];
  return {
    id,
    _id: id,
    name: value.name.slice(0, 100),
    email: value.email.slice(0, 254),
    currency: supportedCurrencies.includes(value.currency) ? value.currency : 'LKR',
    monthlyIncomeTarget:
      typeof value.monthlyIncomeTarget === 'number' && Number.isFinite(value.monthlyIncomeTarget)
        ? Math.max(value.monthlyIncomeTarget, 0)
        : 0,
  };
};

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? normalizeUser(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await api.get('/auth/me');
        const safeUser = normalizeUser(res.data?.user);
        if (!safeUser) throw new Error('Invalid user response');
        setUser(safeUser);
        localStorage.setItem('user', JSON.stringify(safeUser));
      } catch {
        setUser(null);
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } catch {
          // Storage can be unavailable in restricted browser contexts.
        }
      } finally {
        setLoading(false);
      }
    };
    void restoreSession();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const safeUser = normalizeUser(res.data?.user);
    if (typeof res.data?.token !== 'string' || !safeUser) throw new Error('Invalid login response');
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(safeUser));
    setUser(safeUser);
    return safeUser;
  };

  const register = async (name, email, password, currency) => {
    const res = await api.post('/auth/register', { name, email, password, currency });
    const safeUser = normalizeUser(res.data?.user);
    if (typeof res.data?.token !== 'string' || !safeUser) throw new Error('Invalid registration response');
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(safeUser));
    setUser(safeUser);
    return safeUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (updated) => {
    const safeUser = normalizeUser(updated);
    if (!safeUser) return;
    setUser(safeUser);
    localStorage.setItem('user', JSON.stringify(safeUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
