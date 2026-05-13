import { useRef, useState } from 'react';
import type { Contact } from './utils/csvUtils';
import { parsePhoneBookCSV, exportPhoneBookCSV } from './utils/csvUtils';

function withLeadingZero(phone: string): string {
  const digits = phone.trim();
  return digits.startsWith('0') ? digits : '0' + digits;
}

interface Props {
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
}

export default function PhoneBook({ contacts, setContacts }: Props) {
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState('');
  // Inline edit state
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      withLeadingZero(c.phone).includes(search) ||
      c.phone.includes(search)
  );

  const unnamedCount = contacts.filter((c) => !c.name).length;

  function handleAdd() {
    const phone = withLeadingZero(newPhone.trim());
    const name = newName.trim();
    if (!phone || phone === '0') {
      setAddError('Phone number is required.');
      return;
    }
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

  function startEdit(contact: Contact) {
    setEditingPhone(contact.phone);
    setEditingName(contact.name);
  }

  function commitEdit(phone: string) {
    const name = editingName.trim();
    setContacts(contacts.map((c) => (c.phone === phone ? { ...c, name } : c)));
    setEditingPhone(null);
    setEditingName('');
  }

  function cancelEdit() {
    setEditingPhone(null);
    setEditingName('');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parsePhoneBookCSV(file);
      setContacts(parsed);
    } catch {
      // ignore
    }
    e.target.value = '';
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
        <button
          onClick={() => importRef.current?.click()}
          className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-300 transition-colors"
        >
          Import CSV
        </button>
        <button
          onClick={() => exportPhoneBookCSV(contacts)}
          disabled={contacts.length === 0}
          className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-sm font-medium border border-slate-300 transition-colors"
        >
          Download CSV
        </button>
        <button
          onClick={() => { setAddOpen((o) => !o); setAddError(''); }}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          {addOpen ? '✕ Cancel' : '+ New Contact'}
        </button>
      </div>

      {/* Collapsible Add Contact form */}
      {addOpen && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
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
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
              />
            </div>
            <button
              onClick={handleAdd}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
            >
              Save Contact
            </button>
          </div>
          {addError && <p className="mt-2 text-sm text-red-500">{addError}</p>}
        </div>
      )}

      {/* Contacts table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
          <div className="py-16 text-center text-slate-400 text-sm">
            {contacts.length === 0
              ? 'No contacts yet. Click "+ New Contact" to add one.'
              : 'No results match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold w-10">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone Number</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((contact, i) => {
                  const isEditing = editingPhone === contact.phone;
                  return (
                    <tr key={contact.phone} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-xs">
                        {withLeadingZero(contact.phone)}
                      </td>
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(contact.phone);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="px-2 py-1 text-sm rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-40"
                            />
                            <button
                              onClick={() => commitEdit(contact.phone)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            >
                              Save
                            </button>
                            <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className={contact.name ? 'font-medium text-slate-800' : 'text-slate-300 italic'}>
                            {contact.name || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isEditing && (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => startEdit(contact)}
                              className="text-indigo-500 hover:text-indigo-700 text-xs font-medium transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(contact.phone)}
                              className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
