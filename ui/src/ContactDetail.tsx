import { useEffect, useState } from 'react';
import type { Contact, ContactCategory } from './utils/csvUtils';
import type { SummaryRow } from './utils/xlsxUtils';

const CATEGORIES: ContactCategory[] = ['Family', 'Work', 'VIP', 'Other'];

const CATEGORY_COLORS: Record<ContactCategory, string> = {
  Family: 'bg-rose-100 text-rose-700 border-rose-200',
  Work: 'bg-blue-100 text-blue-700 border-blue-200',
  VIP: 'bg-purple-100 text-purple-700 border-purple-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

const TAG_PALETTE = [
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-orange-100 text-orange-700',
  'bg-cyan-100 text-cyan-700',
  'bg-lime-100 text-lime-700',
];

interface Props {
  contact: Contact;
  activeSummary: SummaryRow[];
  onSave: (updated: Contact) => void;
  onClose: () => void;
}

export default function ContactDetail({ contact, activeSummary, onSave, onClose }: Props) {
  const [name, setName] = useState(contact.name);
  const [category, setCategory] = useState<ContactCategory | ''>(contact.category ?? '');
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [tagInput, setTagInput] = useState('');
  const [dirty, setDirty] = useState(false);

  const displayPhone = contact.phone.startsWith('0') ? contact.phone : '0' + contact.phone;

  // Find matching summary row(s) — phone may or may not have leading 0
  const summaryRow = activeSummary.find(
    (r) => r.phone === contact.phone || r.phone === contact.phone.replace(/^0/, '')
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function markDirty() { setDirty(true); }

  function handleSave() {
    onSave({
      ...contact,
      name: name.trim(),
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      notes: notes.trim() || undefined,
    });
    setDirty(false);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      markDirty();
    }
    setTagInput('');
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
    markDirty();
  }

  function splitDatetime(dt: string): { date: string; time: string } {
    if (!dt) return { date: '—', time: '—' };
    const isoMatch = dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/);
    if (isoMatch) {
      const [, datePart, timePart] = isoMatch;
      const [y, m, d] = datePart.split('-');
      return { date: `${d}/${m}/${y}`, time: timePart };
    }
    const spaceIdx = dt.indexOf(' ');
    if (spaceIdx !== -1) return { date: dt.slice(0, spaceIdx), time: dt.slice(spaceIdx + 1) };
    return { date: dt, time: '—' };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-gradient-to-r from-indigo-50 to-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 select-none">
              {name ? name[0].toUpperCase() : '?'}
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 leading-tight">
                {name || <span className="text-slate-400 italic">No name</span>}
              </div>
              <div className="text-sm font-mono text-slate-400 mt-0.5">{displayPhone}</div>
              {summaryRow && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">
                    {summaryRow.call_count} calls
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                    {summaryRow.total_duration} total
                  </span>
                  {summaryRow.hasLateCall && (
                    <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5">
                      ⚠ late calls
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Name field */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              placeholder="Enter contact name…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategory(category === cat ? '' : cat); markDirty(); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    category === cat
                      ? CATEGORY_COLORS[cat]
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag, i) => (
                <span
                  key={tag}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${TAG_PALETTE[i % TAG_PALETTE.length]}`}
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 hover:opacity-60 transition-opacity font-bold text-xs leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag and press Enter…"
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
              />
              <button
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); markDirty(); }}
              placeholder="Add a note about this contact…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 resize-none"
            />
          </div>

          {/* Call history */}
          {summaryRow && summaryRow.calls.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                Call History ({summaryRow.calls.length} calls)
              </label>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-2 text-left font-semibold">#</th>
                      <th className="px-4 py-2 text-left font-semibold">Date</th>
                      <th className="px-4 py-2 text-left font-semibold">Time</th>
                      <th className="px-4 py-2 text-right font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaryRow.calls.map((call, i) => {
                      const { date, time } = splitDatetime(call.datetime);
                      return (
                        <tr key={i} className={call.isLate ? 'bg-red-50' : 'hover:bg-slate-50'}>
                          <td className={`px-4 py-2 ${call.isLate ? 'text-red-400' : 'text-slate-400'}`}>{i + 1}</td>
                          <td className={`px-4 py-2 font-medium ${call.isLate ? 'text-red-700' : 'text-slate-700'}`}>{date}</td>
                          <td className={`px-4 py-2 font-mono ${call.isLate ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                            {time}
                            {call.isLate && (
                              <span className="ml-1.5 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-sans font-medium">
                                late
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-mono ${call.isLate ? 'text-red-500' : 'text-slate-500'}`}>
                            {call.duration}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
