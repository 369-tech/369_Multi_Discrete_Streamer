import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, put } from '../lib/api'
import { useFilterStore } from '../lib/filterStore'
import type {
  BrokerSummaryRow,
  ClientProfile,
  ClientSummaryRow,
  DataQualitySummary,
  GlobalFilters,
  FilterOptions,
  Kpis,
  NetPnlResponse,
  OpenPosition,
  ProfitSummary,
  RoundTrip,
  SystemConfig,
  SystemHealth,
  TradeLookupResult,
  TradePage,
} from '../lib/types'

// Global filters are read from the zustand store so every hook here stays
// in sync with the filter bar without prop drilling.
function useFilters() {
  return useFilterStore((s: { filters: GlobalFilters }) => s.filters)
}

const REFRESH_MS = 60_000 // background poll interval; matches "auto-refresh" requirement

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: () => get<FilterOptions>('/filters/options'),
    refetchInterval: REFRESH_MS,
  })
}

export function useKpis() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => get<Kpis>('/overview/kpis', filters),
    refetchInterval: REFRESH_MS,
  })
}

export interface Snapshot {
  available: boolean
  reason?: string
  mode?: string
  investment_start_date?: string
  investment_end_date?: string
  trade_weeks?: number
  winning_weeks?: number
  losing_weeks?: number
  winning_streak?: number
  losing_streak?: number
  success_rate_pct?: number
  current_fy_return_pct?: number
  current_fy_label?: string
  max_drawdown_pct?: number
  max_drawdown_single_week_pct?: number
}

export function useSnapshot(mode: 'reference' | 'portfolio' | 'client', params?: { referenceClientId?: string; clientId?: string }) {
  return useQuery({
    queryKey: ['snapshot', mode, params],
    queryFn: () =>
      get<Snapshot>('/overview/snapshot', {
        mode,
        reference_client_id: params?.referenceClientId,
        client_id: params?.clientId,
      }),
    refetchInterval: REFRESH_MS,
    enabled: mode !== 'client' || !!params?.clientId,
  })
}

export function useClientGrowth() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-growth', filters],
    queryFn: () => get<{ day: string; cumulative_clients: number }[]>('/overview/client-growth', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useAumTrend() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['aum-trend', filters],
    queryFn: () => get<{ day: string; capital: number }[]>('/overview/aum-trend', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function usePnlGrowth() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['pnl-growth', filters],
    queryFn: () => get<{ trade_date: string; cumulative_pnl: number }[]>('/overview/pnl-growth', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useTradeLog(sortBy: string, ascending: boolean, page: number, pageSize: number) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['trade-log', filters, sortBy, ascending, page, pageSize],
    queryFn: () => get<TradePage>('/trades', { ...filters, sort_by: sortBy, ascending, page, page_size: pageSize }),
    refetchInterval: REFRESH_MS,
    placeholderData: (prev) => prev,
  })
}

export function useTradeLookup(identifier: string | null) {
  return useQuery({
    queryKey: ['trade-lookup', identifier],
    queryFn: () => get<TradeLookupResult>(`/trades/identifier/${encodeURIComponent(identifier!)}`),
    enabled: !!identifier,
  })
}

export function usePnlSummary() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['pnl-summary', filters],
    queryFn: () => get<ProfitSummary>('/pnl/summary', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function usePnlDaily() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['pnl-daily', filters],
    queryFn: () => get<{ trade_date: string; gross_profit: number; gross_loss: number; gross_pnl: number; round_trips: number; winning_round_trips: number; losing_round_trips: number }[]>(
      '/pnl/daily',
      filters,
    ),
    refetchInterval: REFRESH_MS,
  })
}

export function useRoundTrips(limit = 200) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['round-trips', filters, limit],
    queryFn: () => get<RoundTrip[]>('/pnl/by-round-trip', { ...filters, limit }),
    refetchInterval: REFRESH_MS,
  })
}

export function useNetPnlByClient() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['net-pnl-client', filters],
    queryFn: () => get<NetPnlResponse>('/pnl/net-by-client', filters),
    refetchInterval: REFRESH_MS,
  })
}

export interface StrategyStats {
  total_trades: number
  profitable_trades: number
  losing_trades: number
  gross_profit: number
  gross_loss: number
  accuracy: number
  max_loss: number
  profit: number
}

