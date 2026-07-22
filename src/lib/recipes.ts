import type { SeedConfig } from "@/types";

// ─── Saved recipes (localStorage) ─────────────────────────────────────────────

const KEY = "seedling.recipes.v1";

export interface SavedRecipe {
  name: string;
  cfg: SeedConfig;
  savedAt: number;
}

export function loadRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((r) => r?.name && r?.cfg) : [];
  } catch {
    return [];
  }
}

export function saveRecipe(name: string, cfg: SeedConfig): SavedRecipe[] {
  const recipes = loadRecipes().filter((r) => r.name !== name);
  recipes.unshift({ name, cfg, savedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(recipes.slice(0, 12)));
  return loadRecipes();
}

export function deleteRecipe(name: string): SavedRecipe[] {
  localStorage.setItem(KEY, JSON.stringify(loadRecipes().filter((r) => r.name !== name)));
  return loadRecipes();
}

// ─── Shareable URLs (#r=base64url(config)) ────────────────────────────────────

function b64urlEncode(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)));
}

export function shareUrl(cfg: SeedConfig): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#r=${b64urlEncode(JSON.stringify(cfg))}`;
}

export function configFromHash(): SeedConfig | null {
  const m = window.location.hash.match(/#r=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const obj = JSON.parse(b64urlDecode(m[1]));
    if (obj && typeof obj === "object" && obj.scenario && obj.domain && typeof obj.seed === "number") {
      return obj as SeedConfig;
    }
  } catch {
    /* ignore malformed share links */
  }
  return null;
}

// ─── Live-push records (for sandbox cleanup) ──────────────────────────────────

const PUSH_KEY = "seedling.pushes.v1";

export interface PushRecord {
  id: string;
  at: number;
  site: string;
  projectKeys: string[];
  issueKeys: string[];
  issueCount: number;
  commentCount: number;
}

export function loadPushRecords(): PushRecord[] {
  try {
    const raw = localStorage.getItem(PUSH_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((r) => r?.id && Array.isArray(r?.projectKeys)) : [];
  } catch {
    return [];
  }
}

export function addPushRecord(rec: PushRecord): PushRecord[] {
  const all = loadPushRecords().filter((r) => r.id !== rec.id);
  all.unshift(rec);
  localStorage.setItem(PUSH_KEY, JSON.stringify(all.slice(0, 10)));
  return loadPushRecords();
}

export function removePushRecord(id: string): PushRecord[] {
  localStorage.setItem(PUSH_KEY, JSON.stringify(loadPushRecords().filter((r) => r.id !== id)));
  return loadPushRecords();
}
