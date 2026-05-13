import { useEffect, useRef, useState } from 'react';
import type { Contact } from './utils/csvUtils';
import type { SummaryRow } from './utils/xlsxUtils';
import { readXLSXCallFile, readCSVCallFile, exportSummaryXLSX } from './utils/xlsxUtils';
import { summarizeCalls } from './utils/callLogic';
import type { HistoryEntry } from './utils/historyStore';

interface Props {
  phoneBook: Contact[];
  onAddContact: (contact: Contact) => void;
  onAddHistory: (entry: HistoryEntry) => void;
  /** Pre-loaded entry from History tab (component re-mounts with a new key) */
  initialEntry?: HistoryEntry | null;
}

export default function CallSummary({
  phoneBook,
  onAddContact,
  onAddHistory,
  initialEntry,
}: Props) {
  const [summary, setSummary] = useState<SummaryRow[]>(initialEntry?.summary ?? []);
  const [fileName, setFileName] = useState(initialEntry?.fileName ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedRow, setSelectedRow] = useState<SummaryRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    setLoading(true);
    setError('');
    setSummary([]);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rows;
      if (ext === 'xlsx' || ext === 'xls') {
        const result = await readXLSXCallFile(file);
        rows = result.rows;
      } else if (ext === 'csv') {
        rows = await readCSVCallFile(file);
      } else {
        setError('Unsupported file type. Please upload a .csv or .xlsx file.');
        setLoading(false);
        return;
      }
      if (!rows || rows.length === 0) {
        setError(
          `No phone numbers found in "${file.name}". ` +
          'Make sure you upload your carrier calls file (e.g. שיחות-בישראל-...xlsx), not a summary file.'
        );
        setLoading(false);
        return;
      }
      const result = summarizeCalls(rows, phoneBook);
      setSummary(result);
      setFileName(file.name);

      onAddHistory({
        fileName: file.name,
        processedAt: new Date().toISOString(),
        summary: result,
      });
    } catch (err) {
      setError(`Failed to process file: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleSaveName(phone: string) {
    const name = editingName.trim();
    if (!name) return;
    onAddContact({ phone, name });
    setSummary((prev) => prev.map((r) => (r.phone === phone ? { ...r, name } : r)));
    setEditingPhone(null);
    setEditingName('');
  }

  const dataRows = summary.filter((r) => r.phone !== 'TOTAL');
  const totalRow = summary.find((r) => r.phone === 'TOTAL');
  const maxCalls = dataRows.length > 0 ? dataRows[0].call_count : 1;
  const knownCount = dataRows.filter((r) => r.name).length;
  const unknownCount = dataRows.filter((r) => !r.name).length;
  const topCaller = dataRows[0];
  const hasResults = summary.length > 0;

  return (
    <div className="space-y-5">
      {/* Upload zone — compact when results are loaded */}
      {hasResults ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer flex items-center justify-between gap-4 rounded-xl border px-5 py-3 transition-colors ${
            dragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-lg">📂</span>
            <div>
              <p className="text-sm font-medium text-slate-700 leading-none">{fileName}</p>
              <p className="text-xs text-slate-400 mt-0.5">Click or drag to load a different file</p>
            </div>
          </div>
          <span className="text-xs text-indigo-600 font-medium border border-indigo-200 rounded-lg px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap">
            Change file
          </span>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            dragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <div className="text-5xl mb-4">📂</div>
          <p className="text-slate-700 font-semibold text-lg">
            Drag & drop your calls file here
          </p>
          <p className="text-slate-400 text-sm mt-1">
            or <span className="text-indigo-600 underline cursor-pointer">click to browse</span>
          </p>
          <p className="text-slate-300 text-xs mt-3">
            Upload your carrier calls file (e.g. שיחות-בישראל-...xlsx) — not a summary
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
          <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Processing file…
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Call Detail Modal */}
      {selectedRow && (
        <CallDetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}

      {hasResults && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Unique Numbers" value={dataRows.length} />
            <StatCard label="Total Calls" value={totalRow?.call_count ?? 0} />
            <StatCard label="Known" value={knownCount} color="emerald" />
            <StatCard label="Unknown" value={unknownCount} color={unknownCount > 0 ? 'amber' : 'slate'} />
            <div className="col-span-2 sm:col-span-1 bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Top Caller</div>
              {topCaller ? (
                <>
                  <div className="text-sm font-bold text-slate-800 truncate leading-tight">
                    {topCaller.name || (topCaller.phone.startsWith('0') ? topCaller.phone : '0' + topCaller.phone)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{topCaller.call_count} calls</div>
                </>
              ) : (
                <div className="text-slate-300 text-sm">—</div>
              )}
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Table header with download button */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">Call Summary</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {dataRows.length} numbers
                </span>
              </div>
              <button
                onClick={() => exportSummaryXLSX(summary, fileName)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
              >
                <span>↓</span> Download .xlsx
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                    <th className="px-4 py-3 text-left font-semibold w-10">#</th>
                    <th className="px-4 py-3 text-left font-semibold">Phone</th>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-right font-semibold">Calls</th>
                    <th className="px-4 py-3 text-right font-semibold">Total Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataRows.map((row, i) => {
                    const displayPhone = row.phone.startsWith('0') ? row.phone : '0' + row.phone;
                    const isEditing = editingPhone === row.phone;
                    const isTop3 = i < 3;
                    const barWidth = Math.round((row.call_count / maxCalls) * 100);

                    return (
                      <tr
                        key={row.phone + i}
                        onClick={() => { if (!isEditing) setSelectedRow(row); }}
                        className={`transition-colors cursor-pointer hover:bg-indigo-50/60 ${
                          isTop3 ? 'border-l-2 border-l-indigo-400' : 'border-l-2 border-l-transparent'
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-mono text-slate-600 text-xs">{displayPhone}</td>
                        <td className="px-4 py-2.5 text-slate-800">
                          <div className="flex items-center gap-2">
                            {row.hasLateCall && (
                              <span
                                title="Has calls after 21:00"
                                className="text-amber-500 text-xs leading-none"
                              >
                                ⚠
                              </span>
                            )}
                          {row.name ? (
                            <span className="font-medium text-slate-800">{row.name}</span>
                          ) : isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                type="text"
                                placeholder="Enter name…"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveName(row.phone);
                                  if (e.key === 'Escape') { setEditingPhone(null); setEditingName(''); }
                                }}
                                className="px-2 py-1 text-sm rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-36"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSaveName(row.phone); }}
                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingPhone(null); setEditingName(''); }}
                                className="text-xs text-slate-400 hover:text-slate-600"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingPhone(row.phone); setEditingName(''); }}
                              className="text-xs px-2.5 py-1 rounded-full border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 hover:border-amber-500 transition-colors"
                            >
                              + Add name
                            </button>
                          )}
                          </div>
                        </td>
                        {/* Calls cell with inline bar */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full bg-indigo-400"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-800 tabular-nums w-8 text-right">
                              {row.call_count}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">
                          {row.total_duration}
                        </td>
                      </tr>
                    );
                  })}

                  {/* TOTAL row */}
                  {totalRow && (
                    <tr className="bg-indigo-50 border-t-2 border-indigo-100">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-xs font-bold text-indigo-700 uppercase tracking-widest">
                        Total
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-indigo-700 text-base tabular-nums">
                          {totalRow.call_count}
                        </span>
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color?: 'emerald' | 'amber' | 'slate';
}

function StatCard({ label, value, color = 'slate' }: StatCardProps) {
  const valueColor =
    color === 'emerald'
      ? 'text-emerald-600'
      : color === 'amber'
      ? 'text-amber-600'
      : 'text-slate-800';
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}

// ─── Call Detail Modal ────────────────────────────────────────────────────────

interface CallDetailModalProps {
  row: SummaryRow;
  onClose: () => void;
}

function CallDetailModal({ row, onClose }: CallDetailModalProps) {
  const displayPhone = row.phone.startsWith('0') ? row.phone : '0' + row.phone;
  const lateCount = row.calls.filter((c) => c.isLate).length;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /** Split a datetime string into date and time parts for display. */
  function splitDatetime(dt: string): { date: string; time: string } {
    if (!dt) return { date: '—', time: '—' };
    // ISO: "2026-01-24T20:54:33"
    const isoMatch = dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/);
    if (isoMatch) {
      const [, datePart, timePart] = isoMatch;
      const [y, m, d] = datePart.split('-');
      return { date: `${d}/${m}/${y}`, time: timePart };
    }
    // "DD/MM/YYYY HH:MM:SS" or "DD/MM/YYYY HH:MM"
    const spaceIdx = dt.indexOf(' ');
    if (spaceIdx !== -1) {
      return { date: dt.slice(0, spaceIdx), time: dt.slice(spaceIdx + 1) };
    }
    return { date: dt, time: '—' };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-800 leading-tight">
              {row.name || <span className="text-slate-400 italic">Unknown</span>}
            </div>
            <div className="text-sm font-mono text-slate-500 mt-0.5">{displayPhone}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span className="bg-slate-100 rounded-full px-2 py-0.5 font-medium">
                {row.call_count} calls
              </span>
              <span className="bg-slate-100 rounded-full px-2 py-0.5 font-medium">
                {row.total_duration} total
              </span>
              {lateCount > 0 && (
                <span className="bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                  ⚠ {lateCount} after 21:00
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Calls list */}
        <div className="overflow-y-auto flex-1">
          {row.calls.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No call details available.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-2.5 text-left font-semibold">#</th>
                  <th className="px-5 py-2.5 text-left font-semibold">Date</th>
                  <th className="px-5 py-2.5 text-left font-semibold">Time</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {row.calls.map((call, i) => {
                  const { date, time } = splitDatetime(call.datetime);
                  return (
                    <tr
                      key={i}
                      className={call.isLate ? 'bg-red-50' : 'hover:bg-slate-50/60'}
                    >
                      <td className={`px-5 py-2.5 text-xs ${call.isLate ? 'text-red-400' : 'text-slate-400'}`}>
                        {i + 1}
                      </td>
                      <td className={`px-5 py-2.5 font-medium ${call.isLate ? 'text-red-700' : 'text-slate-700'}`}>
                        {date}
                      </td>
                      <td className={`px-5 py-2.5 font-mono ${call.isLate ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                        {time}
                        {call.isLate && (
                          <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-sans font-medium">
                            late
                          </span>
                        )}
                      </td>
                      <td className={`px-5 py-2.5 text-right font-mono text-xs ${call.isLate ? 'text-red-500' : 'text-slate-500'}`}>
                        {call.duration}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
