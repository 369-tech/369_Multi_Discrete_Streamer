export interface FilterOptions {
  clients: string[]
  brokers: string[]
  instruments: string[]
  option_types: string[]
  transaction_types: string[]
  trade_date_min: string | null
  trade_date_max: string | null
  expiry_date_min: string | null
  expiry_date_max: string | null
}

export interface GlobalFilters {
  [key: string]: string | number | boolean | string[] | undefined
  client_ids?: string[]
  broker?: string
  instrument?: string
  option_type?: string
  transaction_type?: string
  start_date?: string
  end_date?: string
  expiry_start?: string
  expiry_end?: string
  search?: string
}

// Single-horizon KPI set (Sept 2026 simplification — see backend
// app/routers/overview.py module docstring). Everything here reflects
// whatever's currently selected in the global filter bar, which
// defaults to 1 Apr (FY start) through today.
export interface Kpis {
  clients: number
  instruments: number
  brokers: number
  aum: number
  aum_as_of_date: string | null
  investment_amount: number
  investment_amount_as_of_date: string | null
  /** investment_amount broken down by each client's account type (e.g.
   * "Capital Maximiser": 5000000, "Secure Core": 1200000) — for the
   * Investment Amount bubble's hover breakdown. Only types with a
   * nonzero contribution are included; sums to investment_amount. */
  investment_amount_by_type: Record<string, number>
  weighted_investment_amount: number
  gross_pnl: number
  net_pnl: number
  net_pnl_available: boolean
  missing_brokers: string[]
  return_pct: number
  annualised_return_pct: number
  round_trips: number
  win_rate: number
  trade_start_day: string | null
  trade_end_day: string | null
}

export interface TradeRow {
  ClientId: string
  Broker: string
  Current_Date_: string
  Expiry_Date: string
  Execution_Time: string
  Instrument: string
  Strike_Price: string
  Option_Type: string
  Price: string
  Transaction_Type: string
  Quantity: string
  Identifier: string
  trade_value?: number
}

export interface TradePage {
  total: number
  page: number
  page_size: number
  total_pages: number
  rows: TradeRow[]
}

// Gross P&L summary for a set of round trips. When broker charges are
// configured, net_pnl_available is true and net_pnl/net_pnl_missing_brokers
// are populated too — see /pnl/summary on the backend.
export interface ProfitSummary {
  gross_profit: number
  gross_loss: number
  gross_pnl: number
  winning_round_trips: number
  losing_round_trips: number
  round_trips: number
  expiry_closures: number
  win_rate: number
  net_pnl?: number | null
  net_pnl_available?: boolean
  net_pnl_missing_brokers?: string[]
  // Returned by /api/pnl/summary (routers/pnl.py)
  total_charges?: number
  trade_count?: number
  winning_trades?: number
  losing_trades?: number
  start_date?: string
  end_date?: string
}

export interface RoundTrip {
  ClientId: string
  Broker: string
  Instrument: string
  Strike_Price: string
  Option_Type: string
  Expiry_Date: string
  entry_time: string
  exit_time: string
  entry_price: number
  exit_price: number
  quantity: number
  entry_type: string
  exit_type: string
  net_pnl: number
}

export interface OpenPosition {
  ClientId: string
  Broker: string
  Instrument: string
  Strike_Price: string
  Option_Type: string
  Expiry_Date: string
  open_quantity: number
  avg_entry_price: number
  entry_time: string
  expiry_datetime: string
  days_to_expiry: number | null
  side: 'SELL' | 'BUY'
}

