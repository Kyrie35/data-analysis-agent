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
  const localReportPrefs = loadPreferences("report");
  const localReportGroups = loadGroups("report");
  const localQueryPrefs = loadPreferences("query");
  const localQueryGroups = loadGroups("query");

  const cloud = await fetchCloudPreferences();
  const cloudReportPrefs = cloud.preferences;
  const cloudReportGroups = cloud.groups;
  const cloudQueryPrefs = cloud.query_preferences;
  const cloudQueryGroups = cloud.query_groups;

  const cloudEmpty =
    cloudReportPrefs.length === 0 &&
    cloudReportGroups.length === 0 &&
    cloudQueryPrefs.length === 0 &&
    cloudQueryGroups.length === 0;

  const localHasAny =
    localReportPrefs.length > 0 ||
    localReportGroups.length > 0 ||
    localQueryPrefs.length > 0 ||
    localQueryGroups.length > 0;

  if (cloudEmpty) {
    if (localHasAny) {
      await pushCloudPreferences({
        preferences: localReportPrefs,
        groups: localReportGroups,
        query_preferences: localQueryPrefs,
        query_groups: localQueryGroups,
      });
    }
    return;
  }

  savePreferences(cloudReportPrefs as PreferenceItem[], "report");
  saveGroups(cloudReportGroups as PreferenceGroup[], "report");
  savePreferences(cloudQueryPrefs as PreferenceItem[], "query");
  saveGroups(cloudQueryGroups as PreferenceGroup[], "query");
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
