// import { useMemo, useState } from 'react';
// import type { DTDMonitorRow } from '../../hooks/useDTDMonitorFeed';

// function text(input: unknown): string {
//   return input == null || input === '' ? '-' : String(input);
// }

// function formatNumber(input: unknown): string {
//   const parsed = Number(input);
//   if (!Number.isFinite(parsed)) return text(input);
//   return parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// }

// function formatTimestamp(ts?: string): string {
//   if (!ts) return '-';
//   const date = new Date(ts);
//   if (Number.isNaN(date.getTime())) return ts;
//   const pad = (value: number) => String(value).padStart(2, '0');
//   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
// }

// function metric(row: DTDMonitorRow, ...names: string[]): unknown {
//   for (const name of names) {
//     if (row.trade[name] != null) return row.trade[name];
//   }
//   return undefined;
// }

// function EventBadge({ high }: { high: boolean }) {
//   return (
//     <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium ${high ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-950/80 text-red-300'}`}>
//       {high ? 'High Break Trade' : 'Low Break Trade'}
//     </span>
//   );
// }

// function TradeTypeCell({ high }: { high: boolean }) {
//   return (
//     <div className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${high ? 'text-emerald-400' : 'text-red-400'}`}>
//       <span className="text-sm leading-none">{high ? '↑' : '↓'}</span>
//       <span>{high ? 'High Break' : 'Low Break'}</span>
//     </div>
//   );
// }

// function StatusPill({ status }: { status: string }) {
//   const complete = status.toLowerCase().includes('complete');
//   return (
//     <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${complete ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/50 bg-amber-500/10 text-amber-300'}`}>
//       {status}
//     </span>
//   );
// }

// function HighlightCell({ value, active, high, leading = false }: { value: unknown; active: boolean; high: boolean; leading?: boolean }) {
//   const border = leading ? 'border-l border-slate-800/80 ' : '';
//   if (!active) {
//     return <td className={`${border}px-2 py-2.5 text-right text-slate-300`}>{formatNumber(value)}</td>;
//   }
//   return (
//     <td className={`${border}px-2 py-2.5 text-right`}>
//       <span className={`inline-block min-w-[72px] rounded px-1.5 py-0.5 font-semibold text-white ${high ? 'bg-emerald-600' : 'bg-red-600'}`}>
//         {formatNumber(value)}
//       </span>
//     </td>
//   );
// }

// export default function DTDMonitorTable({
//   rows,
//   search,
//   clientFilter = 'all',
// }: {
//   rows: DTDMonitorRow[];
//   search: string;
//   clientFilter?: string;
// }) {
//   const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());

//   const grouped = useMemo(() => {
//     const query = search.trim().toUpperCase();
//     const filtered = rows.filter((row) => {
//       if (clientFilter !== 'all' && row.client_id !== clientFilter) return false;
//       const symbol = text(row.trade.trading_symbol ?? row.trade.symbol).toUpperCase();
//       return !query || symbol.includes(query) || row.client_id.toUpperCase().includes(query) || row.tradeType.includes(query);
//     });
//     return filtered.reduce<Record<string, DTDMonitorRow[]>>((groups, row) => {
//       (groups[row.client_id] ||= []).push(row);
//       return groups;
//     }, {});
//   }, [clientFilter, rows, search]);

//   const clients = Object.entries(grouped);

//   const toggleClient = (client: string) => {
//     setCollapsedClients((previous) => {
//       const next = new Set(previous);
//       if (next.has(client)) next.delete(client);
//       else next.add(client);
//       return next;
//     });
//   };

