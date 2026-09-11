export interface JournalSettings {
  capital: number; // ยอดทุนเริ่มต้น
  riskPercent: number; // ความเสี่ยง default ต่อเทรด (%)
}

const KEY = "trade-journal-settings";

export function loadSettings(): Partial<JournalSettings> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Partial<JournalSettings>;
  } catch {
    return {};
  }
}

export function saveSettings(settings: JournalSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("tj-settings-changed"));
}
