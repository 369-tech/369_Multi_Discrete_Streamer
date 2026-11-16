import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { api } from '../../api/api';

const SIREN_SRC = '/static/audio/siren.mp3';

interface SLMonitorRow {
  trading_symbol: string;
  ltp?: string | number;
  trigger_price?: string | number;
  status?: string;
  [key: string]: any;
}

interface SLMonitorData {
  [symbol: string]: SLMonitorRow;
}

interface UseSLMonitorFeedOptions {
  appendLog?: (message: string) => void;
}

interface SLMonitorResponse {
  data?: SLMonitorRow[];
}

/**
 * useSLMonitorFeed — loads initial SL monitor + square-off snapshot for a
 * client, then keeps both live via /ws/sl-monitor.
 */
export function useSLMonitorFeed(
  currentUser: string | number | null | undefined,
  { appendLog }: UseSLMonitorFeedOptions = {}
) {
  const [slData, setSlData] = useState<SLMonitorData>({});
  const [squareOffData, setSquareOffData] = useState<SLMonitorData>({});

  const alertPlayedRef = useRef<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSlData({});
    setSquareOffData({});
    alertPlayedRef.current = {};
  }, [currentUser]);

  // Initialize audio
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(SIREN_SRC);
    }
  }, []);

  const playSiren = useCallback(() => {
    try {
      const audio = audioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      audio.loop = true;
      audio.play().catch(() => {});

      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, 30000);
    } catch (e) {
      // Ignore audio playback errors
    }
  }, []);

  const checkSirenAlert = useCallback((row: SLMonitorRow) => {
    const symbol = row.trading_symbol;
    const ltp = parseFloat(row.ltp as string);
    const trigger = parseFloat(row.trigger_price as string);

    if (!ltp || !trigger) return;

    const threshold = trigger * 0.75;

    if (ltp >= threshold) {
      if (alertPlayedRef.current[symbol]) return;
      alertPlayedRef.current[symbol] = true;
      playSiren();
    }
  }, [playSiren]);

  // Load initial SL Monitor data
  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    (async () => {
      try {
        const result = await api.getInitialSLMonitor<SLMonitorResponse>(currentUser);
        if (cancelled) return;

        const sq: SLMonitorData = {};
        (result?.data || []).forEach((row: SLMonitorRow) => {
          if (row.trading_symbol && row.status === 'SQUARED OFF') {
            sq[row.trading_symbol] = row;
          }
        });

        setSquareOffData(sq);
        appendLog?.(`Loaded initial SL data: squared off ${Object.keys(sq).length}`);
      } catch (e: any) {
        appendLog?.('Failed loading SL monitor data: ' + e.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, appendLog]);

  // WebSocket message handler
  const handleMessage = useCallback((data: any) => {
    if (data.userId !== currentUser) return;

    if (data.event_type === 'sl_monitor') {
      const newData = { ...slData, [data.trading_symbol]: data };
      setSlData(newData);
      checkSirenAlert(data);
    } else if (data.event_type === 'square_off') {
      setSquareOffData((prev) => ({ ...prev, [data.trading_symbol]: data }));
    }
  }, [currentUser, slData, checkSirenAlert]);

  const { status: wsStatus } = useWebSocket('/ws/sl-monitor', handleMessage, true);

  return { 
    slData, 
    squareOffData, 
    wsStatus 
  };
}