//   return (
//     <div className="overflow-x-auto">
//       <table className="w-full min-w-[1240px] border-collapse text-[11px]">
//         <thead>
//           <tr className="border-b border-slate-700/80 bg-[#0d1526] text-[11px] text-slate-300">
//             <th rowSpan={2} className="w-24 px-3 py-3 text-left font-semibold">Client ID</th>
//             <th rowSpan={2} className="w-28 px-2 py-3 text-left font-semibold">Event Type</th>
//             <th rowSpan={2} className="w-24 px-2 py-3 text-center font-semibold">Trade Type</th>
//             <th rowSpan={2} className="px-3 py-3 text-left font-semibold">Trading Symbol</th>
//             <th rowSpan={2} className="px-2 py-3 text-right font-semibold">Qty</th>
//             <th colSpan={2} className="border-l border-slate-700/80 px-2 py-2 text-center font-semibold">Previous (Date High/Low)</th>
//             <th colSpan={2} className="border-l border-slate-700/80 px-2 py-2 text-center font-semibold">Today 10:15 (Fixed/Level)</th>
//             <th colSpan={2} className="border-l border-slate-700/80 px-2 py-2 text-center font-semibold">Current Level</th>
//             <th rowSpan={2} className="border-l border-slate-700/80 px-2 py-3 text-right font-semibold">Margin (₹)</th>
//             <th rowSpan={2} className="px-2 py-3 text-right font-semibold">Trade Price (₹)</th>
//             <th rowSpan={2} className="px-2 py-3 text-left font-semibold">Status</th>
//             <th rowSpan={2} className="px-2 py-3 text-left font-semibold">Timestamp</th>
//           </tr>
//           <tr className="border-b border-slate-700/80 bg-[#0a1220] text-[10px] text-slate-400">
//             <th className="border-l border-slate-700/80 px-2 py-2 text-right">High</th>
//             <th className="px-2 py-2 text-right">Low</th>
//             <th className="border-l border-slate-700/80 px-2 py-2 text-right">High</th>
//             <th className="px-2 py-2 text-right">Low</th>
//             <th className="border-l border-slate-700/80 px-2 py-2 text-right">Fixed</th>
//             <th className="px-2 py-2 text-right">Level</th>
//           </tr>
//         </thead>
//         <tbody>
//           {clients.length === 0 && (
//             <tr>
//               <td colSpan={16} className="px-4 py-10 text-center text-slate-400">No DTD trades received</td>
//             </tr>
//           )}
//           {clients.map(([client, clientRows]) => {
//             const collapsed = collapsedClients.has(client);
//             if (collapsed) {
//               return (
//                 <tr key={client} className="border-b border-slate-800/80 text-slate-300">
//                   <td className="border-r border-slate-800/80 px-3 py-3 align-top font-semibold text-slate-200">
//                     <button type="button" onClick={() => toggleClient(client)} className="flex items-start gap-1 text-left hover:text-slate-100">
//                       <span className="mt-0.5 text-slate-400">›</span>
//                       <span>
//                         {client}
//                         <span className="mt-1 block w-fit rounded bg-sky-900/60 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">DTD</span>
//                       </span>
//                     </button>
//                   </td>
//                   <td colSpan={15} className="px-3 py-3 text-slate-500">{clientRows.length} trade{clientRows.length === 1 ? '' : 's'} hidden</td>
//                 </tr>
//               );
//             }

//             return clientRows.map((row, index) => {
//               const high = row.tradeType === 'HIGH BREAK';
//               const symbol = text(row.trade.trading_symbol ?? row.trade.symbol);
//               const status = text(row.status ?? row.trade.status ?? 'Pending');
//               const previousHigh = metric(row, 'previous_high', 'previousHigh', 'date_high', 'high') ?? row.trade.previous;
//               const previousLow = metric(row, 'previous_low', 'previousLow', 'date_low', 'low') ?? row.trade.previous;
//               const todayHigh = metric(row, 'today_high', 'todayHigh', 'fixed_high', 'fixed') ?? row.trade.fixed;
//               const todayLow = metric(row, 'today_low', 'todayLow', 'fixed_low', 'level') ?? row.trade.level;

