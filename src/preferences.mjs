export const DISCOVERY_VISIBILITY_STORAGE_KEY = "maple-show-discovery-cultivars";

export function readDiscoveryVisibility(storage = globalThis.window?.localStorage) {
  if (!storage) {
    return false;
  }

  try {
    const raw = storage.getItem(DISCOVERY_VISIBILITY_STORAGE_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export function writeDiscoveryVisibility(enabled, storage = globalThis.window?.localStorage) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(DISCOVERY_VISIBILITY_STORAGE_KEY, enabled ? "1" : "0");
  } catch {}
}
