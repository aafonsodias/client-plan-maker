export type InterfaceMode = "quick" | "lab";

const KEY = "forge.interface_mode";

export function isInterfaceMode(v: unknown): v is InterfaceMode {
  return v === "quick" || v === "lab";
}

export function getStoredInterfaceMode(): InterfaceMode {
  if (typeof window === "undefined") return "quick";
  try {
    const v = window.localStorage.getItem(KEY);
    return isInterfaceMode(v) ? v : "quick";
  } catch {
    return "quick";
  }
}

export function setStoredInterfaceMode(mode: InterfaceMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* private mode / quota → silent */
  }
}