import type { SummaryRow } from './xlsxUtils';

export const HISTORY_KEY = 'call_summary_history';
export const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  processedAt: string;   // ISO timestamp
  summary: SummaryRow[];
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as HistoryEntry[];
  } catch {
    // ignore
  }
  return [];
}

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // ignore quota
  }
}
