const HISTORY_RESULT_KEY = "da-agent-history-result";

export function stashHistoryResult(result: unknown): void {
  window.sessionStorage.setItem(HISTORY_RESULT_KEY, JSON.stringify(result));
}

export function takeHistoryResult<T>(): T | null {
  const raw = window.sessionStorage.getItem(HISTORY_RESULT_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(HISTORY_RESULT_KEY);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
