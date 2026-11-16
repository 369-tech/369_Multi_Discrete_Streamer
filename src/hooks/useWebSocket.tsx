import { useEffect, useRef, useState } from 'react';
import { wsUrl } from '../../api/api';

export type WebSocketStatus = 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
  [key: string]: any;
}

/**
 * useWebSocket
 * Connects to `path` (e.g. "/ws/orders") and reports connection status,
 * forwarding every parsed JSON message to onMessage.
 */
export function useWebSocket(
  path: string,
  onMessage: (data: WebSocketMessage, event?: MessageEvent) => void,
  enabled: boolean = true
) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !path) return;

    let cancelled = false;
    const socket = new WebSocket(wsUrl(path));
    socketRef.current = socket;

    socket.onopen = () => {
      if (!cancelled) setStatus('connected');
    };
    socket.onclose = () => {
      if (!cancelled) setStatus('disconnected');
    };
    socket.onerror = () => {
      if (!cancelled) setStatus('error');
    };
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data, event);
      } catch (err) {
        console.error(`WS parse error on ${path}:`, err, event.data);
      }
    };

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [path, enabled]);

  return { status, socket: socketRef.current };
}