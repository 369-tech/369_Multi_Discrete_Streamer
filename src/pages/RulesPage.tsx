import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import { useApp } from '../context/AppContext';
import Table from '../components/common/Table';

interface RuleRecord {
  index?: string | number;
  TradingSymbol?: string;
  Quantity?: string | number;
  NetAmount?: string | number;
  result_passed?: string[];
  result_failed?: string[];
  'result.warnings'?: string[];
  warnings?: string[];
}

interface RuleResponse {
  data?: RuleRecord[];
}

interface StaticRule {
  text: string;
}

interface StaticRulesObjectResponse {
  success?: boolean;
  rules?: StaticRule[];
}

type StaticRulesResponse = StaticRule[] | StaticRulesObjectResponse;

interface RuleRow {
  __key: string;
  index: string | number;
  symbol: string;
  qty: string | number;
  netAmount: string | number;
  passed: string;
  failed: string;
  warnings: string;
}

export default function RulesPage() {
  const { parentId } = useApp();
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [status, setStatus] = useState('loading'); // loading | ok | error | empty
  const [staticRules, setStaticRules] = useState<StaticRule[]>([]);
  const [staticStatus, setStaticStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const json = await api.getRules<RuleResponse>();
        const records = json.data || [];
        if (!Array.isArray(records) || records.length === 0) {
          if (!cancelled) setStatus('empty');
          return;
        }
        records.sort((a, b) => (a.TradingSymbol || '').toUpperCase().localeCompare((b.TradingSymbol || '').toUpperCase()));
        const built = records.map((r, i) => ({
          __key: `${r.index}-${i}`,
          index: r.index ?? '—',
          symbol: r.TradingSymbol || '—',
          qty: r.Quantity ?? '—',
          netAmount: r.NetAmount ?? '—',
          passed: (r.result_passed || []).join(', ') || '—',
          failed: (r.result_failed || []).join(', ') || '—',
          warnings: (r['result.warnings'] || r.warnings || []).join(', ') || '—',
        }));
        if (!cancelled) { setRows(built); setStatus('ok'); }
      } catch (e) {
        if (!cancelled) setStatus('error');
      }
    })();

    (async () => {
      setStaticStatus('loading');
      try {
        const json = await api.getStaticRules<StaticRulesResponse>();
        const rules = Array.isArray(json) ? json : json.rules;
        if (!rules || rules.length === 0) {
          if (!cancelled) setStaticStatus('empty');
          return;
        }
        if (!cancelled) { setStaticRules(rules); setStaticStatus('ok'); }
      } catch (e) {
        if (!cancelled) setStaticStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const columns: { key: string; header: string; align?: 'left' | 'right' }[] = [
    { key: 'index', header: 'Index' },
    { key: 'symbol', header: 'Symbol' },
    { key: 'qty', header: 'Quantity', align: 'right' },
    { key: 'netAmount', header: 'Net Amount', align: 'right' },
    { key: 'passed', header: 'Passed Rules' },
    { key: 'failed', header: 'Failed Rules' },
    { key: 'warnings', header: 'Warnings' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Risk controls</p>
        <h1 className="font-display text-2xl font-bold text-slate-100">
        Position Rules Evaluation — Client {parentId}
        </h1>
      </div>

      {status === 'loading' && <p className="py-10 text-center text-slate-400">Loading rule results…</p>}
      {status === 'error' && <p className="py-10 text-center font-medium text-danger">Error loading rules. Check console.</p>}
      {status === 'empty' && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-surface-soft px-6 py-10 text-center shadow-panel">
          <p className="font-medium text-slate-200">No positions found for rule evaluation.</p>
          <p className="mt-2 text-sm text-slate-500">Rule results will appear here when this client has open positions.</p>
        </div>
      )}
      {status === 'ok' && <Table columns={columns} rows={rows} emptyMessage="No rule results" />}

      <section className="border-t border-slate-800 pt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reference policy</p>
            <h2 className="font-display text-xl font-semibold text-slate-100">General Trading Rules</h2>
          </div>
          {staticStatus === 'ok' && <span className="text-xs text-slate-500">{staticRules.length} rules</span>}
        </div>
        {staticStatus === 'loading' && <p className="text-center text-slate-400">Loading static rules…</p>}
        {staticStatus === 'error' && <p className="text-center font-medium text-danger">Failed to load static rules.</p>}
        {staticStatus === 'empty' && <p className="text-center text-slate-500">No general trading rules available.</p>}
        {staticStatus === 'ok' && (
          <ol className="list-decimal space-y-3 rounded-xl border border-slate-700/80 bg-surface-soft p-5 pl-10 text-sm leading-relaxed text-slate-300 shadow-panel marker:text-accent">
            {staticRules.map((rule, i) => (
              <li key={i}>{rule.text}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
