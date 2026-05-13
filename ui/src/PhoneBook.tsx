import { useRef, useState } from 'react';
import type { Contact, ContactCategory } from './utils/csvUtils';
import { parsePhoneBookCSV, exportPhoneBookCSV } from './utils/csvUtils';
import type { SummaryRow } from './utils/xlsxUtils';
import ContactDetail from './ContactDetail';

function withLeadingZero(phone: string): string {
  const digits = phone.trim();
  return digits.startsWith('0') ? digits : '0' + digits;
}

const CATEGORY_BADGE: Record<ContactCategory, string> = {
  Family: 'bg-rose-100 text-rose-700',
  Work: 'bg-blue-100 text-blue-700',
  VIP: 'bg-purple-100 text-purple-700',
  Other: 'bg-slate-100 text-slate-600',
};

type SortKey = 'name' | 'phone' | 'category';
type SortDir = 'asc' | 'desc';

interface Props {
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  activeSummary: SummaryRow[];
}

export default function PhoneBook({ contacts, setContacts, activeSummary }: Props) {
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const [importError, setImportError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterCategory, setFilterCategory] = useState<ContactCategory | ''>('');
  const [filterTag, setFilterTag] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // ── Derived data ────────────────────────────────────────────────────────────
  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags ?? []))).sort();
  const allCategories = Array.from(new Set(contacts.map((c) => c.category).filter(Boolean))) as ContactCategory[];

  // Enrich each contact with call count from activeSummary
  const enriched = contacts.map((c) => {
    const row = activeSummary.find(
      (r) => r.phone === c.phone || r.phone === c.phone.replace(/^0/, '')
    );
    return { ...c, callCount: row?.call_count ?? 0 };
  });

  const filtered = enriched
    .filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        withLeadingZero(c.phone).includes(search) ||
        c.phone.includes(search) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = !filterCategory || c.category === filterCategory;
      const matchTag = !filterTag || (c.tags ?? []).includes(filterTag);
      return matchSearch && matchCategory && matchTag;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'phone') cmp = a.phone.localeCompare(b.phone);
      else if (sortKey === 'category') cmp = (a.category ?? '').localeCompare(b.category ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const unnamedCount = contacts.filter((c) => !c.name).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function handleAdd() {
    const phone = withLeadingZero(newPhone.trim());
    const name = newName.trim();
    if (!phone || phone === '0') { setAddError('Phone number is required.'); return; }
    if (contacts.some((c) => c.phone === phone)) {
      setAddError('A contact with this phone number already exists.');
      return;
    }
    setContacts([...contacts, { phone, name }]);
    setNewPhone('');
    setNewName('');
    setAddError('');
    setAddOpen(false);
  }

  function handleDelete(phone: string) {
    setContacts(contacts.filter((c) => c.phone !== phone));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const parsed = await parsePhoneBookCSV(file);
      if (parsed.length === 0) {
        setImportError('The CSV file appears to be empty or has no valid contacts.');
      } else {
        setContacts(parsed);
      }
    } catch (err) {
      setImportError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    e.target.value = '';
  }

  function handleDetailSave(updated: Contact) {
    setContacts(contacts.map((c) => (c.phone === updated.phone ? updated : c)));
    setSelectedContact(updated);
  }

  return (
    <div className="space-y-5">
      {/* Contact detail modal */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          activeSummary={activeSummary}
          onSave={handleDetailSave}
          onClose={() => setSelectedContact(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name, number or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
        <button
          onClick={() => importRef.current?.click()}
          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-200 transition-colors"
        >
          Import CSV
        </button>
        <button
          onClick={() => exportPhoneBookCSV(contacts)}
          disabled={contacts.length === 0}
          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-sm font-medium border border-slate-200 transition-colors"
        >
          Download CSV
        </button>
        <button
          onClick={() => { setAddOpen((o) => !o); setAddError(''); }}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          {addOpen ? '✕ Cancel' : '+ New Contact'}
        </button>
      </div>

      {importError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {importError}
        </div>
      )}

      {/* Filter chips */}
      {(allCategories.length > 0 || allTags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Filter:</span>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                filterCategory === cat
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {cat}
            </button>
          ))}
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                filterTag === tag
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'
              }`}
            >
              #{tag}
            </button>
          ))}
          {(filterCategory || filterTag) && (
            <button
              onClick={() => { setFilterCategory(''); setFilterTag(''); }}
              className="text-xs text-red-400 hover:text-red-600 transition-colors ml-1"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Collapsible add form */}
      {addOpen && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">New Contact</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Phone Number *</label>
              <input
                type="text"
                placeholder="e.g. 502781708"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Name</label>
              <input
                type="text"
                placeholder="e.g. Gazal"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
              />
            </div>
            <button
              onClick={handleAdd}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              Save Contact
            </button>
          </div>
          {addError && <p className="mt-2 text-sm text-red-500">{addError}</p>}
        </div>
      )}

      {/* Contacts table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">Contacts</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {contacts.length} total
            </span>
            {unnamedCount > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {unnamedCount} unnamed
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            {filtered.length !== contacts.length && `${filtered.length} shown`}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">
              {contacts.length === 0 ? '👤' : '🔍'}
            </div>
            <p className="text-slate-500 font-medium">
              {contacts.length === 0 ? 'No contacts yet' : 'No results match your search'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {contacts.length === 0
                ? 'Click "+ New Contact" to add one.'
                : 'Try a different name, number, or clear the filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold w-10">#</th>
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-indigo-600 select-none transition-colors"
                    onClick={() => toggleSort('phone')}
                  >
                    Phone <SortIcon col="phone" />
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-indigo-600 select-none transition-colors"
                    onClick={() => toggleSort('name')}
                  >
                    Name <SortIcon col="name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-indigo-600 select-none transition-colors"
                    onClick={() => toggleSort('category')}
                  >
                    Category <SortIcon col="category" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Tags</th>
                  <th className="px-4 py-3 text-right font-semibold">Calls</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((contact, i) => (
                  <tr
                    key={contact.phone}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 text-xs">
                      {withLeadingZero(contact.phone)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={contact.name ? 'font-medium text-slate-800' : 'text-slate-300 italic'}>
                        {contact.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {contact.category ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${CATEGORY_BADGE[contact.category]}`}>
                          {contact.category}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(contact.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                            #{tag}
                          </span>
                        ))}
                        {(contact.tags ?? []).length > 3 && (
                          <span className="text-xs text-slate-400">+{contact.tags!.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {contact.callCount > 0 ? (
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {contact.callCount}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedContact(contact); }}
                          className="text-indigo-500 hover:text-indigo-700 text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(contact.phone); }}
                          className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