export interface StrategyBucket extends StrategyStats {
  key: string
  label: string
  cumulative_profit: number
  week_start?: string
}

export interface StrategyAnalysis {
  strategy: string
  strategies: string[]
  totals: StrategyStats
  monthly: StrategyBucket[]
  weekly: StrategyBucket[]
  by_strategy: (StrategyStats & { strategy: string })[]
  start_date: string
  end_date: string
}

// Trade-level P&L per month / expiry week, optionally for one strategy tag.
export function useStrategyAnalysis(strategy: string) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['strategy-analysis', filters, strategy],
    queryFn: () => get<StrategyAnalysis>('/pnl/strategy-analysis', { ...filters, strategy }),
    refetchInterval: REFRESH_MS,
    placeholderData: (prev) => prev,
  })
}

export interface ClientTradeRow {
  instrument: string
  strike: string | null
  option_type: string
  expiry: string
  strategy: string
  side: string
  quantity: number
  entry: number | null
  exit: number | null
  pnl: number
}

export interface ClientDetail {
  client_id: string
  client_name: string | null
  broker: string | null
  account_type: string | null
  instruments: string[]
  exchanges: string[]
  first_trade_date: string | null
  last_trade_date: string | null
  start_date: string
  end_date: string
  kpis: {
    executions: number
    total_quantity: number
    execution_value: number
    investment_amount: number
    gross_pnl: number
    net_pnl: number
    total_charges: number
    win_rate: number
  }
  statistics: {
    investment_start_date: string | null
    investment_end_date: string | null
    trade_weeks: number
    winning_weeks: number
    losing_weeks: number
    winning_streak: number
    losing_streak: number
    success_rate_pct: number
    current_fy_label: string
    current_fy_return_pct: number | null
    max_drawdown_pct: number
    max_drawdown_single_week_pct: number
  }
  timeline: { trade_date: string; gross_pnl: number; net_pnl: number; equity: number }[]
  best_trades: ClientTradeRow[]
  worst_trades: ClientTradeRow[]
  open_positions: {
    instrument: string
    strike: string | null
    option_type: string
    expiry: string
    strategy: string
    side: string
    open_qty: number
    avg_entry: number | null
    days_to_expiry: number
  }[]
  executions_total: number
  executions: {
    time: string
    exchange: string | null
    instrument: string | null
    strike: string | null
    option_type: string
    expiry: string | null
    side: string
    price: number
    quantity: number
    value: number
    strategy: string
  }[]
}

// Client detail page — the client comes from the URL, so the global client filter is ignored.
export function useClientDetail(clientId: string) {
  const { client_ids: _ignored, ...filters } = useFilters()
  return useQuery({
    queryKey: ['client-detail', clientId, filters],
    queryFn: () => get<ClientDetail>(`/pnl/client/${encodeURIComponent(clientId)}/detail`, filters),
    enabled: !!clientId,
    refetchInterval: REFRESH_MS,
  })
}

export function useNetPnlByBroker() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['net-pnl-broker', filters],
    queryFn: () => get<NetPnlResponse>('/pnl/net-by-broker', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useOpenPositions(clientId: string) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['open-positions', filters, clientId],
    queryFn: () => get<OpenPosition[]>(`/clients/${encodeURIComponent(clientId)}/open-positions`, filters),
    refetchInterval: REFRESH_MS,
    enabled: !!clientId,
  })
}

export function useRiskSummary() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['risk-summary', filters],
    queryFn: () => get<{ executions: number; clients: number; identifiers: number; instruments: number }>('/risk/summary', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useTradingActivity() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['trading-activity', filters],
    queryFn: () => get<{ trade_date: string; Instrument: string; executions: number }[]>('/risk/trading-activity', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useConcentration(topN = 5) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['concentration', filters, topN],
    queryFn: () =>
      get<{
        top_clients_share_pct: number
        top_instruments_share_pct: number
        top_clients: { ClientId: string; value: number }[]
        top_instruments: { Instrument: string; value: number }[]
      }>('/risk/concentration', { ...filters, top_n: topN }),
    refetchInterval: REFRESH_MS,
  })
}