// One row of the "Net P&L by client" or "Net P&L by broker" table.
// Sept 2026: Investment Amount switched from a weighted range-average to
// the plain CURRENT amount (investment_amount, replacing
// investment_aum_weighted on this table) — turnover and a
// government_charges/Brokerage split are now surfaced (both were already
// computed server-side, just not exposed before), plus a per-client
// annualised_return_pct. pnl_weightage_pct was dropped from this table
// (no longer meaningful once Investment Amount isn't weighted).
export interface NetPnlRow {
  ClientId?: string
  ClientName?: string
  Broker?: string
  account_type?: string | null
  absolute_turnover: number
  turnover?: number
  Gross_PnL: number
  Brokerage: number
  STT: number
  SEBI: number
  StampDuty: number
  NSE_TransactionCharges: number
  CM: number
  GST: number
  government_charges?: number
  Total_Charges: number
  Net_PnL: number
  investment_amount?: number
  annualised_return_pct?: number
  /** Days from this client's first trade in the current filter range to
   * today (or the filter's end_date, if narrower) — the denominator
   * behind annualised_return_pct. Exposed so a table total row can
   * derive a portfolio-level annualised return using the longest span
   * any client in the set actually has, rather than a simple sum/average
   * of the already-rounded per-row percentages. */
  days_since_first_trade?: number
  /** @deprecated Sept 2026 — replaced by investment_amount on this table (still used elsewhere, e.g. Net P&L by broker's aum). */
  investment_aum_weighted?: number
  /** @deprecated Sept 2026 — dropped from Net P&L by client; investment_amount is no longer weighted. */
  pnl_weightage_pct?: number
  aum?: number
  /** Distinct client count for this broker — Sept 2026, Broker Analytics'
   * merged table (Broker, Clients, AUM, Turnover, Gross P&L, Brokerage,
   * Govt Charges, Net P&L), from net_pnl_by_broker(). Not applicable on
   * the by-client version of this same row type. */
  clients?: number
}

export interface NetPnlResponse {
  rows: NetPnlRow[]
  missing_brokers: string[]
  available: boolean
}

// Client Comparison table row. Executions/Round Trips removed (Risk &
// Analytics only, per the Sept 2026 table cleanup) — Investment Amount
// (Weighted) takes their place.
export interface ClientSummaryRow {
  ClientId: string
  ClientName?: string
  quantity: number
  execution_value: number
  turnover: number
  gross_profit: number
  gross_loss: number
  gross_pnl: number
  expiry_closures: number
  win_rate: number
  investment_aum_weighted?: number
  pnl_weightage_pct?: number
}

export interface StrategyPerformance {
  Instrument: string
  Option_Type: string
  strategy: string
  round_trips: number
  gross_profit: number
  gross_loss: number
  gross_pnl: number
  expiry_closures: number
  win_rate: number
}

export interface AumUtilization {
  ClientId: string
  ClientName: string
  turnover: number
  weighted_aum: number
  turnover_multiple: number
}

export interface MonthlyPerformance {
  month: string
  executions: number
  gross_pnl: number
  round_trips: number
}

// Broker Comparison table row. Executions removed (Risk & Behavior
// only) — Brokerage and Charges (aggregated ₹, null if that broker has
// no rates configured yet) take its place.
export interface BrokerSummaryRow {
  Broker: string
  clients: number
  quantity: number
  execution_value: number
  brokerage: number | null
  charges: number | null
}

export interface ClientProfile {
  client_id: string
  executions: number
  brokers: string[]
  instruments: string[]
  first_trade: string | null
  last_trade: string | null
  total_quantity?: number
  total_execution_value?: number
  pnl: ProfitSummary
  current_aum: number
}

export interface DataQualitySummary {
  valid_rows: number
  invalid_rows: number
  total_rows: number
  invalid_pct: number
  reasons: { reason: string; count: number }[]
}

export interface SystemHealth {
  database_connected: boolean
  database_message: string
  cache: { entries: number; oldest_age_seconds: number; newest_age_seconds: number }
  auto_refresh_enabled: boolean
  auto_refresh_minutes: number
  last_manual_refresh: number | null
}

export interface SystemConfig {
  db_host: string
  db_port: number
  db_driver: string
  db_credentials_source: string
  db_default_database: string
  trade_table: string
  active_client_table: string
  aum_table: string
  broker_charges_table: string
  cache_ttl_seconds: number
  auto_refresh_minutes: number
}

export interface TradeLookupResult {
  identifier: string
  found: boolean
  legs: TradeRow[]
  round_trips: RoundTrip[]
  open_position: OpenPosition | null
}
