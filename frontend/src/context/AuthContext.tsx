import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchCurrentUser,
  changePasswordRequest,
  deleteAccountRequest,
  loginUserRequest,
  registerUserRequest,
  setApiKey,
  type AuthResponse,
  type UserProfile,
} from '../api';

interface AuthContextValue {
  user: UserProfile | null;
  apiKey: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  refresh: () => Promise<UserProfile | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResponse>;
  deleteAccount: (password: string) => Promise<void>;
  updateUser: (updater: Partial<UserProfile> | ((prev: UserProfile | null) => UserProfile | null)) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'studyhistory:apiKey';

function persistApiKey(value: string | null) {
  if (value) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  setApiKey(value);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY);
    if (!storedKey) {
      setLoading(false);
      return;
    }
    persistApiKey(storedKey);
    setApiKeyState(storedKey);
    fetchCurrentUser()
      .then((profile) => {
        setUser(profile);
      })
      .catch(() => {
        persistApiKey(null);
        setApiKeyState(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const applyAuth = (response: AuthResponse) => {
    persistApiKey(response.api_key);
    setApiKeyState(response.api_key);
    setUser(response.user);
    return response;
  };

  const login = async (email: string, password: string) => {
    const response = await loginUserRequest({ email, password });
    return applyAuth(response);
  };

  const register = async (email: string, password: string) => {
    const response = await registerUserRequest({ email, password });
    return applyAuth(response);
  };

  const logout = () => {
    persistApiKey(null);
    setApiKeyState(null);
    setUser(null);
  };

  const refresh = async () => {
    if (!apiKey) {
      setUser(null);
      return null;
    }
    try {
      const profile = await fetchCurrentUser();
      setUser(profile);
      return profile;
    } catch (error) {
      logout();
      return null;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await changePasswordRequest({ current_password: currentPassword, new_password: newPassword });
    return applyAuth(response);
  };

  const deleteAccount = async (password: string) => {
    await deleteAccountRequest({ password });
    logout();
  };

  const updateUser = useCallback(
    (updater: Partial<UserProfile> | ((prev: UserProfile | null) => UserProfile | null)) => {
      setUser((prev) => {
        if (typeof updater === 'function') {
          return updater(prev);
        }
        if (!prev) {
          return prev;
        }
        return { ...prev, ...updater };
      });
    },
  []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, apiKey, loading, login, register, logout, refresh, changePassword, deleteAccount, updateUser }),
    [user, apiKey, loading, login, register, logout, refresh, changePassword, deleteAccount, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