export function useExecutionsPerDay() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['executions-per-day', filters],
    queryFn: () => get<{ trade_date: string; executions: number }[]>('/risk/executions-per-day', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useCategorySplit() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['category-split', filters],
    queryFn: () => get<{ category: string; executions: number }[]>('/risk/category-split', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useInstrumentList() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['instrument-list', filters],
    queryFn: () => get<string[]>('/options/instruments', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useStrikeDistribution(instrument: string | null) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['strike-dist', filters, instrument],
    queryFn: () => get<{ strike_numeric: number; Option_Type: string; executions: number }[]>('/options/strike-distribution', { ...filters, instrument }),
    enabled: !!instrument,
    refetchInterval: REFRESH_MS,
  })
}

export function useOptionTypeSplit() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['option-type-split', filters],
    queryFn: () => get<{ Option_Type: string; executions: number }[]>('/options/option-type-split', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useExpiryActivity() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['expiry-activity', filters],
    queryFn: () => get<{ expiry_day: string; executions: number; quantity: number }[]>('/options/expiry-activity', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useClientDirectory() {
  return useQuery({
    queryKey: ['client-directory'],
    queryFn: () => get<Record<string, string>>('/clients/directory'),
    staleTime: 5 * 60_000,
    refetchInterval: REFRESH_MS,
  })
}

// Every client id (distinct loginid) — feeds the filter bar Client dropdown.
// Not filter-scoped, so picking a client or date range never shrinks the list.
export function useClientIds() {
  return useQuery({
    queryKey: ['client-ids'],
    queryFn: () => get<string[]>('/clients/client_list'),
    staleTime: 5 * 60_000,
  })
}

export function useClientList() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-list', filters],
    queryFn: () => get<ClientSummaryRow[]>('/clients', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useBrokerList() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['broker-list', filters],
    queryFn: () => get<{ rows: BrokerSummaryRow[]; total: (BrokerSummaryRow & { clients: number }) | null }>('/clients/brokers', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useClientProfile(clientId: string) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-profile', clientId, filters],
    queryFn: () => get<ClientProfile>(`/clients/${encodeURIComponent(clientId)}/profile`, filters),
    enabled: !!clientId,
  })
}

export function useClientTrades(clientId: string, limit = 500) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-trades', clientId, filters, limit],
    queryFn: () => get<TradePage['rows']>(`/clients/${encodeURIComponent(clientId)}/trades`, { ...filters, limit }),
    enabled: !!clientId,
  })
}

export function useClientInstrumentMix(clientId: string) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-instrument-mix', clientId, filters],
    queryFn: () => get<{ Instrument: string; executions: number; quantity: number; execution_value: number }[]>(
      `/clients/${encodeURIComponent(clientId)}/instrument-mix`,
      filters,
    ),
    enabled: !!clientId,
  })
}

export function useClientPnlTimeline(clientId: string) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-pnl-timeline', clientId, filters],
    queryFn: () => get<{ trade_date: string; gross_profit: number; gross_loss: number; gross_pnl: number; round_trips: number }[]>(
      `/clients/${encodeURIComponent(clientId)}/pnl-timeline`,
      filters,
    ),
    enabled: !!clientId,
  })
}

export function useClientAumTimeline(clientId: string) {
  return useQuery({
    queryKey: ['client-aum-timeline', clientId],
    queryFn: () => get<{ aum_date: string; aum: number }[]>(`/clients/${encodeURIComponent(clientId)}/aum-timeline`),
    enabled: !!clientId,
  })
}

export function useClientBestWorst(clientId: string) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-best-worst', clientId, filters],
    queryFn: () => get<{ best: RoundTrip[]; worst: RoundTrip[] }>(`/clients/${encodeURIComponent(clientId)}/best-worst-trades`, filters),
    enabled: !!clientId,
  })
}

export function useAumSummary() {
  return useQuery({
    queryKey: ['aum-summary'],
    queryFn: () => get<{ current_aum: number; current_aum_date: string | null; weighted_aum: number; clients: number; brokers: number }>('/aum/summary'),
    refetchInterval: REFRESH_MS,
  })
}

export function useAumDaily() {
  return useQuery({
    queryKey: ['aum-daily'],
    queryFn: () => get<{ aum_date: string; aum: number }[]>('/aum/daily'),
    refetchInterval: REFRESH_MS,
  })
}

