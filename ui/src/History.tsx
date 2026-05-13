import type { HistoryEntry } from './utils/historyStore';

interface Props {
  history: HistoryEntry[];
  activeFileName: string;
  onLoad: (entry: HistoryEntry) => void;
  onDelete: (fileName: string) => void;
}

export default function History({ history, activeFileName, onLoad, onDelete }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
          🕑
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-700">No history yet</h2>
          <p className="text-sm text-slate-400 mt-1">
            Process a call file in the Call Summary tab — it will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-slate-700">
          Recent Files
          <span className="ml-2 text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {history.length}
          </span>
        </h2>
        <p className="text-xs text-slate-400">Click any row to load it in Call Summary</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
        {history.map((entry) => {
          const dataRows = entry.summary.filter((r) => r.phone !== 'TOTAL');
          const totalRow = entry.summary.find((r) => r.phone === 'TOTAL');
          const knownCount = dataRows.filter((r) => r.name).length;
          const unknownCount = dataRows.length - knownCount;
          const lateCallCount = dataRows.filter((r) => r.hasLateCall).length;
          const date = new Date(entry.processedAt);
          const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
          const isActive = entry.fileName === activeFileName;

          return (
            <div
              key={entry.fileName}
              className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                isActive ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
              }`}
            >
              <button
                onClick={() => onLoad(entry)}
                className="flex-1 flex items-center gap-4 text-left min-w-0"
              >
                <span className="text-2xl flex-shrink-0">{isActive ? '📂' : '📄'}</span>

                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-semibold truncate ${
                      isActive ? 'text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    {entry.fileName}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{dateStr}</div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs flex-shrink-0 flex-wrap justify-end">
                  <span className="bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-medium">
                    {totalRow?.call_count ?? 0} calls
                  </span>
                  {knownCount > 0 && (
                    <span className="bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                      {knownCount} known
                    </span>
                  )}
                  {unknownCount > 0 && (
                    <span className="bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                      {unknownCount} unknown
                    </span>
                  )}
                  {lateCallCount > 0 && (
                    <span className="bg-red-50 text-red-600 rounded-full px-2 py-0.5 font-medium">
                      ⚠ {lateCallCount} late
                    </span>
                  )}
                </div>

                {isActive && (
                  <span className="text-xs font-semibold text-indigo-600 flex-shrink-0 bg-indigo-100 px-2 py-0.5 rounded-full ml-1">
                    Active
                  </span>
                )}
              </button>

              <button
                onClick={() => onDelete(entry.fileName)}
                className="text-slate-300 hover:text-red-400 transition-colors text-sm flex-shrink-0 p-1 rounded-lg hover:bg-red-50"
                title="Remove from history"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
