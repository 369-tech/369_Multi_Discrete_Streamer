import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { api } from '../../api/api';

function keyFor(p: any): string | null {
  const sym =
    p.TradingSymbol ||
    p.tradingSymbol ||
    p.trading_symbol ||
    p.symbol;
  const id =
    p.ExchangeInstrumentId ||
    p.securityId ||
    p.instrumentId ||
    p.exchange_token ||
    p.exchangeToken;
  return sym && id ? `${sym}_${id}` : (sym ? sym : null); // fallback to symbol only if no id
}

function netQtyOf(p: any): number {
  return Number(
    p.NetQty || p.netQty || p.Quantity || p.quantity || p.NetQuantity ||
    (Number(p.OpenBuyQuantity || p.buyQty || 0) - Number(p.OpenSellQuantity || p.sellQty || 0))
  );
}

export interface PositionRow extends Record<string, unknown> {
  __key: string;
  symbol: string;
  buyQty: number;
  sellQty: number;
  netQty: number;
  buyAvg: string;
  sellAvg: string;
  expiry: string;
  broker: string;
  raw: any;
}

interface PositionUpdateOptions {
  onProviderDetected?: (uid: string, prov: string) => void;
  onPositionsChange?: (uid: string, posMap: Record<string, any>) => void;
  appendLog?: (msg: string) => void;
}

interface PositionsResponse {
  positions?: Record<string, unknown>[];
}

/**
 * usePositionsFeed — loads initial position snapshot then keeps it live via
 * /ws/positions. Reports the provider ('dhan'|'symphony') detected for the
 * current user and pushes the raw position map up via onPositionsChange
 * (used for cross-account mismatch detection in AppContext).
 */
export function usePositionsFeed(
  currentUser: string | null | undefined,
  { onProviderDetected, onPositionsChange, appendLog }: PositionUpdateOptions = {}
) {
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [isDhan, setIsDhan] = useState(false);
  const [isSymphony, setIsSymphony] = useState(false);
  const providerMapRef = useRef<Record<string, string>>({});

  const applyPositionMap = useCallback((posMap: Record<string, any>, uid: string) => {
    const provider = providerMapRef.current[uid];
    const dhan = provider === 'dhan';
    const sym = provider === 'symphony';
    setIsDhan(dhan);
    setIsSymphony(sym);

    const list = Object.values(posMap).filter((p) => {
      const q = netQtyOf(p);
      return !isNaN(q) && q !== 0;
    });

    list.sort((a, b) => {
      const symA = (a.TradingSymbol || a.tradingSymbol || a.trading_symbol || a.symbol || '').trim().toUpperCase();
      const symB = (b.TradingSymbol || b.tradingSymbol || b.trading_symbol || b.symbol || '').trim().toUpperCase();
      return symA.localeCompare(symB);
    });

    const normalized: PositionRow[] = list.map((p) => {
      const symbol =
        p.TradingSymbol ||
        p.tradingSymbol ||
        p.trading_symbol ||   // ← added
        p.symbol ||
        '';

      const buyAvg = Number(
        p.BuyAveragePrice ||
        p.buyAvg ||
        p.buyAverage ||
        p.Actualaverage_buy_price ||  // ← added
        0
      ).toFixed(2);

      const sellAvg = Number(
        p.ActualSellAveragePrice ||
        p.SellAveragePrice ||
        p.sellAvg ||
        p.sellAverage ||
        p.Actualaverage_sell_price || // ← added
        0
      ).toFixed(2);

      const symBuyQty = Number(p.OpenBuyQuantity || p.buyQty || 0);
      const symSellQty = Number(p.OpenSellQuantity || p.sellQty || 0);
      const dhanNetQty = Number(p.netQty || p.NetQty || p.NetQuantity || 0);
      const symNetQty = Number(p.Quantity || p.quantity || (symBuyQty - symSellQty) || 0); // ← quantity
      const netQty = symNetQty || dhanNetQty;

      const expiry = p.drvExpiryDate || p.expiry || ''; // ← expiry

      return {
        __key: keyFor(p) || symbol,
        symbol,
        buyQty: symBuyQty,
        sellQty: symSellQty,
        netQty,
        buyAvg,
        sellAvg,
        expiry,
        broker: dhan ? 'Dhan' : sym ? 'Symphony' : 'Unknown',
        raw: p,
      };
    });

    setRows(normalized);
    onPositionsChange?.(uid, posMap);
  }, [onPositionsChange]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getInitialPositions<PositionsResponse>(currentUser);
        if (cancelled) return;
        const tmp: Record<string, any> = {};
        (data?.positions || []).forEach((p: any) => {
          const k = keyFor(p);
          if (k) tmp[k] = p;
        });
        applyPositionMap(tmp, currentUser);
        appendLog?.(`Initial Positions Loaded: ${Object.keys(tmp).length}`);
      } catch (e: any) {
        appendLog?.(`ERROR loading initial positions: ${e.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, applyPositionMap, appendLog]);

  const handleMessage = useCallback((msg: any) => {
    if (msg.userId && msg.provider) {
      providerMapRef.current[msg.userId] = msg.provider;
      onProviderDetected?.(msg.userId, msg.provider);
    }
    if (!['position_snapshot', 'position_update'].includes(msg.event_type)) return;
    if (String(msg.userId) !== String(currentUser)) return;
    if (!Array.isArray(msg.payload)) return;

    const posMap = msg.payload.reduce((acc: Record<string, any>, p: any) => {
      const k = keyFor(p);
      if (k) acc[k] = p;
      return acc;
    }, {});
    applyPositionMap(posMap, msg.userId);
  }, [currentUser, applyPositionMap, onProviderDetected]);

  const { status: wsStatus } = useWebSocket('/ws/positions', handleMessage, true);

  const totalNetQty = rows.reduce((a, r) => a + (r.netQty || 0), 0);

  async function addPosition(symbol: string, qty: number, orderType: string, expiry?: string) {
    return api.addPosition({ 
      clientId: currentUser, 
      symbol, 
      quantity: qty, 
      broker: isDhan ? 'Dhan' : 'Symphony', 
      orderType, 
      expiry_date: expiry 
    });
  }

  async function reducePosition(symbol: string, qty: number, orderType: string, expiry?: string) {
    return api.reducePosition({ 
      clientId: currentUser, 
      symbol, 
      quantity: qty, 
      broker: isDhan ? 'Dhan' : 'Symphony', 
      orderType, 
      expiry_date: expiry 
    });
  }

  async function squareOffPosition(symbol: string, qty: number, orderType: string, expiry?: string) {
    return api.squareOffPosition({ 
      clientId: currentUser, 
      symbol, 
      quantity: qty, 
      broker: isDhan ? 'Dhan' : 'Symphony', 
      orderType, 
      expiry_date: expiry 
    });
  }

  return { 
    rows, 
    totalNetQty, 
    isDhan, 
    isSymphony, 
    wsStatus, 
    addPosition, 
    reducePosition, 
    squareOffPosition 
  };
}