export function useAumByBroker() {
  return useQuery({
    queryKey: ['aum-by-broker'],
    queryFn: () => get<{ Broker: string; clients: number; aum: number }[]>('/aum/by-broker'),
    refetchInterval: REFRESH_MS,
  })
}

export function useDataQualitySummary() {
  return useQuery({
    queryKey: ['data-quality-summary'],
    queryFn: () => get<DataQualitySummary>('/data-quality/summary'),
    refetchInterval: REFRESH_MS,
  })
}

export function useDataQualityRows(limit = 500) {
  return useQuery({
    queryKey: ['data-quality-rows', limit],
    queryFn: () => get<Record<string, unknown>[]>('/data-quality/rows', { limit }),
  })
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: () => get<SystemHealth>('/system/health'),
    refetchInterval: 15_000,
  })
}

export function useSystemConfig() {
  return useQuery({
    queryKey: ['system-config'],
    queryFn: () => get<SystemConfig>('/system/config'),
  })
}

export function useClientLeaderboard(limit = 100) {
  const filters = useFilters()
  return useQuery({
    queryKey: ['client-leaderboard', filters, limit],
    queryFn: () => get<import('../lib/types').ClientSummaryRow[]>('/performance/client-leaderboard', { ...filters, limit }),
    refetchInterval: REFRESH_MS,
  })
}

export function useStrategyPerformance() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['strategy-performance', filters],
    queryFn: () => get<import('../lib/types').StrategyPerformance[]>('/performance/strategy', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useAumUtilization() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['aum-utilization', filters],
    queryFn: () => get<import('../lib/types').AumUtilization[]>('/performance/aum-utilization', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useMonthlyPerformance() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['monthly-performance', filters],
    queryFn: () => get<import('../lib/types').MonthlyPerformance[]>('/performance/monthly', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useCustomExample() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['custom-example', filters],
    queryFn: () => get<{ executions: number; total_quantity: number }>('/custom/example', filters),
    refetchInterval: REFRESH_MS,
  })
}

// ---------------------------------------------------------------------------
// Settings -> Configuration. Everything here is UI-operable — the person
// running this dashboard day to day is not expected to touch .env or the
// database directly. See backend/app/dashboard_config.py and
// backend/app/routers/config_admin.py.
// ---------------------------------------------------------------------------

export interface DashboardConfig {
  default_reference_client_id: string
  flat_brokerage_client_ids: string[]
  market_holidays: { date: string; description: string }[]
}

export function useDashboardConfig() {
  return useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => get<DashboardConfig>('/config/dashboard'),
  })
}

export function useSetReferenceAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) => put<DashboardConfig>('/config/dashboard/reference-account', { client_id: clientId }),
    onSuccess: (data) => queryClient.setQueryData(['dashboard-config'], data),
  })
}

export function useSetFlatBrokerageClientIds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (clientIds: string[]) => put<DashboardConfig>('/config/dashboard/flat-brokerage', { client_ids: clientIds }),
    onSuccess: (data) => queryClient.setQueryData(['dashboard-config'], data),
  })
}

export function useSetMarketHolidays() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (holidays: { date: string; description: string }[]) =>
      put<DashboardConfig>('/config/dashboard/market-holidays', { holidays }),
    onSuccess: (data) => queryClient.setQueryData(['dashboard-config'], data),
  })
}

export interface BrokerChargeRow {
  Broker: string
  STT: number
  SEBI: number
  StampDuty: number
  BSE_TransactionCharges: number
  NSE_TransactionCharges: number
  CM: number
  GST: number
  Brokerage: number
  Brokerage_ProfitSharing: number
  Brokerage_Lot_Wise: number
}

export function useBrokerCharges() {
  return useQuery({
    queryKey: ['broker-charges-admin'],
    queryFn: () => get<BrokerChargeRow[]>('/config/broker-charges'),
  })
}

export function useUpsertBrokerCharges() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ broker, rates }: { broker: string; rates: Omit<BrokerChargeRow, 'Broker'> }) =>
      put(`/config/broker-charges/${encodeURIComponent(broker)}`, rates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-charges-admin'] })
      // Broker charges feed Net P&L everywhere — refresh those views too.
      queryClient.invalidateQueries({ queryKey: ['pnl-summary'] })
      queryClient.invalidateQueries({ queryKey: ['net-pnl-client'] })
      queryClient.invalidateQueries({ queryKey: ['net-pnl-broker'] })
    },
  })
}

