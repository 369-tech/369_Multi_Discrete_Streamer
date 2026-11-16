// import { useEffect, useMemo, useRef, useState } from 'react';
// import { wsUrl } from '../../api/api';
// import { BASE_URL } from '../../api/baseurl';

// type Venue = 'A' | 'B' | 'C';
// type Direction = 'all' | Venue;

// interface SymbolRow {
//   symbol: string;
//   name: string;
//   lotSize: number;
// }

// interface Mapping {
//   nseEq?: string;
//   bseEq?: string;
//   nseFut?: string;
//   futExpiry?: string;
// }

// interface Quote {
//   priceA?: number;
//   priceB?: number;
//   priceC?: number;
//   updatedAt?: number;
// }

// interface Opportunity extends SymbolRow {
//   priceA?: number;
//   priceB?: number;
//   priceC?: number;
//   spread?: number;
//   spreadPct?: number;
//   buyVenue?: Venue;
//   sellVenue?: Venue;
// }

// interface AccountResponse {
//   brokers?: Array<{ key: string; name: string }>;
//   accounts?: Array<{ broker: string; label: string; client_id_masked?: string }>;
//   default?: { broker?: string; label?: string };
// }

// const VENUE_LABEL: Record<Venue, string> = { A: 'NSE', B: 'BSE', C: 'FUT' };
// const VENUE_FIELD: Record<Venue, keyof Mapping> = { A: 'nseEq', B: 'bseEq', C: 'nseFut' };

// function formatPrice(value?: number) {
//   return value == null || Number.isNaN(value)
//     ? '—'
//     : `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// }

// /** Pick arb-relevant side: cash = ask (buy), futures = bid (sell). Falls back to price/last_price. */
// function quoteSidePrice(
//   item: { price?: number; last_price?: number; bid_price?: number; ask_price?: number } | undefined,
//   venue: Venue,
// ): number | undefined {
//   if (!item) return undefined;
//   if (venue === 'C') {
//     const v = item.bid_price ?? item.price ?? item.last_price;
//     const price = Number(v);
//     return Number.isFinite(price) ? price : undefined;
//   }
//   const v = item.ask_price ?? item.price ?? item.last_price;
//   const price = Number(v);
//   return Number.isFinite(price) ? price : undefined;
// }

// function parseCsvLine(line: string) {
//   const cells: string[] = [];
//   let current = '';
//   let quoted = false;
//   for (const char of line) {
//     if (char === '"') quoted = !quoted;
//     else if (char === ',' && !quoted) { cells.push(current); current = ''; }
//     else current += char;
//   }
//   cells.push(current);
//   return cells;
// }

// /** Same pair math as index.html: signed spreadPct, best by |spreadPct|. */
// function buildOpportunities(symbols: SymbolRow[], quotes: Record<string, Quote>): Opportunity[] {
//   return symbols.map((symbol) => {
//     const quote = quotes[symbol.symbol] || {};
//     const pairs: Array<{ pa?: number; pb?: number; buyLeg: Venue; sellLeg: Venue }> = [
//       { pa: quote.priceA, pb: quote.priceB, buyLeg: 'A', sellLeg: 'B' },
//       { pa: quote.priceA, pb: quote.priceC, buyLeg: 'A', sellLeg: 'C' },
//       { pa: quote.priceB, pb: quote.priceC, buyLeg: 'B', sellLeg: 'C' },
//     ];
//     let best: Opportunity = { ...symbol, ...quote };
//     pairs.forEach((p) => {
//       if (p.pa == null || p.pb == null || Math.min(p.pa, p.pb) <= 0) return;
//       const spread = p.pa - p.pb;
//       // Signed % (can be negative) — HTML uses this for green/red
//       const spreadPct = (spread / Math.min(p.pa, p.pb)) * 100;
//       const buyVenue: Venue | undefined =
//         spread > 0 ? p.sellLeg : spread < 0 ? p.buyLeg : undefined;
//       const sellVenue: Venue | undefined =
//         spread > 0 ? p.buyLeg : spread < 0 ? p.sellLeg : undefined;
//       if (best.spreadPct == null || Math.abs(spreadPct) > Math.abs(best.spreadPct)) {
//         best = {
//           ...best,
//           spread,
//           spreadPct,
//           buyVenue,
//           sellVenue,
//         };
//       }
//     });
//     return best;
//   });
// }

// /** Distinct colors per action pair (not only FUT vs cash). */
// function actionBadgeStyle(row: Opportunity): { text: string; color: string; bg: string } {
//   const canTrade = !!(row.buyVenue && row.sellVenue);
//   const text = canTrade
//     ? `Buy ${VENUE_LABEL[row.buyVenue!]} · Sell ${VENUE_LABEL[row.sellVenue!]}`
//     : '—';
//   const key = `${row.buyVenue || ''}${row.sellVenue || ''}`;
//   // Distinct palette per direction so opposite legs never share a color
//   const palette: Record<string, { color: string; bg: string }> = {
//     // Cash ↔ Cash
//     AB: { color: '#2DD4BF', bg: 'rgba(45,212,191,0.14)' },   // Buy NSE · Sell BSE  (teal)
//     BA: { color: '#F2A93B', bg: 'rgba(242,169,59,0.14)' },   // Buy BSE · Sell NSE  (amber)
//     // Cash ↔ FUT
//     AC: { color: '#38BDF8', bg: 'rgba(56,189,248,0.14)' },   // Buy NSE · Sell FUT  (sky)
//     CA: { color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' },  // Buy FUT · Sell NSE  (violet)
//     BC: { color: '#34D399', bg: 'rgba(52,211,153,0.14)' },   // Buy BSE · Sell FUT  (emerald)
//     CB: { color: '#F472B6', bg: 'rgba(244,114,182,0.14)' },  // Buy FUT · Sell BSE  (pink)
//   };
//   const style = palette[key] || { color: '#94A3B8', bg: 'rgba(148,163,184,0.14)' };
//   return { text, color: style.color, bg: style.bg };
// }

// function formatSpreadPct(value?: number) {
//   if (value == null || Number.isNaN(value)) return '—';
//   const sign = value > 0 ? '+' : '';
//   return `${sign}${value.toFixed(2)}%`;
// }

// export default function ArbProxyPage() {
//   const [symbols, setSymbols] = useState<SymbolRow[]>([]);
//   const [mapping, setMapping] = useState<Record<string, Mapping>>({});
//   const [quotes, setQuotes] = useState<Record<string, Quote>>({});
//   const [threshold, setThreshold] = useState(0.3);
//   const [direction, setDirection] = useState<Direction>('all');
//   const [query, setQuery] = useState('');
//   const [connected, setConnected] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [message, setMessage] = useState('Connecting to local proxy…');
//   const [broker, setBroker] = useState('');
//   const [account, setAccount] = useState('');
//   const [brokers, setBrokers] = useState<Array<{ key: string; name: string }>>([]);
//   const [accounts, setAccounts] = useState<Array<{ broker: string; label: string; client_id_masked?: string }>>([]);
//   const [mappingOpen, setMappingOpen] = useState(false);
//   const socketRef = useRef<WebSocket | null>(null);
//   const symbolsRef = useRef(symbols);
//   const mappingRef = useRef(mapping);

//   useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
//   useEffect(() => { mappingRef.current = mapping; }, [mapping]);

//   const mappedCount = symbols.filter((item) => {
//     const entry = mapping[item.symbol];
//     return entry?.nseEq && entry.bseEq && entry.nseFut;
//   }).length;

