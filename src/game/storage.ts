import { DEFAULT_SAVE, DEFAULT_SETTINGS } from './data';
import { GameSettings, SaveProgress } from './types';

const SAVE_KEY = 'last_winter_k2_sim_save_v4';
const LEGACY_SAVE_KEY = 'last_winter_k2_sim_save_v3';
const SETTINGS_KEY = 'last_winter_k2_sim_settings_v4';
const LEGACY_SETTINGS_KEY = 'last_winter_k2_sim_settings_v3';
const IDB_NAME = 'last_winter_k2_storage';
const IDB_STORE = 'kv';

interface CapacitorPreferencesPlugin {
  get(opts: { key: string }): Promise<{ value: string | null }>;
  set(opts: { key: string; value: string }): Promise<void>;
  remove(opts: { key: string }): Promise<void>;
}

function getCapacitorPrefs(): CapacitorPreferencesPlugin | null {
  try {
    const cap = (window as unknown as { Capacitor?: { Plugins?: { Preferences?: CapacitorPreferencesPlugin } } }).Capacitor;
    return cap?.Plugins?.Preferences || null;
  } catch {
    return null;
  }
}

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function normalizeSaveProgress(raw: Partial<SaveProgress> | null | undefined): SaveProgress {
  if (!raw) return { ...DEFAULT_SAVE };
  return {
    ...DEFAULT_SAVE,
    ...raw,
    teamRoster: raw.teamRoster || DEFAULT_SAVE.teamRoster,
    gearUpgrades: {
      ...DEFAULT_SAVE.gearUpgrades,
      ...(raw.gearUpgrades || {}),
    },
    unlockedBadges: raw.unlockedBadges || [],
    unlockedOutfits: raw.unlockedOutfits || DEFAULT_SAVE.unlockedOutfits,
    expeditionPoints: raw.expeditionPoints ?? 0,
    completedMissions: raw.completedMissions || {},
    savedInventory: raw.savedInventory || {},
  };
}

export function normalizeSettings(raw: Partial<GameSettings> | null | undefined): GameSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    graphics: raw.graphics || DEFAULT_SETTINGS.graphics,
    hudMode: raw.hudMode || DEFAULT_SETTINGS.hudMode,
    cameraMode: raw.cameraMode || DEFAULT_SETTINGS.cameraMode,
    timeMode: raw.timeMode || DEFAULT_SETTINGS.timeMode,
    startTimePreset: raw.startTimePreset || DEFAULT_SETTINGS.startTimePreset,
  };
}

export function loadSaveSync(): SaveProgress {
  try {
    const raw =
      localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    return normalizeSaveProgress(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function loadSettingsSync(): GameSettings {
  try {
    const raw =
      localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function persistSave(save: SaveProgress): void {
  const serialized = JSON.stringify(save);
  try {
    localStorage.setItem(SAVE_KEY, serialized);
  } catch {
    // ignore quota error
  }
  void idbSet(SAVE_KEY, serialized);
  const capPrefs = getCapacitorPrefs();
  if (capPrefs) {
    void capPrefs.set({ key: SAVE_KEY, value: serialized }).catch(() => {});
  }
}

export function persistSettings(settings: GameSettings): void {
  const serialized = JSON.stringify(settings);
  try {
    localStorage.setItem(SETTINGS_KEY, serialized);
  } catch {
    // ignore quota error
  }
  void idbSet(SETTINGS_KEY, serialized);
  const capPrefs = getCapacitorPrefs();
  if (capPrefs) {
    void capPrefs.set({ key: SETTINGS_KEY, value: serialized }).catch(() => {});
  }
}

export async function hydrateAsyncStorage(): Promise<{
  save: SaveProgress | null;
  settings: GameSettings | null;
}> {
  const capPrefs = getCapacitorPrefs();
  let saveRaw: string | null = null;
  let settingsRaw: string | null = null;

  if (capPrefs) {
    try {
      const s = await capPrefs.get({ key: SAVE_KEY });
      const cfg = await capPrefs.get({ key: SETTINGS_KEY });
      saveRaw = s.value;
      settingsRaw = cfg.value;
    } catch {
      // ignore
    }
  }

  if (!saveRaw) saveRaw = await idbGet(SAVE_KEY);
  if (!settingsRaw) settingsRaw = await idbGet(SETTINGS_KEY);

  let save: SaveProgress | null = null;
  let settings: GameSettings | null = null;
  try {
    if (saveRaw && !localStorage.getItem(SAVE_KEY)) {
      localStorage.setItem(SAVE_KEY, saveRaw);
      save = normalizeSaveProgress(JSON.parse(saveRaw));
    }
  } catch {
    save = null;
  }
  try {
    if (settingsRaw && !localStorage.getItem(SETTINGS_KEY)) {
      localStorage.setItem(SETTINGS_KEY, settingsRaw);
      settings = normalizeSettings(JSON.parse(settingsRaw));
    }
  } catch {
    settings = null;
  }
  return { save, settings };
}