//               return (
//                 <tr
//                   key={row.__key}
//                   className={`border-b border-slate-800/80 text-slate-300 hover:bg-slate-800/30 ${high ? 'border-l-[3px] border-l-emerald-500' : 'border-l-[3px] border-l-red-500'}`}
//                 >
//                   {index === 0 && (
//                     <td rowSpan={clientRows.length} className="border-r border-slate-800/80 px-3 py-3 align-top font-semibold text-slate-200">
//                       <button type="button" onClick={() => toggleClient(client)} className="flex items-start gap-1 text-left hover:text-slate-100">
//                         <span className="mt-0.5 text-slate-400">⌄</span>
//                         <span>
//                           {client}
//                           <span className="mt-1 block w-fit rounded bg-sky-900/60 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">DTD</span>
//                         </span>
//                       </button>
//                     </td>
//                   )}
//                   <td className="px-2 py-3"><EventBadge high={high} /></td>
//                   <td className="px-2 py-3"><TradeTypeCell high={high} /></td>
//                   <td className="px-3 py-3 font-medium text-slate-100">{symbol}</td>
//                   <td className="px-2 py-2.5 text-right">{text(row.trade.quantity)}</td>
//                   <td className="border-l border-slate-800/80 px-2 py-2.5 text-right">{formatNumber(previousHigh)}</td>
//                   <td className="px-2 py-2.5 text-right">{formatNumber(previousLow)}</td>
//                   <HighlightCell value={todayHigh} active leading high={high} />
//                   <td className="px-2 py-2.5 text-right text-slate-300">{formatNumber(todayLow)}</td>
//                   <td className="border-l border-slate-800/80 px-2 py-2.5 text-right">{formatNumber(row.trade.fixed)}</td>
//                   <HighlightCell value={row.trade.level} active high={high} />
//                   <td className="border-l border-slate-800/80 px-2 py-2.5 text-right">₹ {formatNumber(row.trade.margin)}</td>
//                   <td className="px-2 py-2.5 text-right">{row.trade_price == null ? '--' : formatNumber(row.trade_price)}</td>
//                   <td className="px-2 py-2.5"><StatusPill status={status} /></td>
//                   <td className="whitespace-nowrap px-2 py-2.5 text-slate-400">{formatTimestamp(row.timestamp)}</td>
//                 </tr>
//               );
//             });
//           })}
//         </tbody>
//       </table>
//     </div>
//   );
// }

import { useMemo, useState } from 'react';
import type { DTDMonitorRow } from '../../hooks/useDTDMonitorFeed';

function text(input: unknown): string {
  return input == null || input === '' ? '-' : String(input);
}

function formatNumber(input: unknown): string {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return text(input);
  return parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '-';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function metric(row: DTDMonitorRow, ...names: string[]): unknown {
  for (const name of names) {
    if (row.trade[name] != null) return row.trade[name];
  }
  return undefined;
}

function EventBadge({ high }: { high: boolean }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium ${high ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-950/80 text-red-300'}`}>
      {high ? 'High Break Trade' : 'Low Break Trade'}
    </span>
  );
}

function TradeTypeCell({ high }: { high: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${high ? 'text-emerald-400' : 'text-red-400'}`}>
      <span className="text-sm leading-none">{high ? '↑' : '↓'}</span>
      <span>{high ? 'High Break' : 'Low Break'}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const complete = status.toLowerCase().includes('complete');
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${complete ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/50 bg-amber-500/10 text-amber-300'}`}>
      {status}
    </span>
  );
}

function HighlightCell({ value, active, high, leading = false }: { value: unknown; active: boolean; high: boolean; leading?: boolean }) {
  const border = leading ? 'border-l border-slate-800/80 ' : '';
  if (!active) {
    return <td className={`${border}px-2 py-2.5 text-right text-slate-300`}>{formatNumber(value)}</td>;
  }
  return (
    <td className={`${border}px-2 py-2.5 text-right`}>
      <span className={`inline-block min-w-[72px] rounded px-1.5 py-0.5 font-semibold text-white ${high ? 'bg-emerald-600' : 'bg-red-600'}`}>
        {formatNumber(value)}
      </span>
    </td>
  );
}