//   const rows = useMemo(() => buildOpportunities(symbols, quotes)
//     .filter((row) => row.spreadPct != null && Math.abs(row.spreadPct) >= threshold)
//     .filter((row) => direction === 'all' || row.buyVenue === direction)
//     .filter((row) => !query.trim() || row.symbol.includes(query.trim().toUpperCase()))
//     .sort((a, b) => Math.abs(b.spreadPct || 0) - Math.abs(a.spreadPct || 0)), [symbols, quotes, threshold, direction, query]);

//   async function loadAccounts() {
//     try {
//       const response = await fetch(`${BASE_URL}/api/accounts`);
//       if (!response.ok) return;
//       const data = await response.json() as AccountResponse;
//       const nextBrokers = data.brokers || [];
//       const nextAccounts = data.accounts || [];
//       setBrokers(nextBrokers);
//       setAccounts(nextAccounts);
//       const defaultBroker = data.default?.broker || nextBrokers[0]?.key || '';
//       setBroker(defaultBroker);
//       setAccount(data.default?.label || nextAccounts.find((item) => item.broker === defaultBroker)?.label || '');
//     } catch { /* The scanner can still display prices without account metadata. */ }
//   }

//   async function loadMapping() {
//     setLoading(true);
//     try {
//       const response = await fetch(`${BASE_URL}/api/scrip-master`);
//       if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
//       const text = await response.text();
//       const lines = text.split(/\r?\n/).filter(Boolean);
//       if (!lines.length) throw new Error('Empty instrument master');
//       const header = parseCsvLine(lines[0]).map((item) => item.trim().toLowerCase());
//       const index = (...names: string[]) => names.map((name) => header.indexOf(name)).find((value) => value >= 0) ?? -1;
//       const exchangeIndex = index('exch_id');
//       const segmentIndex = index('segment');
//       const securityIndex = index('security_id');
//       const instrumentIndex = index('instrument');
//       const underlyingIndex = index('underlying_symbol');
//       const symbolIndex = index('symbol_name');
//       const expiryIndex = index('sm_expiry_date');
//       const lotIndex = index('lot_size', 'lot_units');
//       const today = new Date();
//       const futures = new Map<string, { id: string; expiry: string; expiryDate: Date; lotSize: number }>();
//       const equities: Array<{ exchange: string; symbol: string; underlying: string; id: string }> = [];
//       lines.slice(1).forEach((line) => {
//         const cells = parseCsvLine(line);
//         const exchange = (cells[exchangeIndex] || '').trim();
//         const segment = (cells[segmentIndex] || '').trim();
//         const instrument = (cells[instrumentIndex] || '').trim().toUpperCase();
//         const underlying = (cells[underlyingIndex] || '').trim().toUpperCase();
//         const symbol = (cells[symbolIndex] || '').trim().toUpperCase();
//         const id = (cells[securityIndex] || '').trim();
//         if (exchange !== 'NSE' && exchange !== 'BSE') return;
//         if (exchange === 'NSE' && segment === 'D' && instrument === 'FUTSTK') {
//           const expiry = (cells[expiryIndex] || '').trim();
//           const expiryDate = new Date(expiry);
//           const key = underlying || symbol;
//           if (!key || Number.isNaN(expiryDate.getTime()) || expiryDate < today) return;
//           const existing = futures.get(key);
//           if (!existing || expiryDate < existing.expiryDate) futures.set(key, { id, expiry, expiryDate, lotSize: Number(cells[lotIndex]) || 1 });
//         } else if (instrument === 'EQUITY' && segment === 'E') {
//           equities.push({ exchange, symbol, underlying, id });
//         }
//       });
//       const nextSymbols = [...futures.keys()].sort().map((symbol) => ({ symbol, name: symbol, lotSize: futures.get(symbol)?.lotSize || 1 }));
//       const nextMapping: Record<string, Mapping> = {};
//       nextSymbols.forEach(({ symbol }) => {
//         const future = futures.get(symbol);
//         nextMapping[symbol] = { nseFut: future?.id, futExpiry: future?.expiry };
//       });
//       equities.forEach((row) => {
//         const key = futures.has(row.underlying) ? row.underlying : futures.has(row.symbol) ? row.symbol : '';
//         if (!key) return;
//         if (row.exchange === 'NSE' && !nextMapping[key].nseEq) nextMapping[key].nseEq = row.id;
//         if (row.exchange === 'BSE' && !nextMapping[key].bseEq) nextMapping[key].bseEq = row.id;
//       });
//       setSymbols(nextSymbols);
//       setMapping(nextMapping);
//       setMessage(nextSymbols.length ? 'Live feed ready' : 'No futures symbols detected');
//     } catch (error) {
//       setMessage(`Unable to load instrument master: ${error instanceof Error ? error.message : 'proxy unavailable'}`);
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => {
//     void Promise.all([loadAccounts(), loadMapping()]);
//     const socket = new WebSocket(wsUrl('/ws/ltp'));
//     socketRef.current = socket;
//     socket.onopen = () => { setConnected(true); setMessage('Live feed connected'); };
//     socket.onclose = () => { setConnected(false); setMessage('Live feed disconnected'); };
//     socket.onerror = () => setMessage('WebSocket error: check the local proxy');
//     socket.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data) as { type?: string; data?: Record<string, Record<string, { price?: number; last_price?: number; bid_price?: number; ask_price?: number }>>; segment?: string; security_id?: string | number; price?: number; last_price?: number; bid_price?: number; ask_price?: number };
//         if (data.type === 'snapshot' && data.data) {
//           setQuotes((current) => {
//             const next: Record<string, Quote> = { ...current };
//             symbolsRef.current.forEach((item) => { next[item.symbol] = current[item.symbol] || {}; });
//             // Invert mapping once: securityId → symbol + venue (avoids O(symbols×ticks) scan)
//             const idToSymbol: Record<string, { symbol: string; venue: Venue }> = {};
//             symbolsRef.current.forEach((sym) => {
//               const map = mappingRef.current[sym.symbol] || {};
//               (['A', 'B', 'C'] as Venue[]).forEach((venue) => {
//                 const sid = map[VENUE_FIELD[venue]];
//                 if (sid) idToSymbol[String(sid)] = { symbol: sym.symbol, venue };
//               });
//             });
//             Object.entries(data.data || {}).forEach(([segment, bucket]) => {
//               const venue: Venue | null =
//                 segment === 'NSE_EQ' ? 'A' : segment === 'BSE_EQ' ? 'B' : segment === 'NSE_FNO' ? 'C' : null;
//               if (!venue) return;
//               Object.entries(bucket || {}).forEach(([id, item]) => {
//                 const hit = idToSymbol[String(id)];
//                 if (!hit || hit.venue !== venue) return;
//                 const price = quoteSidePrice(item as { price?: number; last_price?: number; bid_price?: number; ask_price?: number }, venue);
//                 if (price == null) return;
//                 const field = venue === 'A' ? 'priceA' : venue === 'B' ? 'priceB' : 'priceC';
//                 next[hit.symbol] = { ...(next[hit.symbol] || {}), [field]: price, updatedAt: Date.now() };
//               });
//             });
//             return next;
//           });
//         }
//         if (data.type === 'tick' && data.segment && data.security_id != null) {
//           const venue: Venue | null =
//             data.segment === 'NSE_EQ' ? 'A' : data.segment === 'BSE_EQ' ? 'B' : data.segment === 'NSE_FNO' ? 'C' : null;
//           if (venue) {
//             const field = venue === 'A' ? 'priceA' : venue === 'B' ? 'priceB' : 'priceC';
//             const tickItem = data as { price?: number; last_price?: number; bid_price?: number; ask_price?: number };
//             const price = quoteSidePrice(tickItem, venue);
//             if (price != null) {
//               setQuotes((current) => {
//                 const next = { ...current };
//                 symbolsRef.current.forEach((symbol) => {
//                   const map = mappingRef.current[symbol.symbol] || {};
//                   if (String(map[VENUE_FIELD[venue]] || '') === String(data.security_id)) {
//                     next[symbol.symbol] = { ...(next[symbol.symbol] || {}), [field]: price, updatedAt: Date.now() };
//                   }
//                 });
//                 return next;
//               });
//             }
//           }
//         }
//       } catch { /* Ignore malformed feed messages. */ }
//     };
//     return () => { socket.close(); };
//     // The socket intentionally binds once; its handlers read the initial feed shape.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     const socket = socketRef.current;
//     if (!socket || socket.readyState !== WebSocket.OPEN) return;
//     const body: Record<string, number[]> = {};
//     (['NSE_EQ', 'BSE_EQ', 'NSE_FNO'] as const).forEach((segment) => {
//       const venue = segment === 'NSE_EQ' ? 'A' : segment === 'BSE_EQ' ? 'B' : 'C';
//       const ids = symbols.map((item) => Number(mapping[item.symbol]?.[VENUE_FIELD[venue]])).filter(Number.isFinite);
//       if (ids.length) body[segment] = ids;
//     });
//     if (Object.keys(body).length) socket.send(JSON.stringify({ action: 'subscribe', ...body }));
//   }, [symbols, mapping, connected]);

//   const filteredAccounts = accounts.filter((item) => item.broker === broker);
//   return (
//     <div className="min-w-0 space-y-5 font-mono text-slate-200">
//       <header className="flex flex-wrap items-start justify-between gap-4">
//         <div>
//           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-accent"><span className={`h-2 w-2 rounded-full ${connected ? 'bg-accent shadow-[0_0_12px_rgba(45,212,191,0.8)]' : 'bg-danger'}`} /> Local proxy tool</div>
//           <h1 className="mt-2 font-display text-2xl font-bold text-amber-300">Arbitrage Scanner <span className="text-slate-500">/ arb_proxy</span></h1>
//           <p className="mt-1 text-xs text-slate-500">NSE cash ask vs BSE cash ask vs NSE futures bid</p>
//         </div>
//         <div className="flex flex-wrap items-center justify-end gap-2">
//           {brokers.length > 0 && <select value={broker} onChange={(event) => { setBroker(event.target.value); setAccount(filteredAccounts[0]?.label || ''); }} className="rounded-md border border-slate-700 bg-[#0d1928] px-2 py-2 text-xs text-slate-200"><option value="">Broker</option>{brokers.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select>}
//           {filteredAccounts.length > 0 && <select value={account} onChange={(event) => setAccount(event.target.value)} className="rounded-md border border-slate-700 bg-[#0d1928] px-2 py-2 text-xs text-slate-200"><option value="">Client</option>{filteredAccounts.map((item) => <option key={item.label} value={item.label}>{item.label} {item.client_id_masked ? `(${item.client_id_masked})` : ''}</option>)}</select>}
//           <button type="button" onClick={() => void loadMapping()} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-amber-300 hover:text-amber-300">↻ Refresh</button>
//         </div>
//       </header>

//       <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-[#101a28] px-4 py-3 text-xs"><span className={`h-2 w-2 rounded-full ${connected ? 'bg-accent' : 'bg-slate-600'}`} /><span className={connected ? 'text-accent' : 'text-slate-400'}>{message}</span><span className="ml-auto text-slate-500">{mappedCount}/{symbols.length} fully mapped</span></div>

//       <section className="grid gap-3 lg:grid-cols-3">
//         <div className="rounded-lg border border-slate-800 bg-[#101a28] p-4"><label className="mb-2 block text-xs text-slate-500">Min spread threshold <span className="font-semibold text-amber-300">{threshold.toFixed(2)}%</span></label><input type="range" min="0" max="3" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="w-full accent-amber-300" /><div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>0%</span><span>3%</span></div></div>
//         <div className="rounded-lg border border-slate-800 bg-[#101a28] p-4"><span className="mb-2 block text-xs text-slate-500">Buy leg</span><div className="flex gap-1.5">{(['all', 'A', 'B', 'C'] as Direction[]).map((item) => <button key={item} type="button" onClick={() => setDirection(item)} className={`flex-1 rounded-md border px-2 py-2 text-[11px] font-semibold ${direction === item ? 'border-amber-300 bg-amber-300/10 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{item === 'all' ? 'All' : `Buy ${VENUE_LABEL[item]}`}</button>)}</div></div>
//         <div className="rounded-lg border border-slate-800 bg-[#101a28] p-4"><label className="mb-2 block text-xs text-slate-500" htmlFor="arb-search">Search symbol</label><input id="arb-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. RELIANCE" className="w-full rounded-md border border-slate-700 bg-transparent px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-300" /></div>
//       </section>

//       <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0d141e] shadow-panel">
//         <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 text-xs"><span><span className="font-bold text-amber-300">{rows.length}</span> opportunities at or above {threshold.toFixed(2)}%</span><span className="text-slate-500">{loading ? 'Loading instruments…' : connected ? 'Streaming live' : 'Waiting for feed'}</span></div>
//         <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead className="border-b border-slate-800 text-left text-slate-500"><tr>{['Symbol', 'NSE Ask', 'BSE Ask', 'FUT Bid', 'Spread ₹', 'Spread %', 'Action'].map((heading) => <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${heading !== 'Symbol' && heading !== 'Action' ? 'text-right' : ''}`}>{heading}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600">Waiting for live prices. Check the mapping and local proxy.</td></tr> : rows.map((row) => <tr key={row.symbol} className="border-b border-slate-900 transition hover:bg-slate-900/60"><td className="px-4 py-3"><div className="font-semibold text-slate-200">{row.symbol}</div><div className="mt-0.5 text-[10px] text-slate-600">lot {row.lotSize}</div></td><td className="px-4 py-3 text-right text-slate-300">{formatPrice(row.priceA)}</td><td className="px-4 py-3 text-right text-slate-300">{formatPrice(row.priceB)}</td><td className="px-4 py-3 text-right text-slate-300">{formatPrice(row.priceC)}</td><td className="px-4 py-3 text-right text-slate-300">{row.spread == null ? '—' : `${row.spread >= 0 ? '+' : '-'}₹${Math.abs(row.spread).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td><td className={`px-4 py-3 text-right font-semibold ${(row.spreadPct ?? 0) >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{formatSpreadPct(row.spreadPct)}</td><td className="px-4 py-3 whitespace-nowrap"><span className="inline-block rounded px-2 py-1 text-[10px] font-semibold" style={{ color: actionBadgeStyle(row).color, background: actionBadgeStyle(row).bg }}>{actionBadgeStyle(row).text}</span>{row.buyVenue && row.sellVenue ? (<button type="button" className="ml-1.5 rounded border border-teal-500/40 bg-teal-400/10 px-2 py-1 text-[10px] font-semibold text-teal-400 transition hover:border-teal-400" onClick={() => { /* trade modal hook — same as HTML Trade */ window.dispatchEvent(new CustomEvent('arb-trade', { detail: row })); }}>Trade</button>) : null}</td></tr>)}</tbody></table></div>
//       </section>

//       <section className="rounded-lg border border-slate-800 bg-[#101a28]">
//         <button type="button" onClick={() => setMappingOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-slate-300 hover:text-amber-300">
//           <span>Symbol → Security ID mapping</span>
//           <span>{mappingOpen ? '−' : '+'}</span>
//         </button>
//         {mappingOpen && <div className="border-t border-slate-800 p-4">
//           <p className="mb-3 text-[11px] leading-5 text-slate-500">IDs are auto-detected from the Dhan instrument master. Futures contracts change each expiry.</p>
//           <div className="max-h-72 overflow-auto">
//             <table className="w-full text-[11px]">
//               <thead className="text-left text-slate-500">
//                 <tr>
//                   <th className="px-2 py-2">Symbol</th>
//                   <th className="px-2 py-2">NSE_EQ</th>
//                   <th className="px-2 py-2">BSE_EQ</th>
//                   <th className="px-2 py-2">NSE_FNO</th>
//                   <th className="px-2 py-2">Status</th>
//                 </tr>
//               </thead>
//             <tbody>
//               {symbols.map((item) => { const entry = mapping[item.symbol] || {}; 
//               const complete = entry.nseEq && entry.bseEq && entry.nseFut; 
//               return <tr key={item.symbol} className="border-t border-slate-900">
//                 <td className="px-2 py-2 text-slate-300">{item.symbol}</td>
//                 <td className="px-2 py-2 text-slate-500">{entry.nseEq || '—'}</td>
//                 <td className="px-2 py-2 text-slate-500">{entry.bseEq || '—'}</td>
//                 <td className="px-2 py-2 text-slate-500">{entry.nseFut || '—'}</td>
//                 <td className={`px-2 py-2 ${complete ? 'text-accent' : 'text-danger'}`}>{complete ? 'complete' : 'missing'}</td></tr>; })}
//             </tbody></table></div></div>}
//       </section>
//     </div>
//   );
// }

import { useEffect, useMemo, useRef, useState } from 'react';
import { wsUrl } from '../../api/api';
import { BASE_URL } from '../../api/baseurl';

type Venue = 'A' | 'B' | 'C';
type Direction = 'all' | Venue;

interface SymbolRow {
  symbol: string;
  name: string;
  lotSize: number;
}

interface Mapping {
  nseEq?: string;
  bseEq?: string;
  nseFut?: string;
  futExpiry?: string;
}

interface Quote {
  priceA?: number;
  priceB?: number;
  priceC?: number;
  updatedAt?: number;
}

interface Opportunity extends SymbolRow {
  priceA?: number;
  priceB?: number;
  priceC?: number;
  spread?: number;
  spreadPct?: number;
  buyVenue?: Venue;
  sellVenue?: Venue;
}

interface AccountResponse {
  brokers?: Array<{ key: string; name: string }>;
  accounts?: Array<{ broker: string; label: string; client_id_masked?: string }>;
  default?: { broker?: string; label?: string };
}

interface PnlRates {
  brokerage_buy: number;
  brokerage_sell: number;
  stt_buy_pct: number;
  stt_sell_fut_pct: number;
  txn_buy_pct: number;
  txn_sell_fut_pct: number;
  sebi_buy_pct: number;
  sebi_sell_pct: number;
  stamp_buy_pct: number;
  stamp_sell_pct: number;
  dp_charge: number;
  gst_pct: number;
}

interface PnlResult {
  gross: number;
  charges: number;
  net: number;
  per_share: number;
  buy_value: number;
  sell_value: number;
}

const VENUE_LABEL: Record<Venue, string> = { A: 'NSE', B: 'BSE', C: 'FUT' };
const VENUE_FIELD: Record<Venue, keyof Mapping> = { A: 'nseEq', B: 'bseEq', C: 'nseFut' };
const VENUE_SEG: Record<Venue, string> = { A: 'NSE_EQ', B: 'BSE_EQ', C: 'NSE_FNO' };

function formatPrice(value?: number) {
  return value == null || Number.isNaN(value)
    ? '—'
    : `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function quoteSidePrice(
  item: { price?: number; last_price?: number; bid_price?: number; ask_price?: number } | undefined,
  venue: Venue,
): number | undefined {
  if (!item) return undefined;
  if (venue === 'C') {
    const v = item.bid_price ?? item.price ?? item.last_price;
    const price = Number(v);
    return Number.isFinite(price) ? price : undefined;
  }
  const v = item.ask_price ?? item.price ?? item.last_price;
  const price = Number(v);
  return Number.isFinite(price) ? price : undefined;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(current); current = ''; }
    else current += char;
  }
  cells.push(current);
  return cells;
}

function buildOpportunities(symbols: SymbolRow[], quotes: Record<string, Quote>): Opportunity[] {
  return symbols.map((symbol) => {
    const quote = quotes[symbol.symbol] || {};
    const pairs: Array<{ pa?: number; pb?: number; buyLeg: Venue; sellLeg: Venue }> = [
      { pa: quote.priceA, pb: quote.priceB, buyLeg: 'A', sellLeg: 'B' },
      { pa: quote.priceA, pb: quote.priceC, buyLeg: 'A', sellLeg: 'C' },
      { pa: quote.priceB, pb: quote.priceC, buyLeg: 'B', sellLeg: 'C' },
    ];
    let best: Opportunity = { ...symbol, ...quote };
    pairs.forEach((p) => {
      if (p.pa == null || p.pb == null || Math.min(p.pa, p.pb) <= 0) return;
      const spread = p.pa - p.pb;
      const spreadPct = (spread / Math.min(p.pa, p.pb)) * 100;
      const buyVenue: Venue | undefined =
        spread > 0 ? p.sellLeg : spread < 0 ? p.buyLeg : undefined;
      const sellVenue: Venue | undefined =
        spread > 0 ? p.buyLeg : spread < 0 ? p.sellLeg : undefined;
      if (best.spreadPct == null || Math.abs(spreadPct) > Math.abs(best.spreadPct)) {
        best = { ...best, spread, spreadPct, buyVenue, sellVenue };
      }
    });
    return best;
  });
}

function actionBadgeStyle(row: Opportunity): { text: string; color: string; bg: string } {
  const canTrade = !!(row.buyVenue && row.sellVenue);
  const text = canTrade
    ? `Buy ${VENUE_LABEL[row.buyVenue!]} · Sell ${VENUE_LABEL[row.sellVenue!]}`
    : '—';
  const key = `${row.buyVenue || ''}${row.sellVenue || ''}`;
  const palette: Record<string, { color: string; bg: string }> = {
    AB: { color: '#2DD4BF', bg: 'rgba(45,212,191,0.14)' },
    BA: { color: '#F2A93B', bg: 'rgba(242,169,59,0.14)' },
    AC: { color: '#38BDF8', bg: 'rgba(56,189,248,0.14)' },
    CA: { color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' },
    BC: { color: '#34D399', bg: 'rgba(52,211,153,0.14)' },
    CB: { color: '#F472B6', bg: 'rgba(244,114,182,0.14)' },
  };
  const style = palette[key] || { color: '#94A3B8', bg: 'rgba(148,163,184,0.14)' };
  return { text, color: style.color, bg: style.bg };
}

function formatSpreadPct(value?: number) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function defaultPnlRates(): PnlRates {
  return {
    brokerage_buy: 20,
    brokerage_sell: 20,
    stt_buy_pct: 0.10,
    stt_sell_fut_pct: 0.02,
    txn_buy_pct: 0.00297,
    txn_sell_fut_pct: 0.00173,
    sebi_buy_pct: 0.0001,
    sebi_sell_pct: 0.0001,
    stamp_buy_pct: 0.015,
    stamp_sell_pct: 0,
    dp_charge: 0,
    gst_pct: 18,
  };
}

function computePnl(qty: number, buyPrice: number, sellPrice: number, rates: PnlRates): PnlResult {
  const buyValue = qty * buyPrice;
  const sellValue = qty * sellPrice;
  const gross = sellValue - buyValue;
  const brokerage = (rates.brokerage_buy || 0) + (rates.brokerage_sell || 0);
  const stt = buyValue * (rates.stt_buy_pct || 0) / 100 + sellValue * (rates.stt_sell_fut_pct || 0) / 100;
  const txn = buyValue * (rates.txn_buy_pct || 0) / 100 + sellValue * (rates.txn_sell_fut_pct || 0) / 100;
  const sebi = buyValue * (rates.sebi_buy_pct || 0) / 100 + sellValue * (rates.sebi_sell_pct || 0) / 100;
  const stamp = buyValue * (rates.stamp_buy_pct || 0) / 100 + sellValue * (rates.stamp_sell_pct || 0) / 100;
  const dp = rates.dp_charge || 0;
  const taxable = brokerage + txn + sebi;
  const gst = taxable * (rates.gst_pct || 0) / 100;
  const charges = brokerage + stt + txn + sebi + stamp + dp + gst;
  const net = gross - charges;
  return {
    gross: round2(gross),
    charges: round2(charges),
    net: round2(net),
    per_share: qty > 0 ? round2(net / qty) : 0,
    buy_value: round2(buyValue),
    sell_value: round2(sellValue),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function productTypeFor(venue: Venue) {
  return venue === 'C' ? 'MARGIN' : 'CNC';
}

function priceForVenue(row: Opportunity, venue: Venue): number | undefined {
  return venue === 'A' ? row.priceA : venue === 'B' ? row.priceB : row.priceC;
}

// ---------------------------------------------------------------------------
// Trade modal
// ---------------------------------------------------------------------------
function TradeModal({
  row,
  mapping,
  broker,
  account,
  brokers,
  accounts,
  onClose,
  onBrokerChange,
  onAccountChange,
}: {
  row: Opportunity;
  mapping: Mapping;
  broker: string;
  account: string;
  brokers: Array<{ key: string; name: string }>;
  accounts: Array<{ broker: string; label: string; client_id_masked?: string }>;
  onClose: () => void;
  onBrokerChange: (b: string) => void;
  onAccountChange: (a: string) => void;
}) {
  const [lots, setLots] = useState(1);
  const [rates, setRates] = useState<PnlRates>(defaultPnlRates);
  const [showRates, setShowRates] = useState(false);
  const [busy, setBusy] = useState<'margin' | 'pnl' | 'order' | false>(false);
  const [marginResult, setMarginResult] = useState<{ total: number; legMargins: number[] } | null>(null);
  const [marginError, setMarginError] = useState<string | null>(null);
  const [pnlResult, setPnlResult] = useState<PnlResult | null>(null);
  const [pnlError, setPnlError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<unknown>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const lotSize = row.lotSize || 1;
  const qty = lots * lotSize;
  const buyPrice = row.buyVenue ? priceForVenue(row, row.buyVenue) : undefined;
  const sellPrice = row.sellVenue ? priceForVenue(row, row.sellVenue) : undefined;
  const filteredAccounts = accounts.filter((a) => a.broker === broker);

  function buildLegs() {
    if (!row.buyVenue || !row.sellVenue) return [];
    const make = (venue: Venue, txn: 'BUY' | 'SELL') => {
      const securityId = mapping[VENUE_FIELD[venue]] || '';
      const price = priceForVenue(row, venue) ?? 0;
      return {
        exchangeSegment: VENUE_SEG[venue],
        transactionType: txn,
        quantity: qty,
        productType: productTypeFor(venue),
        securityId: String(securityId),
        price: Number(price) || 0,
        orderType: 'MARKET',
        validity: 'DAY',
      };
    };
    return [make(row.buyVenue, 'BUY'), make(row.sellVenue, 'SELL')];
  }

  async function checkMargin() {
    if (busy) return;
    if (!broker || !account) {
      setMarginError('Select a broker and client account first.');
      return;
    }
    setBusy('margin');
    setMarginError(null);
    setMarginResult(null);
    try {
      const legs = buildLegs();
      const resp = await fetch(`${BASE_URL}/api/margin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs, broker, account }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail || json));
      }
      const legMargins = (json.legs || []).map((l: { totalMargin?: number }) => Number(l.totalMargin || 0));
      setMarginResult({ legMargins, total: Number(json.totalMargin || 0) });
    } catch (e) {
      setMarginError(`Margin check failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function checkPnl() {
    if (busy) return;
    if (buyPrice == null || sellPrice == null || qty <= 0) {
      setPnlError('Need live buy/sell prices and quantity.');
      return;
    }
    setBusy('pnl');
    setPnlError(null);
    try {
      // Prefer server if available; fall back to local calc
      void (async () => {
        try {
          const resp = await fetch(`${BASE_URL}/api/pnl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: qty, buy_price: buyPrice, sell_price: sellPrice, rates }),
          });
          if (resp.ok) {
            const json = await resp.json();
            setPnlResult({
              gross: Number(json.gross ?? json.gross_pnl ?? 0),
              charges: Number(json.charges ?? json.total_charges ?? 0),
              net: Number(json.net ?? json.net_pnl ?? 0),
              per_share: Number(json.per_share ?? 0),
              buy_value: Number(json.buy_value ?? qty * buyPrice),
              sell_value: Number(json.sell_value ?? qty * sellPrice),
            });
            setBusy(false);
            return;
          }
        } catch { /* local fallback */ }
        setPnlResult(computePnl(qty, buyPrice, sellPrice, rates));
        setBusy(false);
      })();
    } catch (e) {
      setPnlError(`P&L check failed: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }

  async function placeOrders() {
    if (busy) return;
    if (!broker || !account) {
      setOrderError('Select a broker and client account first.');
      return;
    }
    const legs = buildLegs();
    const brokerName = brokers.find((b) => b.key === broker)?.name || broker;
    const ok = window.confirm(
      `Place REAL orders on ${brokerName} account "${account}"?\n\n` +
      `BUY  ${row.buyVenue ? VENUE_LABEL[row.buyVenue] : '—'}  qty ${qty}\n` +
      `SELL ${row.sellVenue ? VENUE_LABEL[row.sellVenue] : '—'}  qty ${qty}\n\n` +
      `This cannot be undone.`,
    );
    if (!ok) return;
    setBusy('order');
    setOrderError(null);
    setOrderResult(null);
    try {
      const resp = await fetch(`${BASE_URL}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs, broker, account }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail || json));
      }
      setOrderResult(json.orders ?? json);
    } catch (e) {
      setOrderError(`Order placement failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const rateFields: Array<[keyof PnlRates, string]> = [
    ['brokerage_buy', 'Brokerage — buy leg (₹ flat)'],
    ['brokerage_sell', 'Brokerage — sell leg (₹ flat)'],
    ['stt_buy_pct', 'STT — buy leg (%)'],
    ['stt_sell_fut_pct', 'STT — sell leg (%)'],
    ['txn_buy_pct', 'Exchange txn charge — buy (%)'],
    ['txn_sell_fut_pct', 'Exchange txn charge — sell (%)'],
    ['sebi_buy_pct', 'SEBI fee — buy (%)'],
    ['sebi_sell_pct', 'SEBI fee — sell (%)'],
    ['stamp_buy_pct', 'Stamp duty — buy (%)'],
    ['stamp_sell_pct', 'Stamp duty — sell (%)'],
    ['dp_charge', 'DP charge (₹ flat)'],
    ['gst_pct', 'GST (%)'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-slate-800 bg-[#111418] shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="font-display text-sm font-bold text-amber-300">
            Trade {row.symbol}
          </h3>
          <button type="button" onClick={onClose} className="text-lg text-slate-500 hover:text-slate-200">×</button>
        </div>
        <div className="space-y-3 p-4 text-xs">
          {/* Legs */}
          {row.buyVenue && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-[#0F1216] px-3 py-2.5">
              <div>
                <span className="font-semibold text-teal-400">BUY</span>
                <span className="ml-2 text-slate-500">{VENUE_LABEL[row.buyVenue]} · {VENUE_SEG[row.buyVenue]}</span>
              </div>
              <span className="font-semibold text-slate-200">{formatPrice(buyPrice)}</span>
            </div>
          )}
          {row.sellVenue && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-[#0F1216] px-3 py-2.5">
              <div>
                <span className="font-semibold text-red-400">SELL</span>
                <span className="ml-2 text-slate-500">{VENUE_LABEL[row.sellVenue]} · {VENUE_SEG[row.sellVenue]}</span>
              </div>
              <span className="font-semibold text-slate-200">{formatPrice(sellPrice)}</span>
            </div>
          )}

          {/* Lots */}
          <div className="flex items-center gap-3">
            <label className="text-slate-500">Lots</label>
            <input
              type="number"
              min={1}
              value={lots}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setLots(Number.isFinite(v) && v > 0 ? v : 1);
                setMarginResult(null);
                setPnlResult(null);
              }}
              className="w-20 rounded-md border border-slate-800 bg-[#0F1216] px-2 py-1.5 text-slate-200 outline-none focus:border-amber-300"
            />
            <span className="text-[10px] text-slate-600">lot size {lotSize} · qty {qty}</span>
          </div>

          {/* Account */}
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-slate-500">Broker</label>
            <select
              value={broker}
              onChange={(e) => {
                onBrokerChange(e.target.value);
                const first = accounts.find((a) => a.broker === e.target.value);
                onAccountChange(first?.label || '');
                setMarginResult(null);
              }}
              className="flex-1 rounded-md border border-slate-800 bg-[#0F1216] px-2 py-1.5 text-slate-200"
            >
              <option value="">Select broker</option>
              {brokers.map((b) => (
                <option key={b.key} value={b.key}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-slate-500">Client</label>
            <select
              value={account}
              onChange={(e) => { onAccountChange(e.target.value); setMarginResult(null); }}
              className="flex-1 rounded-md border border-slate-800 bg-[#0F1216] px-2 py-1.5 text-slate-200"
            >
              <option value="">Select client</option>
              {filteredAccounts.map((a) => (
                <option key={a.label} value={a.label}>
                  {a.label}{a.client_id_masked ? ` (${a.client_id_masked})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void checkMargin()}
              className="flex-1 rounded-md border border-teal-500/40 bg-teal-400/10 px-3 py-2 font-semibold text-teal-400 hover:border-teal-400 disabled:opacity-40"
            >
              {busy === 'margin' ? 'Checking…' : 'Check required margin'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={checkPnl}
              className="flex-1 rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-2 font-semibold text-amber-300 hover:border-amber-300 disabled:opacity-40"
            >
              {busy === 'pnl' ? 'Calculating…' : 'Check P&L'}
            </button>
          </div>
          <button
            type="button"
            disabled={!!busy || !account}
            onClick={() => void placeOrders()}
            className="w-full rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-semibold text-red-400 hover:border-red-400 disabled:opacity-40"
          >
            {busy === 'order' ? 'Placing…' : 'Place both orders'}
          </button>

          {/* Margin result */}
          {marginError && <p className="text-[11px] text-red-400">{marginError}</p>}
          {marginResult && (
            <div className="rounded-md border border-slate-800 bg-[#0F1216] px-3 py-2">
              <div className="text-slate-500">Required margin</div>
              <div className="text-sm font-bold text-amber-300">
                ₹{marginResult.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              {marginResult.legMargins.length > 0 && (
                <div className="mt-1 text-[10px] text-slate-600">
                  Legs: {marginResult.legMargins.map((m) => `₹${m.toFixed(2)}`).join(' + ')}
                </div>
              )}
            </div>
          )}

          {/* P&L result */}
          {pnlError && <p className="text-[11px] text-red-400">{pnlError}</p>}
          {pnlResult && (
            <div className="rounded-md border border-slate-800 bg-[#0F1216] px-3 py-2 space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Gross</span><span className="text-slate-300">₹{pnlResult.gross.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Charges</span><span className="text-red-400">−₹{pnlResult.charges.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-500">Net</span>
                <span className={`text-sm font-bold ${pnlResult.net >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                  ₹{pnlResult.net.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-600">₹{pnlResult.per_share.toFixed(2)} per share</div>
            </div>
          )}

          {/* Order result */}
          {orderError && <p className="text-[11px] text-red-400 whitespace-pre-wrap">{orderError}</p>}
          {orderResult != null && (
            <pre className="overflow-x-auto rounded-md border border-slate-800 bg-[#0F1216] p-2 text-[10px] text-slate-400">
              {JSON.stringify(orderResult, null, 2)}
            </pre>
          )}

          {/* Charge rates */}
          <details className="pt-1" open={showRates} onToggle={(e) => setShowRates((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-amber-300">Charge rates (edit for P&L)</summary>
            <div className="mt-2 grid grid-cols-[1fr_70px] gap-x-2 gap-y-1.5 text-[10px] text-slate-500">
              {rateFields.map(([key, label]) => (
                <div key={key} className="contents">
                  <span>{label}</span>
                  <input
                    type="number"
                    step="any"
                    value={rates[key]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setRates((r) => ({ ...r, [key]: Number.isFinite(v) ? v : 0 }));
                      setPnlResult(null);
                    }}
                    className="rounded border border-slate-800 bg-[#0F1216] px-1.5 py-0.5 text-right text-slate-200"
                  />
                </div>
              ))}
            </div>
          </details>

          <p className="text-[10px] leading-5 text-slate-600">
            Places real MARKET orders on the selected broker — cash legs use CNC, futures use MARGIN/NRML, same quantity on both legs. Double-check before confirming.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ArbProxyPage() {
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, Mapping>>({});
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [threshold, setThreshold] = useState(0.3);
  const [direction, setDirection] = useState<Direction>('all');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Connecting to local proxy…');
  const [broker, setBroker] = useState('');
  const [account, setAccount] = useState('');
  const [brokers, setBrokers] = useState<Array<{ key: string; name: string }>>([]);
  const [accounts, setAccounts] = useState<Array<{ broker: string; label: string; client_id_masked?: string }>>([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [tradeRow, setTradeRow] = useState<Opportunity | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const symbolsRef = useRef(symbols);
  const mappingRef = useRef(mapping);

  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
  useEffect(() => { mappingRef.current = mapping; }, [mapping]);

  const mappedCount = symbols.filter((item) => {
    const entry = mapping[item.symbol];
    return entry?.nseEq && entry.bseEq && entry.nseFut;
  }).length;

  const rows = useMemo(() => buildOpportunities(symbols, quotes)
    .filter((row) => row.spreadPct != null && Math.abs(row.spreadPct) >= threshold)
    .filter((row) => direction === 'all' || row.buyVenue === direction)
    .filter((row) => !query.trim() || row.symbol.includes(query.trim().toUpperCase()))
    .sort((a, b) => Math.abs(b.spreadPct || 0) - Math.abs(a.spreadPct || 0)), [symbols, quotes, threshold, direction, query]);

  async function loadAccounts() {
    try {
      const response = await fetch(`${BASE_URL}/api/accounts`);
      if (!response.ok) return;
      const data = await response.json() as AccountResponse;
      const nextBrokers = data.brokers || [];
      const nextAccounts = data.accounts || [];
      setBrokers(nextBrokers);
      setAccounts(nextAccounts);
      const defaultBroker = data.default?.broker || nextBrokers[0]?.key || '';
      setBroker(defaultBroker);
      setAccount(data.default?.label || nextAccounts.find((item) => item.broker === defaultBroker)?.label || '');
    } catch { /* optional */ }
  }

  async function loadMapping() {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/scrip-master`);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (!lines.length) throw new Error('Empty instrument master');
      const header = parseCsvLine(lines[0]).map((item) => item.trim().toLowerCase());
      const index = (...names: string[]) => names.map((name) => header.indexOf(name)).find((value) => value >= 0) ?? -1;
      const exchangeIndex = index('exch_id');
      const segmentIndex = index('segment');
      const securityIndex = index('security_id');
      const instrumentIndex = index('instrument');
      const underlyingIndex = index('underlying_symbol');
      const symbolIndex = index('symbol_name');
      const expiryIndex = index('sm_expiry_date');
      const lotIndex = index('lot_size', 'lot_units');
      const today = new Date();
      const futures = new Map<string, { id: string; expiry: string; expiryDate: Date; lotSize: number }>();
      const equities: Array<{ exchange: string; symbol: string; underlying: string; id: string }> = [];
      lines.slice(1).forEach((line) => {
        const cells = parseCsvLine(line);
        const exchange = (cells[exchangeIndex] || '').trim();
        const segment = (cells[segmentIndex] || '').trim();
        const instrument = (cells[instrumentIndex] || '').trim().toUpperCase();
        const underlying = (cells[underlyingIndex] || '').trim().toUpperCase();
        const symbol = (cells[symbolIndex] || '').trim().toUpperCase();
        const id = (cells[securityIndex] || '').trim();
        if (exchange !== 'NSE' && exchange !== 'BSE') return;
        if (exchange === 'NSE' && segment === 'D' && instrument === 'FUTSTK') {
          const expiry = (cells[expiryIndex] || '').trim();
          const expiryDate = new Date(expiry);
          const key = underlying || symbol;
          if (!key || Number.isNaN(expiryDate.getTime()) || expiryDate < today) return;
          const existing = futures.get(key);
          if (!existing || expiryDate < existing.expiryDate) {
            futures.set(key, { id, expiry, expiryDate, lotSize: Number(cells[lotIndex]) || 1 });
          }
        } else if (instrument === 'EQUITY' && segment === 'E') {
          equities.push({ exchange, symbol, underlying, id });
        }
      });
      const nextSymbols = [...futures.keys()].sort().map((symbol) => ({
        symbol,
        name: symbol,
        lotSize: futures.get(symbol)?.lotSize || 1,
      }));
      const nextMapping: Record<string, Mapping> = {};
      nextSymbols.forEach(({ symbol }) => {
        const future = futures.get(symbol);
        nextMapping[symbol] = { nseFut: future?.id, futExpiry: future?.expiry };
      });
      equities.forEach((row) => {
        const key = futures.has(row.underlying) ? row.underlying : futures.has(row.symbol) ? row.symbol : '';
        if (!key) return;
        if (row.exchange === 'NSE' && !nextMapping[key].nseEq) nextMapping[key].nseEq = row.id;
        if (row.exchange === 'BSE' && !nextMapping[key].bseEq) nextMapping[key].bseEq = row.id;
      });
      setSymbols(nextSymbols);
      setMapping(nextMapping);
      setMessage(nextSymbols.length ? 'Live feed ready' : 'No futures symbols detected');
    } catch (error) {
      setMessage(`Unable to load instrument master: ${error instanceof Error ? error.message : 'proxy unavailable'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadAccounts(), loadMapping()]);
    const socket = new WebSocket(wsUrl('/ws/ltp'));
    socketRef.current = socket;
    socket.onopen = () => { setConnected(true); setMessage('Live feed connected'); };
    socket.onclose = () => { setConnected(false); setMessage('Live feed disconnected'); };
    socket.onerror = () => setMessage('WebSocket error: check the local proxy');
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          data?: Record<string, Record<string, { price?: number; last_price?: number; bid_price?: number; ask_price?: number }>>;
          segment?: string;
          security_id?: string | number;
          price?: number;
          last_price?: number;
          bid_price?: number;
          ask_price?: number;
        };
        if (data.type === 'snapshot' && data.data) {
          setQuotes((current) => {
            const next: Record<string, Quote> = { ...current };
            symbolsRef.current.forEach((item) => { next[item.symbol] = current[item.symbol] || {}; });
            const idToSymbol: Record<string, { symbol: string; venue: Venue }> = {};
            symbolsRef.current.forEach((sym) => {
              const map = mappingRef.current[sym.symbol] || {};
              (['A', 'B', 'C'] as Venue[]).forEach((venue) => {
                const sid = map[VENUE_FIELD[venue]];
                if (sid) idToSymbol[String(sid)] = { symbol: sym.symbol, venue };
              });
            });
            Object.entries(data.data || {}).forEach(([segment, bucket]) => {
              const venue: Venue | null =
                segment === 'NSE_EQ' ? 'A' : segment === 'BSE_EQ' ? 'B' : segment === 'NSE_FNO' ? 'C' : null;
              if (!venue) return;
              Object.entries(bucket || {}).forEach(([id, item]) => {
                const hit = idToSymbol[String(id)];
                if (!hit || hit.venue !== venue) return;
                const price = quoteSidePrice(item, venue);
                if (price == null) return;
                const field = venue === 'A' ? 'priceA' : venue === 'B' ? 'priceB' : 'priceC';
                next[hit.symbol] = { ...(next[hit.symbol] || {}), [field]: price, updatedAt: Date.now() };
              });
            });
            return next;
          });
        }
        if (data.type === 'tick' && data.segment && data.security_id != null) {
          const venue: Venue | null =
            data.segment === 'NSE_EQ' ? 'A' : data.segment === 'BSE_EQ' ? 'B' : data.segment === 'NSE_FNO' ? 'C' : null;
          if (venue) {
            const field = venue === 'A' ? 'priceA' : venue === 'B' ? 'priceB' : 'priceC';
            const price = quoteSidePrice(data, venue);
            if (price != null) {
              setQuotes((current) => {
                const next = { ...current };
                symbolsRef.current.forEach((symbol) => {
                  const map = mappingRef.current[symbol.symbol] || {};
                  if (String(map[VENUE_FIELD[venue]] || '') === String(data.security_id)) {
                    next[symbol.symbol] = { ...(next[symbol.symbol] || {}), [field]: price, updatedAt: Date.now() };
                  }
                });
                return next;
              });
            }
          }
        }
      } catch { /* ignore */ }
    };
    return () => { socket.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const body: Record<string, number[]> = {};
    (['NSE_EQ', 'BSE_EQ', 'NSE_FNO'] as const).forEach((segment) => {
      const venue = segment === 'NSE_EQ' ? 'A' : segment === 'BSE_EQ' ? 'B' : 'C';
      const ids = symbols.map((item) => Number(mapping[item.symbol]?.[VENUE_FIELD[venue]])).filter(Number.isFinite);
      if (ids.length) body[segment] = ids;
    });
    if (Object.keys(body).length) socket.send(JSON.stringify({ action: 'subscribe', ...body }));
  }, [symbols, mapping, connected]);

  const filteredAccounts = accounts.filter((item) => item.broker === broker);

  return (
    <div className="min-w-0 space-y-5 font-mono text-slate-200">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-accent">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-accent shadow-[0_0_12px_rgba(45,212,191,0.8)]' : 'bg-danger'}`} />
            Local proxy tool
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-amber-300">
            Arbitrage Scanner <span className="text-slate-500">/ arb_proxy</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">NSE cash ask vs BSE cash ask vs NSE futures bid</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {brokers.length > 0 && (
            <select
              value={broker}
              onChange={(event) => {
                setBroker(event.target.value);
                setAccount(filteredAccounts[0]?.label || '');
              }}
              className="rounded-md border border-slate-700 bg-[#0d1928] px-2 py-2 text-xs text-slate-200"
            >
              <option value="">Broker</option>
              {brokers.map((item) => (
                <option key={item.key} value={item.key}>{item.name}</option>
              ))}
            </select>
          )}
          {filteredAccounts.length > 0 && (
            <select
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              className="rounded-md border border-slate-700 bg-[#0d1928] px-2 py-2 text-xs text-slate-200"
            >
              <option value="">Client</option>
              {filteredAccounts.map((item) => (
                <option key={item.label} value={item.label}>
                  {item.label} {item.client_id_masked ? `(${item.client_id_masked})` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void loadMapping()}
            className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-amber-300 hover:text-amber-300"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-[#101a28] px-4 py-3 text-xs">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-accent' : 'bg-slate-600'}`} />
        <span className={connected ? 'text-accent' : 'text-slate-400'}>{message}</span>
        <span className="ml-auto text-slate-500">{mappedCount}/{symbols.length} fully mapped</span>
      </div>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-[#101a28] p-4">
          <label className="mb-2 block text-xs text-slate-500">
            Min spread threshold <span className="font-semibold text-amber-300">{threshold.toFixed(2)}%</span>
          </label>
          <input type="range" min="0" max="3" step="0.05" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-amber-300" />
          <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>0%</span><span>3%</span></div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#101a28] p-4">
          <span className="mb-2 block text-xs text-slate-500">Buy leg</span>
          <div className="flex gap-1.5">
            {(['all', 'A', 'B', 'C'] as Direction[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDirection(item)}
                className={`flex-1 rounded-md border px-2 py-2 text-[11px] font-semibold ${
                  direction === item ? 'border-amber-300 bg-amber-300/10 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {item === 'all' ? 'All' : `Buy ${VENUE_LABEL[item]}`}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#101a28] p-4">
          <label className="mb-2 block text-xs text-slate-500" htmlFor="arb-search">Search symbol</label>
          <input
            id="arb-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. RELIANCE"
            className="w-full rounded-md border border-slate-700 bg-transparent px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-300"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0d141e] shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 text-xs">
          <span>
            <span className="font-bold text-amber-300">{rows.length}</span> opportunities at or above {threshold.toFixed(2)}%
          </span>
          <span className="text-slate-500">
            {loading ? 'Loading instruments…' : connected ? 'Streaming live' : 'Waiting for feed'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="border-b border-slate-800 text-left text-slate-500">
              <tr>
                {['Symbol', 'NSE Ask', 'BSE Ask', 'FUT Bid', 'Spread ₹', 'Spread %', 'Action'].map((heading) => (
                  <th
                    key={heading}
                    className={`whitespace-nowrap px-4 py-3 font-medium ${heading !== 'Symbol' && heading !== 'Action' ? 'text-right' : ''}`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                    Waiting for live prices. Check the mapping and local proxy.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const badge = actionBadgeStyle(row);
                  return (
                    <tr key={row.symbol} className="border-b border-slate-900 transition hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{row.symbol}</div>
                        <div className="mt-0.5 text-[10px] text-slate-600">lot {row.lotSize}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatPrice(row.priceA)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatPrice(row.priceB)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatPrice(row.priceC)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {row.spread == null
                          ? '—'
                          : `${row.spread >= 0 ? '+' : '-'}₹${Math.abs(row.spread).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${(row.spreadPct ?? 0) >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                        {formatSpreadPct(row.spreadPct)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className="inline-block rounded px-2 py-1 text-[10px] font-semibold"
                          style={{ color: badge.color, background: badge.bg }}
                        >
                          {badge.text}
                        </span>
                        {row.buyVenue && row.sellVenue ? (
                          <button
                            type="button"
                            className="ml-1.5 rounded border border-teal-500/40 bg-teal-400/10 px-2 py-1 text-[10px] font-semibold text-teal-400 transition hover:border-teal-400"
                            onClick={() => setTradeRow(row)}
                          >
                            Trade
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-[#101a28]">
        <button
          type="button"
          onClick={() => setMappingOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-slate-300 hover:text-amber-300"
        >
          <span>Symbol → Security ID mapping</span>
          <span>{mappingOpen ? '−' : '+'}</span>
        </button>
        {mappingOpen && (
          <div className="border-t border-slate-800 p-4">
            <p className="mb-3 text-[11px] leading-5 text-slate-500">
              IDs are auto-detected from the Dhan instrument master. Futures contracts change each expiry.
            </p>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">NSE_EQ</th>
                    <th className="px-2 py-2">BSE_EQ</th>
                    <th className="px-2 py-2">NSE_FNO</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {symbols.map((item) => {
                    const entry = mapping[item.symbol] || {};
                    const complete = entry.nseEq && entry.bseEq && entry.nseFut;
                    return (
                      <tr key={item.symbol} className="border-t border-slate-900">
                        <td className="px-2 py-2 text-slate-300">{item.symbol}</td>
                        <td className="px-2 py-2 text-slate-500">{entry.nseEq || '—'}</td>
                        <td className="px-2 py-2 text-slate-500">{entry.bseEq || '—'}</td>
                        <td className="px-2 py-2 text-slate-500">{entry.nseFut || '—'}</td>
                        <td className={`px-2 py-2 ${complete ? 'text-accent' : 'text-danger'}`}>
                          {complete ? 'complete' : 'missing'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {tradeRow && (
        <TradeModal
          row={tradeRow}
          mapping={mapping[tradeRow.symbol] || {}}
          broker={broker}
          account={account}
          brokers={brokers}
          accounts={accounts}
          onClose={() => setTradeRow(null)}
          onBrokerChange={setBroker}
          onAccountChange={setAccount}
        />
      )}
    </div>
  );
}
