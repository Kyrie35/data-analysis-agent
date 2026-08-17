export type AuthUser = {
  id: number;
  username: string;
};

export type AuthState = {
  token: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "da-agent-auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed?.token || !parsed?.user?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAuth(state: AuthState): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearAuth(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function authHeaders(): HeadersInit {
  const auth = getAuth();
  if (!auth?.token) return {};
  return { Authorization: `Bearer ${auth.token}` };
}

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export async function registerAccount(
  username: string,
  password: string,
): Promise<AuthState> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "注册失败"));
  }
  const data = (await response.json()) as {
    access_token: string;
    user: AuthUser;
  };
  const state = { token: data.access_token, user: data.user };
  setAuth(state);
  return state;
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<AuthState> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "登录失败"));
  }
  const data = (await response.json()) as {
    access_token: string;
    user: AuthUser;
  };
  const state = { token: data.access_token, user: data.user };
  setAuth(state);
  return state;
}

export async function fetchMe(): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "获取用户失败"));
  }
  return response.json() as Promise<AuthUser>;
}

export type HistoryListItem = {
  id: number;
  title: string;
  filename: string;
  summary: string;
  created_at: string;
};

export async function listHistory(): Promise<HistoryListItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/history`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "加载历史失败"));
  }
  return response.json() as Promise<HistoryListItem[]>;
}

export async function getHistory(id: number): Promise<{
  id: number;
  title: string;
  filename: string;
  summary: string;
  created_at: string;
  result: unknown;
}> {
  const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "加载历史详情失败"));
  }
  return response.json();
}

export async function saveHistory(
  result: unknown,
  title?: string,
): Promise<HistoryListItem> {
  const response = await fetch(`${API_BASE_URL}/api/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ result, title }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "保存历史失败"));
  }
  return response.json() as Promise<HistoryListItem>;
}

export async function deleteHistory(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "删除历史失败"));
  }
}

export async function fetchCloudPreferences(): Promise<{
  preferences: unknown[];
  groups: unknown[];
  query_preferences: unknown[];
  query_groups: unknown[];
  updated_at: string | null;
}> {
  const response = await fetch(`${API_BASE_URL}/api/preferences`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "拉取云端偏好失败"));
  }
  const data = (await response.json()) as {
    preferences?: unknown[];
    groups?: unknown[];
    query_preferences?: unknown[];
    query_groups?: unknown[];
    updated_at: string | null;
  };
  return {
    preferences: Array.isArray(data.preferences) ? data.preferences : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
    query_preferences: Array.isArray(data.query_preferences)
      ? data.query_preferences
      : [],
    query_groups: Array.isArray(data.query_groups) ? data.query_groups : [],
    updated_at: data.updated_at,
  };
}

export async function pushCloudPreferences(payload: {
  preferences: unknown[];
  groups: unknown[];
  query_preferences?: unknown[];
  query_groups?: unknown[];
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      preferences: payload.preferences,
      groups: payload.groups,
      query_preferences: payload.query_preferences ?? [],
      query_groups: payload.query_groups ?? [],
    }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "同步云端偏好失败"));
  }
}
