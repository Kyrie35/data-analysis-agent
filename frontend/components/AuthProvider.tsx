"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearAuth,
  fetchCloudPreferences,
  getAuth,
  loginAccount,
  pushCloudPreferences,
  registerAccount,
  type AuthUser,
} from "@/lib/auth";
import {
  loadGroups,
  loadPreferences,
  saveGroups,
  savePreferences,
  type PreferenceGroup,
  type PreferenceItem,
} from "@/lib/preferences";

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncPreferencesAfterLogin(): Promise<void> {
  const localPrefs = loadPreferences();
  const localGroups = loadGroups();
  const cloud = await fetchCloudPreferences();
  const cloudPrefs = Array.isArray(cloud.preferences) ? cloud.preferences : [];
  const cloudGroups = Array.isArray(cloud.groups) ? cloud.groups : [];

  if (cloudPrefs.length === 0 && cloudGroups.length === 0) {
    if (localPrefs.length > 0 || localGroups.length > 0) {
      await pushCloudPreferences({
        preferences: localPrefs,
        groups: localGroups,
      });
    }
    return;
  }

  savePreferences(cloudPrefs as PreferenceItem[]);
  saveGroups(cloudGroups as PreferenceGroup[]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getAuth()?.user ?? null);
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const state = await loginAccount(username, password);
    await syncPreferencesAfterLogin();
    setUser(state.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const state = await registerAccount(username, password);
    await syncPreferencesAfterLogin();
    setUser(state.user);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ ready, user, login, register, logout }),
    [ready, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
