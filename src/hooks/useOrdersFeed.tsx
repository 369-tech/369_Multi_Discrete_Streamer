import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { api } from '../../api/api';

const VALID_DHAN_TYPES = ['LIMIT', 'STOP_LOSS', 'STOPLOSS', 'STOP_LIMIT', 'STOPLIMIT', 'SL', 'STOP_LOSS_MARKET'] as const;
const VALID_SYM_TYPES = ['LIMIT', 'STOPLIMIT', 'STOP_LIMIT', 'STOP_LOSS', 'SL', 'STOP_LOSS_MARKET'] as const;
const SYM_SKIP_STATUS = ['PENDINGNEW', 'CANCELLED', 'CANCELED', 'REJECTED', 'CXL', 'FILLED'] as const;

export type OrderProvider = 'dhan' | 'symphony' | null;

interface DhanOrderRow {
  __key: string;
  sym: string;
  qty: number;
}

interface SymOrderRow {
  __key: string;
  sym: string;
  side: string;
  status: string;
  qty: number;
  price: string;
  trigger: string;
}

interface OrderUpdateOptions {
  onStatus?: (uid: string, status: string, description?: string) => void;
  appendLog?: (msg: string) => void;
}

interface OrdersResponse {
  orders?: Record<string, unknown>[];
}

/**
 * useOrdersFeed — loads the initial order snapshot for a user, then keeps it
 * live via the /ws/orders websocket. Emits separate aggregated views for
 * Dhan and Symphony pending SL orders.
 */
export function useOrdersFeed(
  currentUser: string | null | undefined,
  { onStatus, appendLog }: OrderUpdateOptions = {}
) {
  const [dhanRows, setDhanRows] = useState<DhanOrderRow[]>([]);
  const [symRows, setSymRows] = useState<SymOrderRow[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [provider, setProvider] = useState<OrderProvider>(null);

  const dhanAggRef = useRef<Record<string, number>>({});

  const rebuildFromSnapshot = useCallback((payload: any[]) => {
    const dhanAgg: Record<string, number> = {};
    const symAggMap: Record<string, SymOrderRow> = {};
    let sawDhan = false;
    let sawSym = false;
    let dhanOrderCount = 0;
    let symOrderCount = 0;

    for (const o of payload) {
      const looksLikeSym = o.AppOrderID !== undefined || o.OrderStatus !== undefined || o.TradingSymbol !== undefined;
      const looksLikeDhan = !looksLikeSym && 
        (o.transactionType !== undefined || o.exchangeSegment !== undefined || o.exchangeOrderId !== undefined);

      if (looksLikeSym) {
        sawSym = true;
        const sym = o.TradingSymbol || o.trading_symbol || o.symbol || '';
        const side = String(o.OrderSide || o.side || '').toUpperCase();
        const status = String(o.OrderStatus || o.status || '').toUpperCase();
        const type = String(o.OrderType || o.order_type || '').toUpperCase();
        const qty = Number(o.OrderQuantity ?? o.quantity ?? o.qty ?? 0);
        if (!sym || !side || !status || qty <= 0) continue;
        if (!VALID_SYM_TYPES.some(t => t === type)) continue;
        if (SYM_SKIP_STATUS.some(s => s === status)) continue;
        symOrderCount += 1;

        const key = `${sym}|${side}|${status}`;
        if (!symAggMap[key]) {
          symAggMap[key] = { 
            __key: key, 
            sym, 
            side, 
            status, 
            qty: 0, 
            price: o.OrderPrice ?? o.price ?? '',
            trigger: o.OrderStopPrice ?? o.StopPrice ?? o.trigger_price ?? o.stop_price ?? ''
          };
        }
        symAggMap[key].qty += qty;
      } else if (looksLikeDhan) {
        sawDhan = true;
        const type = (o.orderType || '').toUpperCase();
        const status = (o.orderStatus || '').toUpperCase();
        if (!VALID_DHAN_TYPES.some(t => t === type)) continue;
        if (!['PENDING', 'TRANSIT'].includes(status)) continue;
        dhanOrderCount += 1;
        const sym = o.tradingSymbol || o.trading_symbol || '';
        const qty = Number(o.quantity || o.qty || 0);
        dhanAgg[sym] = (dhanAgg[sym] || 0) + qty;
      }
    }

    dhanAggRef.current = dhanAgg;
    setDhanRows(Object.entries(dhanAgg).map(([sym, qty]) => ({ __key: sym, sym, qty } as DhanOrderRow)));
    setSymRows(Object.values(symAggMap).sort((a, b) => a.sym.localeCompare(b.sym)));
    setProvider(sawDhan ? 'dhan' : sawSym ? 'symphony' : null);
    setOrderCount(sawDhan ? dhanOrderCount : sawSym ? symOrderCount : 0);
  }, []);

  // Initial REST snapshot on user change
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setDhanRows([]);
    setSymRows([]);
    setOrderCount(0);
    (async () => {
      try {
        const data = await api.getInitialOrders<OrdersResponse>(currentUser);
        if (cancelled) return;
        const orders = Array.isArray(data?.orders) ? data.orders : [];
        rebuildFromSnapshot(orders);
        appendLog?.(`Initial Orders Loaded: ${orders.length}`);
      } catch (e: any) {
        appendLog?.(`ERROR loading initial orders: ${e.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, rebuildFromSnapshot, appendLog]);

  // Live updates
  const handleMessage = useCallback((msg: any) => {
    if (msg.event_type !== 'order_update') return;
    const { userId, error, description } = msg;
    if (userId) onStatus?.(userId, error === true ? 'error' : 'healthy', description);
    if (String(msg.userId) !== String(currentUser)) return;
    if (!Array.isArray(msg.payload)) return;
    rebuildFromSnapshot(msg.payload);
  }, [currentUser, onStatus, rebuildFromSnapshot]);

  const { status: wsStatus } = useWebSocket('/ws/orders', handleMessage, true);

  const dhanTotal = dhanRows.reduce((a, r) => a + (r.qty || 0), 0);
  const symTotal = symRows.reduce((a, r) => a + (r.qty || 0), 0);

  return { 
    dhanRows, 
    symRows, 
    dhanTotal, 
    symTotal, 
    orderCount,
    provider, 
    wsStatus 
  };
}