export type PreferenceGroup = {
  id: string;
  name: string;
  updatedAt: string;
};

export type PreferenceItem = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  groupId: string | null;
  updatedAt: string;
};

export type PreferencePayload = {
  title: string;
  content: string;
};

export const PREFERENCES_STORAGE_KEY = "da-agent-preferences";
export const GROUPS_STORAGE_KEY = "da-agent-preference-groups";
export const MAX_PREFERENCES = 100;
export const MAX_GROUPS = 30;
export const MAX_PREFERENCES_PER_REQUEST = 5;
export const MAX_CONTENT_LENGTH = 300;
export const MAX_TITLE_LENGTH = 80;
export const MAX_GROUP_NAME_LENGTH = 40;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadPreferences(): PreferenceItem[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PreferenceItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.content === "string",
      )
      .map((item) => ({
        id: item.id,
        title: item.title.slice(0, MAX_TITLE_LENGTH),
        content: item.content.slice(0, MAX_CONTENT_LENGTH),
        enabled: Boolean(item.enabled),
        groupId:
          typeof item.groupId === "string" && item.groupId
            ? item.groupId
            : null,
        updatedAt:
          typeof item.updatedAt === "string"
            ? item.updatedAt
            : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function savePreferences(items: PreferenceItem[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    PREFERENCES_STORAGE_KEY,
    JSON.stringify(items.slice(0, MAX_PREFERENCES)),
  );
}

export function loadGroups(): PreferenceGroup[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PreferenceGroup[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item && typeof item.id === "string" && typeof item.name === "string",
      )
      .map((item) => ({
        id: item.id,
        name: item.name.slice(0, MAX_GROUP_NAME_LENGTH) || "未命名分组",
        updatedAt:
          typeof item.updatedAt === "string"
            ? item.updatedAt
            : new Date().toISOString(),
      }))
      .slice(0, MAX_GROUPS);
  } catch {
    return [];
  }
}

export function saveGroups(groups: PreferenceGroup[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    GROUPS_STORAGE_KEY,
    JSON.stringify(groups.slice(0, MAX_GROUPS)),
  );
}

export function createGroup(name: string): PreferenceGroup {
  return {
    id: createId(),
    name: name.trim().slice(0, MAX_GROUP_NAME_LENGTH) || "未命名分组",
    updatedAt: new Date().toISOString(),
  };
}

export function createPreference(
  title: string,
  content: string,
  enabled = true,
  groupId: string | null = null,
): PreferenceItem {
  return {
    id: createId(),
    title: title.trim().slice(0, MAX_TITLE_LENGTH) || "未命名偏好",
    content: content.trim().slice(0, MAX_CONTENT_LENGTH),
    enabled,
    groupId,
    updatedAt: new Date().toISOString(),
  };
}

export function toPreferencePayloads(
  items: PreferenceItem[],
): PreferencePayload[] {
  return items
    .filter((item) => item.content.trim())
    .slice(0, MAX_PREFERENCES_PER_REQUEST)
    .map((item) => ({
      title: item.title.trim().slice(0, MAX_TITLE_LENGTH) || "未命名偏好",
      content: item.content.trim().slice(0, MAX_CONTENT_LENGTH),
    }));
}

export function filterPreferencesByTitle(
  items: PreferenceItem[],
  query: string,
): PreferenceItem[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return items;
  return items.filter((item) => item.title.toLowerCase().includes(keyword));
}

export function filterPreferencesByGroup(
  items: PreferenceItem[],
  groupId: string | "all" | "ungrouped",
): PreferenceItem[] {
  if (groupId === "all") return items;
  if (groupId === "ungrouped") {
    return items.filter((item) => !item.groupId);
  }
  return items.filter((item) => item.groupId === groupId);
}

export function getGroupName(
  groups: PreferenceGroup[],
  groupId: string | null,
): string {
  if (!groupId) return "未分组";
  return groups.find((group) => group.id === groupId)?.name ?? "未分组";
}
