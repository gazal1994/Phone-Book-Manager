import * as XLSX from 'xlsx';

export interface RawCallRow {
  phone: string;
  duration: string;
  datetime: string;   // e.g. "24/04/2026 18:32" or "2026-01-24T20:54:33"
}

/**
 * Converts an Excel time serial (fraction of a day) to HH:MM:SS string.
 * e.g. 0.000150... (13 seconds) -> "00:00:13"
 */
function excelSerialToTimeString(serial: number): string {
  const totalSeconds = Math.round(serial * 86400);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Normalise a raw cell value to a trimmed string.
 * Handles strings, numbers (Excel time serials), Date objects.
 */
function cellToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (value > 0 && value < 1) return excelSerialToTimeString(value);
    return String(value);
  }
  if (value instanceof Date) {
    const h = value.getUTCHours();
    const m = value.getUTCMinutes();
    const s = value.getUTCSeconds();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return String(value).trim();
}

/** Format a Date object as "DD/MM/YYYY HH:MM:SS" for datetime cells. */
function dateToDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/** Extract a datetime string from a raw cell, preserving date+time together. */
function cellToDatetimeString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return dateToDatetimeString(value);
  if (typeof value === 'number') {
    // Excel date serial (days since 1900): convert to date
    if (value > 1) {
      const d = XLSX.SSF.parse_date_code(value);
      if (d) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.d)}/${pad(d.m)}/${d.y} ${pad(d.H)}:${pad(d.M)}:${pad(d.S)}`;
      }
    }
    return String(value);
  }
  return String(value).trim();
}

export interface XLSXReadResult {
  rows: RawCallRow[];
  debugRows: string[][];  // first 5 raw rows for diagnostics
  phoneCol: number;
  durationCol: number;
  dataStartRow: number;
}

export function readXLSXCallFile(file: File): Promise<XLSXReadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // raw:false → SheetJS formats every cell as its display string (handles time serials, dates, numbers)
        const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

        // --- Strategy 1: detect columns from Hebrew headers ---
        // Phone:    "עם מי דיברתי?" = "Who did I speak with?"
        // Duration: "כמה זמן?" (January) | "זמן שיחה" (April+)
        // Datetime: "שעת שיחה" = "Call time"
        let phoneCol = -1;
        let durationCol = -1;
        let datetimeCol = 0; // default column 0
        let dataStartRow = 0;

        const strip = (v: unknown) =>
          typeof v === 'string' ? v.replace(/[\u200f\u200e]/g, '') : '';
        const isPhoneHeader = (v: unknown) => strip(v).includes('עם מי דיברתי');
        const isDurationHeader = (v: unknown) =>
          strip(v).includes('כמה זמן') || strip(v).includes('זמן שיחה');
        const isDatetimeHeader = (v: unknown) => strip(v).includes('שעת שיחה');

        for (let i = 0; i < Math.min(raw.length, 6); i++) {
          const row = raw[i] as unknown[];
          if (!row) continue;
          const pIdx = row.findIndex(isPhoneHeader);
          const dIdx = row.findIndex(isDurationHeader);
          if (pIdx !== -1 && dIdx !== -1) {
            phoneCol = pIdx;
            durationCol = dIdx;
            dataStartRow = i + 1;
            const dtIdx = row.findIndex(isDatetimeHeader);
            if (dtIdx !== -1) datetimeCol = dtIdx;
            break;
          }
        }

        // --- Strategy 2: scan data rows to find columns by data pattern ---
        // Phone: 7+ digits after stripping dashes/spaces
        // Duration: MM:SS or HH:MM:SS
        // Datetime: contains date pattern DD/MM/YYYY or YYYY-MM-DD
        if (phoneCol === -1) {
          const DURATION_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;
          const DATE_RE = /\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/;
          const isPhone = (v: string) => /\d{7,}/.test(v.replace(/[\s\-().]/g, ''));
          const isDuration = (v: string) => DURATION_RE.test(v.trim());
          const isDatetime = (v: string) => DATE_RE.test(v);

          outer: for (let startRow = 1; startRow <= Math.min(raw.length - 1, 5); startRow++) {
            const sampleRows = raw.slice(startRow, startRow + 10) as unknown[][];
            const colCount = Math.max(...sampleRows.map((r) => r?.length ?? 0));
            for (let col = 0; col < colCount; col++) {
              const vals = sampleRows.map((r) => cellToString(r?.[col]));
              const phoneMatches = vals.filter((v) => isPhone(v)).length;
              if (phoneMatches >= Math.min(5, sampleRows.length)) {
                for (let dc = 0; dc < colCount; dc++) {
                  if (dc === col) continue;
                  const dVals = sampleRows.map((r) => cellToString(r?.[dc]));
                  const durMatches = dVals.filter((v) => isDuration(v)).length;
                  if (durMatches >= Math.min(5, sampleRows.length)) {
                    phoneCol = col;
                    durationCol = dc;
                    dataStartRow = startRow;
                    // Try to find a datetime column
                    for (let dtc = 0; dtc < colCount; dtc++) {
                      if (dtc === col || dtc === dc) continue;
                      const dtVals = sampleRows.map((r) => cellToString(r?.[dtc]));
                      if (dtVals.filter((v) => isDatetime(v)).length >= Math.min(3, sampleRows.length)) {
                        datetimeCol = dtc;
                        break;
                      }
                    }
                    break outer;
                  }
                }
              }
            }
          }
        }

        // --- Last resort fallback: Python's hard-coded layout (skip 2 rows, col 2 & 3) ---
        if (phoneCol === -1) {
          phoneCol = 2;
          durationCol = 3;
          dataStartRow = 2;
        }

        const rows: RawCallRow[] = [];
        for (let i = dataStartRow; i < raw.length; i++) {
          const row = raw[i] as unknown[];
          if (!row || row.length <= Math.max(phoneCol, durationCol)) continue;
          const phone = cellToString(row[phoneCol]);
          const duration = cellToString(row[durationCol]);
          const datetime = cellToDatetimeString(row[datetimeCol] ?? row[0]);
          const normPhone = phone.replace(/[\s\-().]/g, '');
          if (normPhone && duration && /\d{7,}/.test(normPhone)) {
            rows.push({ phone: normPhone, duration, datetime });
          }
        }

        // Capture first 5 raw rows as strings for diagnostics
        const debugRows = raw.slice(0, 5).map((r) =>
          (r as unknown[]).map((v) => cellToString(v))
        );

        resolve({ rows, debugRows, phoneCol, durationCol, dataStartRow });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function readCSVCallFile(file: File): Promise<RawCallRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string;
        const wb = XLSX.read(text, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: '',
        });

        const rows: RawCallRow[] = raw
          .map((row) => {
            const phoneKey = Object.keys(row).find((k) =>
              ['phone', 'phone_number', 'number', 'phonenumber'].includes(k.toLowerCase().trim())
            );
            const durationKey = Object.keys(row).find((k) =>
              ['duration', 'time', 'call_duration'].includes(k.toLowerCase().trim())
            );
            if (!phoneKey || !durationKey) return null;
            const datetimeKey = Object.keys(row).find((k) =>
              ['date', 'datetime', 'time', 'timestamp'].includes(k.toLowerCase().trim())
            );
            return {
              phone: cellToString(row[phoneKey]),
              duration: cellToString(row[durationKey]),
              datetime: datetimeKey ? cellToString(row[datetimeKey]) : '',
            };
          })
          .filter((r): r is RawCallRow => r !== null && r.phone !== '' && r.duration !== '');
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file, 'ISO-8859-1');
  });
}

export interface IndividualCall {
  datetime: string;
  duration: string;
  isLate: boolean;   // call started at or after 21:00
}

export interface SummaryRow {
  phone: string;
  name: string;
  call_count: number;
  total_duration: string;
  calls: IndividualCall[];
  hasLateCall: boolean;
}

export function exportSummaryXLSX(rows: SummaryRow[], sourceFileName?: string): void {
  const data = rows.map((r) => ({
    Phone: r.phone,
    Name: r.name,
    'Call Count': r.call_count,
    'Total Duration': r.total_duration,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');

  let outputName = 'summary.xlsx';
  if (sourceFileName) {
    // Strip extension from source file name and append " - summary.xlsx"
    const base = sourceFileName.replace(/\.[^/.]+$/, '');
    outputName = `${base} - summary.xlsx`;
  }
  XLSX.writeFile(wb, outputName);
}
