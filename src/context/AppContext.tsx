import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../../api/api';

type ProviderName = 'symphony' | 'dhan';
type StatusName = 'healthy' | 'error' | null;
type UserProviderMap = Record<string, ProviderName>;
type UserStatusMap = Record<string, StatusName>;
type PositionEntry = Record<string, unknown>;
type PositionMap = Record<string, PositionEntry>;

// interface ActiveUsersPayload {
//   data?: unknown;
//   parent?: {
//     Parent?: string | number | null;
//   } | null;
//   broker?: Record<string, unknown> | null;
// }

function normalizeClientIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flat() // in case of nested arrays
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }

  if (typeof raw === 'string') {
    return raw
      .split(/[,;\s]+/) // support more separators
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeSLClientIds(raw: unknown): string[] {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? ((raw as { data?: unknown; clients?: unknown; active_users?: unknown }).data
        ?? (raw as { clients?: unknown }).clients
        ?? (raw as { active_users?: unknown }).active_users)
      : raw;

  if (!Array.isArray(source)) return normalizeClientIds(source);

  return source
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
      if (item && typeof item === 'object') {
        const client = item as { client_id?: unknown; user_id?: unknown; id?: unknown };
        return String(client.client_id ?? client.user_id ?? client.id ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function normalizeProvider(value: unknown): ProviderName | null {
  if (value === 'symphony' || value === 'dhan') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.includes('symph')) return 'symphony';
    if (normalized.includes('dhan')) return 'dhan';
  }
  return null;
}

interface AppContextValue {
  clients: string[];
  slClients: string[];
  parentId: string;
  activeClientId: string | null;
  isClientsLoaded: boolean;
  selectClient: (uid: string) => void;
  userProvider: UserProviderMap;
  setProviderFor: (uid: string, provider: ProviderName) => void;
  userStatus: UserStatusMap;
  setStatusFor: (uid: string, status: StatusName) => void;
  logs: string[];
  appendLog: (msg: string) => void;
  clearLogs: () => void;
  reloadClients: () => Promise<void>;
  allPositions: PositionMap;
  setPositionsForUser: (uid: string, positionMap: PositionEntry) => void;
  mismatchMap: Record<string, boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<string[]>([]);
  const [slClients, setSLClients] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string>('999SP2');
  const [isClientsLoaded, setIsClientsLoaded] = useState(false);
  const [activeClientId, setActiveClientId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('selectedUser') || null;
  });
  const [userProvider, setUserProvider] = useState<UserProviderMap>({});
  const [userStatus, setUserStatus] = useState<UserStatusMap>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [allPositions, setAllPositions] = useState<PositionMap>({});

  const appendLog = useCallback((msg: string) => {
    const time = new Date().toISOString().substr(11, 8);
    setLogs((prev) => [`${time}  ${msg}`, ...prev].slice(0, 300));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const setStatusFor = useCallback((uid: string, status: StatusName) => {
    setUserStatus((prev) => ({ ...prev, [uid]: status }));
  }, []);

  const setProviderFor = useCallback((uid: string, provider: ProviderName) => {
    setUserProvider((prev) => (prev[uid] === provider ? prev : { ...prev, [uid]: provider }));
  }, []);

  const setPositionsForUser = useCallback((uid: string, positionMap: PositionEntry) => {
    setAllPositions((prev) => ({ ...prev, [uid]: positionMap }));
  }, []);

  const normalizeSymbol = (p: PositionEntry) => {
    const sym = (p.TradingSymbol || p.tradingSymbol || p.symbol || '').toString().trim();
    if (!sym) return null;
    if (sym.includes(' ')) {
      const parts = sym.split(/\s+/);
      return parts.length === 4 ? sym.toUpperCase() : null;
    }
    const parts = sym.split('-');
    if (parts.length !== 4) return null;
    const [base, exp, strike, type] = parts;
    const expiry = (p.drvExpiryDate || '').toString().slice(0, 10);
    if (!expiry) return null;
    const [year, month, day] = expiry.split('-');
    if (!year || !month || !day) return null;
    const mon = exp.slice(0, 3).toUpperCase();
    return `${base.toUpperCase()} ${day}${mon}${year} ${type.toUpperCase()} ${strike}`;
  };

  const getPositionSet = (uid: string) => {
    const set = new Set<string>();
    Object.values(allPositions[uid] || {}).forEach((p) => {
      const norm = normalizeSymbol(p as PositionEntry);
      if (norm) set.add(norm);
    });
    return set;
  };

  const mismatchMap = React.useMemo<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    const users = Object.keys(userProvider);
    if (users.length < 2) return map;

    const symUsers = users.filter((u) => userProvider[u] === 'symphony');
    const dhanUsers = users.filter((u) => userProvider[u] === 'dhan');
    if (symUsers.length === 0 || dhanUsers.length === 0) return map;

    const allSymSet = new Set<string>();
    symUsers.forEach((u) => getPositionSet(u).forEach((s) => allSymSet.add(s)));
    const allDhanSet = new Set<string>();
    dhanUsers.forEach((u) => getPositionSet(u).forEach((s) => allDhanSet.add(s)));

    const symMissingInDhan = [...allSymSet].some((s) => !allDhanSet.has(s));
    const dhanMissingInSym = [...allDhanSet].some((s) => !allSymSet.has(s));
    const hasMismatch = symMissingInDhan || dhanMissingInSym;

    [...symUsers, ...dhanUsers].forEach((u) => {
      map[u] = u === parentId ? false : hasMismatch;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPositions, userProvider, parentId]);

  const selectClient = useCallback((uid: string) => {
    setActiveClientId(uid);
    window.localStorage.setItem('selectedUser', uid);
  }, []);

  // Replace the entire loadClients function
const loadClients = useCallback(async () => {
  appendLog('Fetching /active-users');
  try {
    const raw = await api.getActiveUsers<any>(); // Use any to inspect full response
    const j = raw as any; // Keep for now

    appendLog(`Raw active-users response: ${JSON.stringify(j).slice(0, 500)}...`);

    // === More flexible client extraction ===
    let users: string[] = [];

    if (Array.isArray(j)) {
      users = normalizeClientIds(j);
    } else if (Array.isArray(j?.data)) {
      users = normalizeClientIds(j.data);
    } else if (Array.isArray(j?.users)) {
      users = normalizeClientIds(j.users);
    } else if (Array.isArray(j?.active_users) || Array.isArray(j?.clients)) {
      users = normalizeClientIds(j.active_users || j.clients);
    } else if (typeof j?.data === 'string' || typeof j === 'string') {
      users = normalizeClientIds(j.data || j);
    } else {
      // Fallback: try to find any array in the response
      for (const key of Object.keys(j || {})) {
        if (Array.isArray(j[key])) {
          users = normalizeClientIds(j[key]);
          if (users.length > 0) break;
        }
      }
    }

    // Parent ID
    const pid = typeof j?.parent?.Parent === 'string' || typeof j?.parent?.Parent === 'number'
      ? String(j.parent.Parent)
      : (j?.parent_id || j?.parentId || '999SP2');

    setParentId(pid);

    // Broker providers
    const brokerEntries = Object.entries(j?.broker || j?.providers || {}) as Array<[string, unknown]>;
    const providerMap = brokerEntries.reduce<UserProviderMap>((acc, [uid, value]) => {
      const provider = normalizeProvider(value);
      if (provider) acc[uid] = provider;
      return acc;
    }, {});

    if (Object.keys(providerMap).length > 0) {
      setUserProvider(providerMap);
    }

    const uniqueClients = Array.from(new Set(users.filter(Boolean)));
    const orderedClients = pid && uniqueClients.includes(pid)
      ? [pid, ...uniqueClients.filter((uid) => uid !== pid)]
      : uniqueClients;

    setClients(orderedClients);
    setIsClientsLoaded(true);

    appendLog(`Active users loaded: ${JSON.stringify(orderedClients)} (${uniqueClients.length} total)`);

    // Select logic
    const saved = window.localStorage.getItem('selectedUser');
    if (saved && orderedClients.includes(saved)) {
      selectClient(saved);
    } else if (orderedClients.length > 0) {
      selectClient(orderedClients[0]);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    setIsClientsLoaded(true);
    appendLog(`ERROR fetching /active-users: ${message}`);
    console.error('Active users fetch failed:', e);
  }
}, [appendLog, selectClient]);

  const loadSLClients = useCallback(async () => {
    try {
      const result = await api.getSLClientList<unknown>();
      setSLClients(Array.from(new Set(normalizeSLClientIds(result))));
    } catch (e) {
      appendLog(`ERROR fetching /sl_client_list: ${e instanceof Error ? e.message : String(e)}`);
      setSLClients([]);
    }
  }, [appendLog]);

  useEffect(() => {
    loadClients();
    loadSLClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AppContextValue = {
    clients,
    slClients,
    parentId,
    activeClientId,
    isClientsLoaded,
    selectClient,
    userProvider,
    setProviderFor,
    userStatus,
    setStatusFor,
    logs,
    appendLog,
    clearLogs,
    reloadClients: loadClients,
    allPositions,
    setPositionsForUser,
    mismatchMap,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
