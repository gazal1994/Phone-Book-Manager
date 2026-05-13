import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { SummaryRow } from './utils/xlsxUtils';
import type { Contact } from './utils/csvUtils';

interface Props {
  summary: SummaryRow[];
  contacts: Contact[];
  activeFileName: string;
  onGoToSummary: () => void;
}

const INDIGO = '#6366f1';
const EMERALD = '#10b981';
const AMBER = '#f59e0b';
const SLATE = '#94a3b8';
const PIE_COLORS = [EMERALD, AMBER, '#f87171', '#38bdf8', '#a78bfa', '#fb923c', '#34d399'];

export default function Dashboard({ summary, contacts, activeFileName, onGoToSummary }: Props) {
  const dataRows = summary.filter((r) => r.phone !== 'TOTAL');
  const totalRow = summary.find((r) => r.phone === 'TOTAL');
  const hasData = dataRows.length > 0;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const knownCount = dataRows.filter((r) => r.name).length;
  const unknownCount = dataRows.filter((r) => !r.name).length;
  const lateCallCount = dataRows.filter((r) => r.hasLateCall).length;
  const knownPct = dataRows.length > 0 ? Math.round((knownCount / dataRows.length) * 100) : 0;

  // ── Top callers (bar chart) ────────────────────────────────────────────────
  const topCallers = dataRows
    .slice(0, 10)
    .map((r) => ({
      name: r.name || (r.phone.startsWith('0') ? r.phone : '0' + r.phone),
      calls: r.call_count,
    }));

  // ── Calls by date (area chart) ─────────────────────────────────────────────
  const dateMap = new Map<string, number>();
  for (const row of dataRows) {
    for (const call of row.calls) {
      if (!call.datetime) continue;
      // Extract date portion from "DD/MM/YYYY HH:MM" or ISO
      let datePart = '';
      const isoMatch = call.datetime.match(/^(\d{4}-\d{2}-\d{2})/);
      const dmyMatch = call.datetime.match(/^(\d{2}\/\d{2}\/\d{4})/);
      if (isoMatch) {
        const [y, m, d] = isoMatch[1].split('-');
        datePart = `${d}/${m}/${y}`;
      } else if (dmyMatch) {
        datePart = dmyMatch[1];
      }
      if (datePart) dateMap.set(datePart, (dateMap.get(datePart) ?? 0) + 1);
    }
  }
  const callsByDate = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => {
      // Sort by date ascending: parse DD/MM/YYYY
      const [ad, am, ay] = a.date.split('/').map(Number);
      const [bd, bm, by] = b.date.split('/').map(Number);
      return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
    });

  // ── Category breakdown (pie) ───────────────────────────────────────────────
  const knownVsUnknown = [
    { name: 'Known', value: knownCount },
    { name: 'Unknown', value: unknownCount },
  ].filter((d) => d.value > 0);

  // ── Category breakdown from contacts (pie) ─────────────────────────────────
  const catMap = new Map<string, number>();
  for (const c of contacts) {
    const cat = c.category ?? 'Other';
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  }
  const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Overview cards — zero state */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Contacts" value={contacts.length} color="indigo" />
          <StatCard label="Total Calls" value={0} />
          <StatCard label="Identified" value={`0%`} />
          <StatCard label="Late Calls" value={0} color="amber" />
        </div>

        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 text-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center text-4xl">
            📊
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-700">No call data yet</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              Upload a carrier call file in the Call Summary tab to see analytics here.
            </p>
          </div>
          <button
            onClick={onGoToSummary}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            Go to Call Summary
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active file badge */}
      {activeFileName && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="text-slate-300">Showing data for</span>
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full font-medium">
            {activeFileName}
          </span>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Contacts" value={contacts.length} color="indigo" />
        <StatCard label="Total Calls" value={totalRow?.call_count ?? 0} />
        <StatCard label="Identified" value={`${knownPct}%`} color="emerald" />
        <StatCard label="Late Calls" value={lateCallCount} color={lateCallCount > 0 ? 'amber' : 'slate'} />
      </div>

      {/* Charts row 1: top callers + known/unknown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top 10 callers — horizontal bar */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Callers</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topCallers}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="calls" fill={INDIGO} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Known vs Unknown donut */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Known vs Unknown</h3>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={knownVsUnknown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {knownVsUnknown.map((_, index) => (
                    <Cell key={index} fill={index === 0 ? EMERALD : AMBER} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around mt-2 text-center">
            <div>
              <div className="text-xl font-bold text-emerald-600">{knownCount}</div>
              <div className="text-xs text-slate-400">Known</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-500">{unknownCount}</div>
              <div className="text-xs text-slate-400">Unknown</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 2: calls by date + category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calls over time — area chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Calls by Date</h3>
          {callsByDate.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={callsByDate} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={INDIGO} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={INDIGO} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: SLATE }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Calls"
                  stroke={INDIGO}
                  strokeWidth={2}
                  fill="url(#callsGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: INDIGO }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-300 text-sm">
              No date information available in this file.
            </div>
          )}
        </div>

        {/* Contact categories */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Contact Categories</h3>
          {categoryData.length > 0 ? (
            <>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {categoryData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {d.name}
                    </div>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-2">
              <span className="text-3xl">🏷️</span>
              <p className="text-xs text-slate-400">
                No categories assigned yet. Open the Phone Book to tag your contacts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared stat card ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  color?: 'indigo' | 'emerald' | 'amber' | 'slate';
}

function StatCard({ label, value, color = 'slate' }: StatCardProps) {
  const valueColor =
    color === 'indigo'
      ? 'text-indigo-600'
      : color === 'emerald'
      ? 'text-emerald-600'
      : color === 'amber'
      ? 'text-amber-500'
      : 'text-slate-800';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}
