import type { Contact } from './csvUtils';
import type { RawCallRow, SummaryRow, IndividualCall } from './xlsxUtils';

function parseDuration(durationStr: string): number {
  try {
    const parts = durationStr.trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } catch {
    // ignore
  }
  return 0;
}

function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Extract the hour (0–23) from a datetime string.
 * Handles "DD/MM/YYYY HH:MM:SS", "DD/MM/YYYY HH:MM", and ISO "YYYY-MM-DDTHH:MM:SS".
 */
function extractHour(datetime: string): number {
  if (!datetime) return -1;
  // ISO format: "2026-01-24T20:54:33"
  const isoMatch = datetime.match(/T(\d{2}):/);
  if (isoMatch) return parseInt(isoMatch[1], 10);
  // "DD/MM/YYYY HH:MM" or "DD/MM/YYYY HH:MM:SS"
  const spaceMatch = datetime.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}):/);
  if (spaceMatch) return parseInt(spaceMatch[1], 10);
  // Generic: grab the first HH:MM pattern after any date part
  const timeMatch = datetime.match(/(\d{2}):(\d{2})(?::\d{2})?/g);
  if (timeMatch && timeMatch.length > 0) {
    const parts = timeMatch[timeMatch.length - 1].split(':');
    return parseInt(parts[0], 10);
  }
  return -1;
}

export function summarizeCalls(
  rows: RawCallRow[],
  phoneBook: Contact[]
): SummaryRow[] {
  // Aggregate by phone
  const map = new Map<string, { totalSeconds: number; calls: IndividualCall[] }>();

  for (const row of rows) {
    const phone = row.phone.trim();
    if (!phone) continue;
    const seconds = parseDuration(row.duration);
    const hour = extractHour(row.datetime);
    const isLate = hour >= 21;

    const individualCall: IndividualCall = {
      datetime: row.datetime,
      duration: row.duration,
      isLate,
    };

    const existing = map.get(phone) ?? { totalSeconds: 0, calls: [] };
    existing.totalSeconds += seconds;
    existing.calls.push(individualCall);
    map.set(phone, existing);
  }

  // Build phone book lookup (strip leading zeros for fuzzy match)
  const bookMap = new Map<string, string>();
  const bookMapStripped = new Map<string, string>();
  for (const contact of phoneBook) {
    if (contact.phone) {
      bookMap.set(contact.phone.trim(), contact.name);
      bookMapStripped.set(contact.phone.trim().replace(/^0+/, ''), contact.name);
    }
  }

  const summary: SummaryRow[] = [];
  for (const [phone, agg] of map.entries()) {
    let name = bookMap.get(phone) ?? '';
    if (!name) name = bookMapStripped.get(phone.replace(/^0+/, '')) ?? '';

    // Sort individual calls: most recent first (by datetime string desc)
    const sortedCalls = [...agg.calls].sort((a, b) =>
      b.datetime.localeCompare(a.datetime)
    );

    const hasLateCall = sortedCalls.some((c) => c.isLate);

    summary.push({
      phone,
      name,
      call_count: agg.calls.length,
      total_duration: formatSeconds(agg.totalSeconds),
      calls: sortedCalls,
      hasLateCall,
    });
  }

  // Sort: named contacts first, then by call_count desc, then total_duration desc
  summary.sort((a, b) => {
    const aHasName = a.name ? 0 : 1;
    const bHasName = b.name ? 0 : 1;
    if (aHasName !== bHasName) return aHasName - bHasName;
    if (b.call_count !== a.call_count) return b.call_count - a.call_count;
    return b.total_duration.localeCompare(a.total_duration);
  });

  // Append TOTAL row
  const totalCalls = summary.reduce((acc, r) => acc + r.call_count, 0);
  summary.push({
    phone: 'TOTAL',
    name: '',
    call_count: totalCalls,
    total_duration: '',
    calls: [],
    hasLateCall: false,
  });

  return summary;
}
