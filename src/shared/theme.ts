import type { PreferencesV2 } from "./types";

export function applyPreferencesToDocument(preferences: PreferencesV2): void {
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.density = preferences.density;
}
