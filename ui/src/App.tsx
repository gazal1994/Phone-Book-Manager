import { useState, useEffect, useCallback } from 'react';
import type { Contact } from './utils/csvUtils';
import type { SummaryRow } from './utils/xlsxUtils';
import type { HistoryEntry } from './utils/historyStore';
import { loadHistory, saveHistory, MAX_HISTORY } from './utils/historyStore';
import PhoneBook from './PhoneBook';
import CallSummary from './CallSummary';
import History from './History';
import Dashboard from './Dashboard';

const STORAGE_KEY = 'phone_book_contacts';

const INITIAL_CONTACTS: Contact[] = [
  { phone: '525477886', name: 'Waard Asala' },
  { phone: '502781708', name: 'Gazal' },
  { phone: '528444271', name: 'Loreen badran' },
  { phone: '529482002', name: 'Haya hamdony' },
  { phone: '524032997', name: 'Fady nazek' },
  { phone: '523625946', name: 'Ranen' },
  { phone: '545201116', name: 'Shefa' },
  { phone: '528911384', name: 'Dalya' },
  { phone: '587660615', name: 'Samar' },
  { phone: '505722144', name: 'Jana' },
  { phone: '526826422', name: 'Shady' },
  { phone: '523752008', name: 'Nazek' },
  { phone: '522332718', name: 'Roqya' },
  { phone: '524802113', name: 'Kefaya' },
  { phone: '528100459', name: 'Shada' },
  { phone: '46000905', name: 'Hat' },
  { phone: '533019585', name: 'Lamis' },
  { phone: '542640091', name: 'Salam Agbaria' },
  { phone: '505747886', name: 'Sobhiya' },
  { phone: '502764815', name: 'Aysha Gabaly' },
  { phone: '538219737', name: 'Abed Mansor***' },
  { phone: '549726440', name: 'Shada' },
  { phone: '768012701', name: 'Bank HPoalem' },
  { phone: '508585196', name: 'Odai taraby' },
  { phone: '502166708', name: 'Adan bwierat' },
];

function loadContacts(): Contact[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as Contact[];
  } catch {
    // ignore
  }
  return INITIAL_CONTACTS;
}

type Tab = 'dashboard' | 'summary' | 'history' | 'phonebook';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [contacts, setContactsRaw] = useState<Contact[]>(loadContacts);
  const [savedToast, setSavedToast] = useState(false);
  const [history, setHistoryRaw] = useState<HistoryEntry[]>(loadHistory);
  const [activeFileName, setActiveFileName] = useState('');
  const [initialEntry, setInitialEntry] = useState<HistoryEntry | null>(null);
  const [summaryKey, setSummaryKey] = useState(0);
  // activeSummary drives the Dashboard and ContactDetail modal
  const [activeSummary, setActiveSummary] = useState<SummaryRow[]>(() => {
    const hist = loadHistory();
    return hist.length > 0 ? hist[0].summary : [];
  });

  const addHistory = useCallback((entry: HistoryEntry) => {
    setHistoryRaw((prev) => {
      const filtered = prev.filter((h) => h.fileName !== entry.fileName);
      const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
    setActiveFileName(entry.fileName);
    setActiveSummary(entry.summary);
  }, []);

  const deleteHistoryEntry = useCallback((fileName: string) => {
    setHistoryRaw((prev) => {
      const updated = prev.filter((h) => h.fileName !== fileName);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setInitialEntry(entry);
    setSummaryKey((k) => k + 1);
    setActiveFileName(entry.fileName);
    setActiveSummary(entry.summary);
    setTab('summary');
  }, []);

  const setContacts = useCallback((next: Contact[]) => {
    setContactsRaw(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
    setSavedToast(true);
  }, []);

  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(false), 2000);
    return () => clearTimeout(t);
  }, [savedToast]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-indigo-700 to-indigo-900 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg">
            📱
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white leading-none tracking-tight">
              Phone Book Manager
            </h1>
            <p className="text-xs text-indigo-300 mt-0.5">
              Manage contacts &amp; analyse call logs
            </p>
          </div>
          {/* Auto-save toast */}
          <div
            className={`flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-900/40 border border-emerald-600/40 px-3 py-1.5 rounded-full transition-all duration-300 ${
              savedToast ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Saved
          </div>
          {/* Contacts pill */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-200 bg-white/10 px-3 py-1.5 rounded-full">
            <span className="font-semibold text-white">{contacts.length}</span>
            contacts
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-0">
          <TabButton
            active={tab === 'dashboard'}
            onClick={() => setTab('dashboard')}
            label="Dashboard"
            icon="📈"
          />
          <TabButton
            active={tab === 'summary'}
            onClick={() => setTab('summary')}
            label="Call Summary"
            icon="📊"
          />
          <TabButton
            active={tab === 'history'}
            onClick={() => setTab('history')}
            label="History"
            icon="🕑"
            badge={history.length || undefined}
          />
          <TabButton
            active={tab === 'phonebook'}
            onClick={() => setTab('phonebook')}
            label="Phone Book"
            icon="👤"
            badge={contacts.length}
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === 'dashboard' && (
          <Dashboard
            summary={activeSummary}
            contacts={contacts}
            activeFileName={activeFileName}
            onGoToSummary={() => setTab('summary')}
          />
        )}
        {tab === 'summary' && (
          <CallSummary
            key={summaryKey}
            phoneBook={contacts}
            onAddContact={(contact) => {
              if (!contacts.some((c) => c.phone === contact.phone)) {
                setContacts([...contacts, contact]);
              }
            }}
            onAddHistory={addHistory}
            initialEntry={initialEntry}
          />
        )}
        {tab === 'history' && (
          <History
            history={history}
            activeFileName={activeFileName}
            onLoad={loadFromHistory}
            onDelete={deleteHistoryEntry}
          />
        )}
        {tab === 'phonebook' && (
          <PhoneBook
            contacts={contacts}
            setContacts={setContacts}
            activeSummary={activeSummary}
          />
        )}
      </main>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  badge?: number;
}

function TabButton({ active, onClick, label, icon, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-white text-white'
          : 'border-transparent text-indigo-300 hover:text-white hover:border-indigo-300'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
            active ? 'bg-white/20 text-white' : 'bg-white/10 text-indigo-300'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
