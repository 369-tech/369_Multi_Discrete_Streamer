import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api';
import { useWebSocket } from './useWebSocket';

export interface DTDTrade {
  trading_symbol?: string;
  symbol?: string;
  margin?: string | number;
  quantity?: string | number;
  previous?: string | number;
  fixed?: string | number;
  level?: string | number;
  target_price?: string | number;
  target?: string | number;
  trigger_price?: string | number;
  trigger?: string | number;
  stop_loss_price?: string | number;
  sl_price?: string | number;
  bid_ask?: string | number;
  bid?: string | number;
  ltp?: string | number;
  sl_type?: string;
  status?: string;
  [key: string]: unknown;
}

export interface DTDMonitorRow {
  __key: string;
  client_id: string;
  tradeType: string;
  trade: DTDTrade;
  status?: string;
  signal?: string;
  trade_price?: string | number;
  timestamp?: string;
}

interface SnapshotResponse {
  data?: unknown[];
}

function clientIdOf(item: Record<string, any>): string {
  return String(item.userId ?? item.client_id ?? 'UNKNOWN');
}

function symbolOf(trade: DTDTrade): string {
  return String(trade.trading_symbol ?? trade.symbol ?? '');
}

export function useDTDMonitorFeed(clientId: string | null, mode: 'dtd' | 'dtd-sl') {
  const [rows, setRows] = useState<Record<string, DTDMonitorRow>>({});
  const endpoint = mode === 'dtd' ? '/initial-dtd-monitor' : '/initial-dtd-sl-monitor';
  const socketPath = mode === 'dtd' ? '/ws/dtd-monitor' : '/ws/dtd-sl-monitor';

  const store = useCallback((item: Record<string, any>) => {
    if (!item) return;
    const client = clientIdOf(item);

    if (mode === 'dtd') {
      (['high_break_trade', 'low_break_trade'] as const).forEach((field) => {
        const trade = item[field] as DTDTrade | undefined;
        if (!trade || !symbolOf(trade)) return;
        const tradeType = field === 'high_break_trade' ? 'HIGH BREAK' : 'LOW BREAK';
        const key = `${client}|${tradeType}|${symbolOf(trade)}`;
        setRows((previous) => ({
          ...previous,
          [key]: { __key: key, client_id: client, tradeType, trade, ...item },
        }));
      });
      return;
    }

    const trade = (item.trade ?? item) as DTDTrade;
    const symbol = symbolOf(trade);
    if (!symbol) return;
    const tradeType = String(item.tradeType ?? item.trade_type ?? 'DTD_SL');
    const key = `${client}|${tradeType}|${symbol}`;
    setRows((previous) => ({
      ...previous,
      [key]: { __key: key, client_id: client, tradeType, trade, ...item },
    }));
  }, [mode]);

  useEffect(() => {
    setRows({});
    if (!clientId) return;

    let cancelled = false;
    api.get<SnapshotResponse>(`${endpoint}/${encodeURIComponent(clientId)}`)
      .then((result) => {
        if (cancelled) return;
        (result?.data ?? []).forEach((item) => store(item as Record<string, any>));
      })
      .catch((error) => console.error(`Failed loading ${mode} snapshot`, error));

    return () => { cancelled = true; };
  }, [clientId, endpoint, mode, store]);

  const handleMessage = useCallback((item: Record<string, any>) => {
    store(item);
  }, [store]);

  const { status: wsStatus } = useWebSocket(socketPath, handleMessage, Boolean(clientId));

  return { rows: Object.values(rows), wsStatus };
}