export function useDeleteBrokerCharges() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (broker: string) => del(`/config/broker-charges/${encodeURIComponent(broker)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-charges-admin'] })
      queryClient.invalidateQueries({ queryKey: ['pnl-summary'] })
      queryClient.invalidateQueries({ queryKey: ['net-pnl-client'] })
      queryClient.invalidateQueries({ queryKey: ['net-pnl-broker'] })
    },
  })
}
// ---------------------------------------------------------------------------
// Client Reports — per-client WhatsApp-style performance snapshot cards.
// Distinct from /reports (Deck Performance / the single reference-account
// PDF deck) — this is /client-reports, backed by /api/client-reports/*.
// Sending (Twilio) is not wired up yet; this only covers preview + zip
// download, per the Sept 2026 decision.
// ---------------------------------------------------------------------------

export interface ClientReportOption {
  client_id: string
  client_name: string
  account_type: string
}

export interface ReportPeriod {
  from_date: string
  to_date: string
  label: string
}

export function useClientReportClients() {
  return useQuery({
    queryKey: ['client-report-clients'],
    queryFn: () => get<ClientReportOption[]>('/client-reports/clients'),
    staleTime: 5 * 60_000,
  })
}

export function useReportPeriod(
  kind: 'weekly' | 'monthly' | 'custom',
  params: { asOf?: string; year?: number; month?: number; fromDate?: string; toDate?: string },
) {
  return useQuery({
    queryKey: ['client-report-period', kind, params],
    queryFn: () =>
      get<ReportPeriod>('/client-reports/period', {
        kind,
        as_of: params.asOf,
        year: params.year,
        month: params.month,
        from_date: params.fromDate,
        to_date: params.toDate,
      }),
    // custom needs both dates before it's meaningful to ask; weekly/monthly
    // are always resolvable (weekly defaults to today, monthly needs
    // year+month which the picker always supplies together)
    enabled: kind !== 'custom' || (!!params.fromDate && !!params.toDate),
  })
}

export interface BrokerageExemptions {
  client_ids: string[]
}

export function useBrokerageExemptions() {
  return useQuery({
    queryKey: ['brokerage-exemptions'],
    queryFn: () => get<BrokerageExemptions>('/client-reports/brokerage-exemptions'),
  })
}

export function useSetBrokerageExemptions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (clientIds: string[]) => put<BrokerageExemptions>('/client-reports/brokerage-exemptions', { client_ids: clientIds }),
    onSuccess: (data) => queryClient.setQueryData(['brokerage-exemptions'], data),
  })
}

// ---------------------------------------------------------------------------
// Overview page — /api/overview/* (routers/overview.py)
// ---------------------------------------------------------------------------

export interface OverviewSummary {
  start_date: string
  end_date: string
  range_days: number
  aum: number | null
  aum_as_of: string | null
  investment_amount: number
  investment_by_plan: { label: string; value: number }[]
  weighted_investment_amount: number | null
  time_weighted_investment_amount: number
  time_weighted_by_plan: { label: string; value: number }[]
  gross_pnl: number
  net_pnl: number
  total_charges: number
  pnl_on_weighted_pct: number | null
  annualised_return_pct: number | null
  active_clients: number
  instruments: number
  brokers: number
  client_growth: { date: string; clients: number }[]
  aum_trend: { date: string; aum: number }[]
  pnl_growth: { date: string; cumulative_pnl: number }[]
}

export function useOverviewSummary() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['overview-summary', filters],
    queryFn: () => get<OverviewSummary>('/overview/summary', filters),
    refetchInterval: REFRESH_MS,
  })
}

export function useOverviewFilterOptions() {
  const filters = useFilters()
  return useQuery({
    queryKey: ['overview-filter-options', filters.start_date, filters.end_date],
    queryFn: () =>
      get<{ clients: { id: string; name: string | null }[]; instruments: string[] }>('/overview/filter-options', {
        start_date: filters.start_date,
        end_date: filters.end_date,
      }),
    staleTime: 5 * 60_000,
  })
}