export default function DTDMonitorTable({
  rows,
  search,
  clientFilter = 'all',
}: {
  rows: DTDMonitorRow[];
  search: string;
  clientFilter?: string;
}) {
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const query = search.trim().toUpperCase();
    const filtered = rows.filter((row) => {
      if (clientFilter !== 'all' && row.client_id !== clientFilter) return false;
      const symbol = text(row.trade.trading_symbol ?? row.trade.symbol).toUpperCase();
      return !query || symbol.includes(query) || row.client_id.toUpperCase().includes(query) || row.tradeType.includes(query);
    });
    return filtered.reduce<Record<string, DTDMonitorRow[]>>((groups, row) => {
      (groups[row.client_id] ||= []).push(row);
      return groups;
    }, {});
  }, [clientFilter, rows, search]);

  const clients = Object.entries(grouped);

  const toggleClient = (client: string) => {
    setCollapsedClients((previous) => {
      const next = new Set(previous);
      if (next.has(client)) next.delete(client);
      else next.add(client);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1060px] border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-slate-700/80 bg-[#0d1526] text-[11px] text-slate-300">
            <th className="w-24 px-3 py-3 text-left font-semibold">Client ID</th>
            <th className="w-28 px-2 py-3 text-left font-semibold">Event Type</th>
            <th className="w-24 px-2 py-3 text-center font-semibold">Trade Type</th>
            <th className="px-3 py-3 text-left font-semibold">Trading Symbol</th>
            <th className="px-2 py-3 text-right font-semibold">Qty</th>
            <th className="border-l border-slate-700/80 px-2 py-3 text-right font-semibold">Previous</th>
            <th className="border-l border-slate-700/80 px-2 py-3 text-right font-semibold">Today 10:15</th>
            <th className="border-l border-slate-700/80 px-2 py-3 text-right font-semibold">Current Level</th>
            <th className="border-l border-slate-700/80 px-2 py-3 text-right font-semibold">Margin (₹)</th>
            <th className="px-2 py-3 text-right font-semibold">Trade Price (₹)</th>
            <th className="px-2 py-3 text-left font-semibold">Status</th>
            <th className="px-2 py-3 text-left font-semibold">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 && (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center text-slate-400">No DTD trades received</td>
            </tr>
          )}
          {clients.map(([client, clientRows]) => {
            const collapsed = collapsedClients.has(client);
            if (collapsed) {
              return (
                <tr key={client} className="border-b border-slate-800/80 text-slate-300">
                  <td className="border-r border-slate-800/80 px-3 py-3 align-top font-semibold text-slate-200">
                    <button type="button" onClick={() => toggleClient(client)} className="flex items-start gap-1 text-left hover:text-slate-100">
                      <span className="mt-0.5 text-slate-400">›</span>
                      <span>
                        {client}
                        <span className="mt-1 block w-fit rounded bg-sky-900/60 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">DTD</span>
                      </span>
                    </button>
                  </td>
                      <td colSpan={11} className="px-3 py-3 text-slate-500">{clientRows.length} trade{clientRows.length === 1 ? '' : 's'} hidden</td>
                </tr>
              );
            }

            return clientRows.map((row, index) => {
              const high = row.tradeType === 'HIGH BREAK';
              const symbol = text(row.trade.trading_symbol ?? row.trade.symbol);
              const status = text(row.status ?? row.trade.status ?? 'Pending');
              const previousHigh = metric(row, 'previous_high', 'previousHigh', 'date_high', 'high') ?? row.trade.previous;
              const todayHigh = metric(row, 'today_high', 'todayHigh', 'fixed_high', 'fixed') ?? row.trade.fixed;

              return (
                <tr
                  key={row.__key}
                  className={`border-b border-slate-800/80 text-slate-300 hover:bg-slate-800/30 ${high ? 'border-l-[3px] border-l-emerald-500' : 'border-l-[3px] border-l-red-500'}`}
                >
                  {index === 0 && (
                    <td rowSpan={clientRows.length} className="border-r border-slate-800/80 px-3 py-3 align-top font-semibold text-slate-200">
                      <button type="button" onClick={() => toggleClient(client)} className="flex items-start gap-1 text-left hover:text-slate-100">
                        <span className="mt-0.5 text-slate-400">⌄</span>
                        <span>
                          {client}
                          <span className="mt-1 block w-fit rounded bg-sky-900/60 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">DTD</span>
                        </span>
                      </button>
                    </td>
                  )}
                  <td className="px-2 py-3"><EventBadge high={high} /></td>
                  <td className="px-2 py-3"><TradeTypeCell high={high} /></td>
                  <td className="px-3 py-3 font-medium text-slate-100">{symbol}</td>
                  <td className="px-2 py-2.5 text-right">{text(row.trade.quantity)}</td>
                  <td className="border-l border-slate-800/80 px-2 py-2.5 text-right">{formatNumber(previousHigh)}</td>
                  <HighlightCell value={todayHigh} active leading high={high} />
                  <HighlightCell value={row.trade.level} active high={high} />
                  <td className="border-l border-slate-800/80 px-2 py-2.5 text-right">₹ {formatNumber(row.trade.margin)}</td>
                  <td className="px-2 py-2.5 text-right">{row.trade_price == null ? '--' : formatNumber(row.trade_price)}</td>
                  <td className="px-2 py-2.5"><StatusPill status={status} /></td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-slate-400">{formatTimestamp(row.timestamp)}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
