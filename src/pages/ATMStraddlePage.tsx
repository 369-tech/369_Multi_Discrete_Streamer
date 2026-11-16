import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { LineChart } from '@mui/x-charts/LineChart';
import { useAxesTooltip, ChartsTooltipContainer } from '@mui/x-charts/ChartsTooltip';
import type { ChartsTooltipProps } from '@mui/x-charts/ChartsTooltip';
import { api } from '../../api/api';

type IndexName = 'NIFTY' | 'SENSEX' | 'BANKNIFTY';
type MarketInterval = 1 | 15;

type StraddleRecord = Record<string, unknown>;

type TodayIvResponse = {
  date: string;
  index: string;
  timestamp: string;
  spot: number | null;
  strike: number | null;
  iv: number | null;
  callIv: number | null;
  putIv: number | null;
  callPrice: number | null;
  putPrice: number | null;
  straddlePrice: number | null;
};

type ChartPoint = {
  date: string;
  label: string;
  straddle: number | null;
  call: number | null;
  put: number | null;
  spot: number | null;
  underlying: number | null;
  iv: number | null;
  volume: number | null;
};

type SeriesKey = 'straddle' | 'call' | 'put' | 'spot';

const SERIES_META: Record<SeriesKey, { label: string; color: string; key: keyof ChartPoint }> = {
  straddle: { label: 'Straddle', color: '#4FD8C4', key: 'straddle' },
  call: { label: 'Call', color: '#E8A33D', key: 'call' },
  put: { label: 'Put', color: '#E0607A', key: 'put' },
  spot: { label: 'Spot', color: '#7C93C9', key: 'spot' },
};

const INDEXES: IndexName[] = ['NIFTY', 'SENSEX', 'BANKNIFTY'];
const EXPIRY_OFFSETS = [0, -1, -2, -3, -4] as const;
type ExpiryOffset = (typeof EXPIRY_OFFSETS)[number];

const MARKET_START_MINUTES = 9 * 60 + 15;
const MARKET_END_MINUTES = 15 * 60 + 30;

function generateMarketSlots(interval: MarketInterval): string[] {
  const slots: string[] = [];
  for (let minutes = MARKET_START_MINUTES; minutes <= MARKET_END_MINUTES; minutes += interval) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }
  return slots;
}

const TODAY = new Date().toISOString().slice(0, 10);

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Expiry weekday for each index (0=Sun … 6=Sat).
 * NIFTY weekly → Tuesday, SENSEX weekly → Thursday,
 * BANKNIFTY monthly → Monday.
 */
const INDEX_EXPIRY_WEEKDAY: Record<IndexName, number> = {
  NIFTY: 2, // Tuesday
  SENSEX: 4, // Thursday
  BANKNIFTY: 1, // Monday (monthly)
};

/** "2026-06-04" → "2026-06-04 (Thu)" — used only in tooltip title */
function formatDateWithWeekday(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  try {
    const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${dateStr.slice(0, 10)} (${WEEKDAY_NAMES[d.getDay()]})`;
  } catch {
    return dateStr;
  }
}

function numberValue(record: StraddleRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    const number = typeof value === 'number' ? value : Number(value);
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(number)) return number;
  }
  return null;
}

// Only real contract-expiry fields — never "datetime" (trade timestamp),
// or every row is treated as its own expiry and offset filtering breaks
// (offset 0 matches all days; -1/-2/… match nothing).
const EXPIRY_KEYS = [
  'expiry',
  'expiry_date',
  'expiryDate',
  'contract_expiry',
  'weekly_expiry',
  'week_expiry',
  'nearest_expiry',
  'expiry_dt',
  'expiry_datetime',
];

function recordExpiry(record: StraddleRecord): string {
  for (const key of EXPIRY_KEYS) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== '') return String(value).slice(0, 10);
  }
  return '';
}

function recordDate(record: StraddleRecord): string {
  if (record.datetime) return String(record.datetime).slice(0, 10);
  const value = record.timestamp ?? record.datetime ?? record.date ?? record.time;
  return value ? String(value).slice(0, 10) : '';
}

function recordTime(record: StraddleRecord, interval: MarketInterval): string {
  let time = '';
  if (record.datetime) {
    const match = String(record.datetime).match(/\b(\d{1,2}):(\d{2})/);
    if (match) time = `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  if (!time) {
    const value = record.timestamp ?? record.datetime ?? record.time;
    if (!value) return '';
    const match = String(value).match(/(\d{1,2}:\d{2})/);
    if (!match) return '';
    time = match[1];
  }

  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const nearestSlot = Math.round((totalMinutes - MARKET_START_MINUTES) / interval) * interval + MARKET_START_MINUTES;
  return `${String(Math.floor(nearestSlot / 60)).padStart(2, '0')}:${String(nearestSlot % 60).padStart(2, '0')}`;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length < 10) return null;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function isWeekend(dateStr: string): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Walk back `offset` trading days (skip Sat/Sun) from the index's expiry
 * weekday. offset 0 → expiry weekday itself; -1 → previous trading day; etc.
 *
 * NIFTY (Tue):  0→Tue, -1→Mon, -2→Fri, -3→Thu, -4→Wed
 * SENSEX (Thu): 0→Thu, -1→Wed, -2→Tue, -3→Mon, -4→Fri
 * BANKNIFTY (Mon): 0→Mon, -1→Fri, -2→Thu, -3→Wed, -4→Tue
 */
function weekdayFromTradingOffset(expiryWeekday: number, offset: number): number {
  let day = expiryWeekday;
  let remaining = Math.abs(offset);
  while (remaining > 0) {
    day = (day - 1 + 7) % 7;
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return day;
}

/**
 * Match dates by the selected index's expiry weekday + trading-day offset.
 * Weekends are always skipped. The API only returns trading days, so holidays
 * simply have no rows — no extra holiday calendar is needed.
 */
function matchesExpiryOffset(dateStr: string, index: IndexName, offset: ExpiryOffset): boolean {
  if (isWeekend(dateStr)) return false;
  const d = parseDate(dateStr);
  if (!d) return false;
  return d.getDay() === weekdayFromTradingOffset(INDEX_EXPIRY_WEEKDAY[index], offset);
}

/**
 * Real offset from a row's own expiry date (when the backend sends one).
 * 0 = expiry day, -1 = one trading day before, etc.
 */
function computeOffsetFromExpiry(dateStr: string, expiryStr: string): number | null {
  const date = parseDate(dateStr);
  const expiry = parseDate(expiryStr);
  if (!date || !expiry) return null;
  if (date.getTime() === expiry.getTime()) return 0;
  if (date.getTime() > expiry.getTime()) return null;

  let count = 0;
  const cursor = new Date(expiry);
  while (cursor.getTime() > date.getTime()) {
    cursor.setDate(cursor.getDate() - 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return -count;
}

/**
 * Keep only the nearest-upcoming-expiry row per calendar date when multiple
 * contracts exist on the same day.
 */
function keepNearestExpiryPerDate<T extends { date: string; expiry: string }>(items: T[]): T[] {
  const bestByDate = new Map<string, T>();
  for (const item of items) {
    const existing = bestByDate.get(item.date);
    if (!existing) {
      bestByDate.set(item.date, item);
      continue;
    }
    if (item.expiry && (!existing.expiry || item.expiry < existing.expiry)) {
      bestByDate.set(item.date, item);
    }
  }
  return Array.from(bestByDate.values());
}

function buildPoints(
  records: StraddleRecord[],
  selectedTime: string,
  index: IndexName,
  expiryOffset: ExpiryOffset,
  interval: MarketInterval,
): ChartPoint[] {
  // Prefer each row's own expiry date when present (holiday-shifted expiries).
  // Otherwise match by index expiry weekday + trading-day offset.
  const hasExpiryField = records.some((record) => recordExpiry(record));

  const filtered = records
    .map((record) => {
      const date = recordDate(record);
      return {
        date,
        expiry: recordExpiry(record),
        label: date,
        straddle: numberValue(record, ['straddle_price', 'straddle', 'total_price', 'close']),
        call: numberValue(record, ['call_price', 'call', 'ce_close']),
        put: numberValue(record, ['put_price', 'put', 'pe_close']),
        spot: numberValue(record, ['spot_price', 'spot', 'index_price', 'nifty50']),
        underlying: numberValue(record, ['underlying_price', 'underlying', 'spot_price', 'spot', 'index_price', 'nifty50',]),
        iv: numberValue(record, ['iv', 'implied_volatility', 'straddle_iv', 'atm_iv', 'avg_iv']),
        volume: numberValue(record, ['volume', 'total_volume', 'straddle_volume', 'vol']),
        time: recordTime(record, interval),
      };
    })
    .filter((point) => {
      if (!point.date || point.time !== selectedTime) return false;
      if (point.straddle === null && point.underlying === null) return false;
      if (hasExpiryField) {
        return computeOffsetFromExpiry(point.date, point.expiry) === expiryOffset;
      }
      return matchesExpiryOffset(point.date, index, expiryOffset);
    });

  const deduped = hasExpiryField ? keepNearestExpiryPerDate(filtered) : filtered;

  return deduped
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(({ time: _time, expiry: _expiry, ...point }) => point);
}

function buildSlotRows(
  records: StraddleRecord[],
  index: IndexName,
  expiryOffset: ExpiryOffset,
  interval: MarketInterval,
  slots: string[],
): Map<string, ChartPoint[]> {
  const rowsBySlot = new Map<string, ChartPoint[]>();
  for (const slot of slots) rowsBySlot.set(slot, []);

  const hasExpiryField = records.some((record) => recordExpiry(record));
  for (const record of records) {
    const date = recordDate(record);
    const time = recordTime(record, interval);
    if (!date || !rowsBySlot.has(time)) continue;

    const expiry = recordExpiry(record);
    if (
      (hasExpiryField && computeOffsetFromExpiry(date, expiry) !== expiryOffset) ||
      (!hasExpiryField && !matchesExpiryOffset(date, index, expiryOffset))
    ) {
      continue;
    }

    const point: ChartPoint = {
      date,
      label: date,
      straddle: numberValue(record, ['straddle_price', 'straddle', 'total_price', 'close']),
      call: numberValue(record, ['call_price', 'call', 'ce_close']),
      put: numberValue(record, ['put_price', 'put', 'pe_close']),
      spot: numberValue(record, ['spot_price', 'spot', 'index_price', 'nifty50']),
      underlying: numberValue(record, [
        'underlying_price',
        'underlying',
        'spot_price',
        'spot',
        'index_price',
        'nifty50',
      ]),
      iv: numberValue(record, ['iv', 'implied_volatility', 'straddle_iv', 'atm_iv', 'avg_iv']),
      volume: numberValue(record, ['volume', 'total_volume', 'straddle_volume', 'vol']),
    };
    if (point.straddle === null && point.underlying === null) continue;
    rowsBySlot.get(time)?.push(point);
  }

  rowsBySlot.forEach((rows) => rows.sort((left, right) => left.date.localeCompare(right.date)));
  return rowsBySlot;
}

/**
 * Custom axis tooltip.
 * - Title = date + weekday (the x-axis itself only shows the plain date).
 * - Appends an IV row, since IV is not a plotted series.
 */
function AxisTooltipContent({
  visiblePoints,
  ...containerProps
}: { visiblePoints: ChartPoint[] } & Omit<
  React.ComponentProps<typeof ChartsTooltipContainer>,
  'children'
>) {
  const tooltipData = useAxesTooltip();
  if (!tooltipData || tooltipData.length === 0) return null;

  const first = tooltipData[0];
  const axisValue = first?.axisValue;
  const point =
    axisValue !== null && axisValue !== undefined
      ? visiblePoints.find((p) => p.label === String(axisValue))
      : undefined;
  const title = point
    ? formatDateWithWeekday(point.date)
    : axisValue !== null && axisValue !== undefined
      ? String(axisValue)
      : '';

  return (
    <ChartsTooltipContainer trigger="axis" {...containerProps}>
      <div
        style={{
          background: '#1a2233',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          color: '#e2e8f0',
          boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#f1f5f9' }}>{title}</div>
        {tooltipData.map((axisTip) =>
          axisTip.seriesItems?.map((item) => (
            <div
              key={String(item.seriesId)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#94a3b8', minWidth: 56 }}>{item.formattedLabel ?? item.seriesId}</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                {item.formattedValue}
              </span>
            </div>
          )),
        )}
        {point && point.iv !== null && point.iv !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: '#a78bfa',
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#94a3b8', minWidth: 56 }}>IV</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
              {point.iv.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </ChartsTooltipContainer>
  );
}

/**
 * Interactive line chart with:
 * - Mouse-wheel zoom (stays on the chart — does not scroll the page)
 * - Left-click + drag horizontal pan
 * - Optional external zoom buttons via zoom / onZoomChange / panStart / onPanChange
 *
 * Performance:
 * - Wheel/pan handlers read latest values from refs so the listener is attached once
 *   and is not torn down/re-bound on every zoom tick (main lag source before).
 * - Wheel + pan updates are coalesced via requestAnimationFrame.
 * - Marks only drawn when few points are visible (marks are expensive in MUI X).
 */
function MuiLineChart({
  points,
  zoom,
  series,
  onZoomChange,
  panStart,
  onPanChange,
}: {
  points: ChartPoint[];
  zoom: number;
  series: SeriesKey[];
  onZoomChange: (next: number) => void;
  panStart: number;
  onPanChange: (next: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Left-button drag to pan. Small move threshold keeps simple clicks free for tooltip.
  const dragRef = useRef<{
    active: boolean;
    dragging: boolean;
    startX: number;
    originPan: number;
    pointerId: number;
  } | null>(null);

  // Latest values in refs so the stable wheel listener never needs re-binding
  const zoomRef = useRef(zoom);
  const panStartRef = useRef(panStart);
  const pointsLenRef = useRef(points.length);
  const onZoomChangeRef = useRef(onZoomChange);
  const onPanChangeRef = useRef(onPanChange);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ zoom: number; pan: number } | null>(null);

  zoomRef.current = zoom;
  panStartRef.current = panStart;
  pointsLenRef.current = points.length;
  onZoomChangeRef.current = onZoomChange;
  onPanChangeRef.current = onPanChange;

  const total = points.length;
  const visibleCount = Math.max(2, Math.min(total, Math.ceil(total / zoom)));
  // panStart = index of the first visible point (0 = leftmost / oldest)
  const maxStart = Math.max(0, total - visibleCount);
  const start = Math.max(0, Math.min(panStart, maxStart));
  const visiblePoints = useMemo(
    () => points.slice(start, start + visibleCount),
    [points, start, visibleCount],
  );

  const xLabels = useMemo(() => visiblePoints.map((p) => p.label), [visiblePoints]);

  // Keep a ref to the current visible window for the tooltip (avoids recreating
  // the tooltip component identity more often than needed).
  const visiblePointsRef = useRef(visiblePoints);
  visiblePointsRef.current = visiblePoints;

  const TooltipContent = useMemo(
    () =>
      function TooltipContentWithPoints(props: ChartsTooltipProps) {
        return <AxisTooltipContent {...props} visiblePoints={visiblePointsRef.current} />;
      },
    [],
  );

  // Marks are costly; only show them when the window is small enough
  const showMarks = visibleCount <= 40;

  const chartSeries = useMemo(
    () =>
      series.map((key) => {
        const meta = SERIES_META[key];
        return {
          data: visiblePoints.map((p) => {
            const v = p[meta.key];
            return typeof v === 'number' ? v : null;
          }),
          label: meta.label,
          color: meta.color,
          yAxisId: key === 'spot' ? 'rightAxisId' : 'leftAxisId',
          showMark: showMarks,
          curve: 'linear' as const,
          connectNulls: true,
        };
      }),
    [series, visiblePoints, showMarks],
  );

  const hasSpot = series.includes('spot');
  const hasOptions = series.some((k) => k !== 'spot');

  const flushPending = useCallback(() => {
    rafRef.current = null;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    if (pending.zoom !== zoomRef.current) onZoomChangeRef.current(pending.zoom);
    if (pending.pan !== panStartRef.current) onPanChangeRef.current(pending.pan);
  }, []);

  const scheduleUpdate = useCallback(
    (nextZoom: number, nextPan: number) => {
      pendingRef.current = { zoom: nextZoom, pan: nextPan };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushPending);
      }
    },
    [flushPending],
  );

  // Left-click + drag horizontally to pan (no Shift needed).
  // ~6px threshold so a plain click still leaves the tooltip alone.
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      active: true,
      dragging: false,
      startX: event.clientX,
      originPan: panStartRef.current,
      pointerId: event.pointerId,
    };
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag?.active) return;

      const dx = event.clientX - drag.startX;
      if (!drag.dragging) {
        if (Math.abs(dx) < 6) return;
        drag.dragging = true;
        try {
          (event.currentTarget as HTMLElement).setPointerCapture(drag.pointerId);
          (event.currentTarget as HTMLElement).style.cursor = 'grabbing';
        } catch {
          /* ignore */
        }
      }

      const t = pointsLenRef.current;
      const z = zoomRef.current;
      const vis = Math.max(2, Math.min(t, Math.ceil(t / z)));
      const max = Math.max(0, t - vis);
      const width = containerRef.current?.clientWidth ?? 1;
      const pxPerPoint = width / Math.max(1, vis);
      const deltaPoints = Math.round((drag.startX - event.clientX) / pxPerPoint);
      const next = Math.max(0, Math.min(max, drag.originPan + deltaPoints));
      if (next !== panStartRef.current) {
        scheduleUpdate(z, next);
      }
    },
    [scheduleUpdate],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).style.cursor = 'grab';
    } catch {
      /* ignore */
    }
    if (drag.dragging) {
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
  }, []);

  // Keep panStart in range when zoom / data length changes
  useEffect(() => {
    if (panStart > maxStart) onPanChange(maxStart);
  }, [panStart, maxStart, onPanChange]);

  // Stable native wheel listener — deps intentionally minimal; values come from refs.
  // This is the main fix for laggy zoom: previously the listener was removed +
  // re-added on every zoom/pan change, which made continuous scrolling feel sticky.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const t = pointsLenRef.current;
      if (t < 3) return;

      const z = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const nextZoom = Math.min(12, Math.max(1, z * factor));
      if (nextZoom === z) return;

      const vis = Math.max(2, Math.min(t, Math.ceil(t / z)));
      const s = Math.max(0, Math.min(panStartRef.current, Math.max(0, t - vis)));
      const mid = s + vis / 2;
      const nextVisible = Math.max(2, Math.min(t, Math.ceil(t / nextZoom)));
      const nextStart = Math.max(0, Math.min(t - nextVisible, Math.round(mid - nextVisible / 2)));

      scheduleUpdate(nextZoom, nextStart);
    };

    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scheduleUpdate]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-950/70 p-2"
      style={{ touchAction: 'none', cursor: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Box sx={{ width: '100%', height: { xs: 320, sm: 420, md: 460 } }}>
        <LineChart
          series={chartSeries}
          xAxis={[
            {
              scaleType: 'point',
              data: xLabels,
              height: 48,
              tickLabelStyle: { fill: '#94a3b8', fontSize: 10 },
            },
          ]}
          yAxis={[
            ...(hasOptions
              ? [{ id: 'leftAxisId', width: 56, tickLabelStyle: { fill: '#94a3b8', fontSize: 11 } }]
              : []),
            ...(hasSpot
              ? [
                  {
                    id: 'rightAxisId',
                    position: 'right' as const,
                    width: 64,
                    tickLabelStyle: { fill: '#94a3b8', fontSize: 11 },
                  },
                ]
              : []),
          ]}
          grid={{ horizontal: true, vertical: false }}
          margin={{ top: 24, right: hasSpot ? 12 : 8, bottom: 8, left: 8 }}
          slots={{ tooltip: TooltipContent }}
          slotProps={{
            legend: {
              direction: 'horizontal',
              position: { vertical: 'top', horizontal: 'end' },
            },
          }}
          sx={{
            '& .MuiChartsAxis-line': { stroke: '#475569' },
            '& .MuiChartsAxis-tick': { stroke: '#475569' },
            '& .MuiChartsGrid-line': { stroke: 'rgba(148,163,184,.16)' },
            '& .MuiChartsLegend-root': { color: '#94a3b8' },
            '& .MuiChartsLegend-label': { fill: '#94a3b8', fontSize: 12, fontWeight: 600 },
          }}
        />
      </Box>
      {zoom > 1 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-ink-700 bg-ink-950/90 px-3 py-1 font-mono text-[10px] text-slate-400">
          {start + 1}–{start + visiblePoints.length} / {total} · scroll to zoom · drag to pan
        </div>
      )}
    </div>
  );
}

const MiniChart = memo(function MiniChart({
  points,
  series,
}: {
  points: ChartPoint[];
  series: SeriesKey[];
}) {
  if (!points.length) {
    return <div className="grid h-28 place-items-center text-xs text-slate-500">No data for this slot</div>;
  }

  const xLabels = points.map((p) => p.label);
  const chartSeries = series.map((key) => {
    const meta = SERIES_META[key];
    return {
      data: points.map((p) => {
        const v = p[meta.key];
        return typeof v === 'number' ? v : null;
      }),
      label: meta.label,
      color: meta.color,
      showMark: false,
      curve: 'linear' as const,
      connectNulls: true,
    };
  });

  return (
    <Box sx={{ width: '100%', height: 112 }}>
      <LineChart
        series={chartSeries}
        xAxis={[{ scaleType: 'point', data: xLabels }]}
        yAxis={[{ width: 0 }]}
        margin={{ top: 8, right: 4, bottom: 4, left: 4 }}
        hideLegend
        sx={{
          '& .MuiChartsAxis-root': { display: 'none' },
          '& .MuiChartsGrid-line': { stroke: '#232b3a' },
        }}
        grid={{ horizontal: true, vertical: false }}
      />
    </Box>
  );
});

function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function offsetDescription(index: IndexName, offset: ExpiryOffset): string {
  const target = weekdayFromTradingOffset(INDEX_EXPIRY_WEEKDAY[index], offset);
  if (offset === 0) return `Expiry day (${WEEKDAY_NAMES[INDEX_EXPIRY_WEEKDAY[index]]})`;
  return `${Math.abs(offset)} trading day(s) before expiry (${WEEKDAY_NAMES[target]})`;
}

/** Label for the expiry-offset <option>, e.g. "0 (Tue)" / "-1 (Mon)". */
function offsetOptionLabel(index: IndexName, offset: ExpiryOffset): string {
  const target = weekdayFromTradingOffset(INDEX_EXPIRY_WEEKDAY[index], offset);
  return `${offset} (${WEEKDAY_NAMES[target]})`;
}

function formatIvTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatIvValue(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '--' : value.toFixed(2);
}

export default function ATMStraddlePage() {
  const [index, setIndex] = useState<IndexName>('NIFTY');
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState(TODAY);
  const [selectedTime, setSelectedTime] = useState('09:15');
  const [interval, setInterval] = useState<MarketInterval>(15);
  const [expiryOffset, setExpiryOffset] = useState<ExpiryOffset>(0);
  const [submittedFilters, setSubmittedFilters] = useState<{
    index: IndexName;
    fromDate: string;
    toDate: string;
    interval: MarketInterval;
  } | null>(null);
  const [records, setRecords] = useState<StraddleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ivData, setIvData] = useState<TodayIvResponse | null>(null);
  const [ivLoading, setIvLoading] = useState(false);
  const [ivError, setIvError] = useState('');
  const ivRequestIdRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [panStart, setPanStart] = useState(0); // index of first visible point
  const [series, setSeries] = useState<SeriesKey[]>(['straddle', 'spot']);
  const [debugInfo, setDebugInfo] = useState<{
    raw: unknown;
    recordCount: number;
    sampleKeys: string[];
  } | null>(null);

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (fromDate > toDate) {
      setError('From date must be before or equal to the To date');
      setRecords([]);
      return;
    }

    const filters = { index, fromDate, toDate, interval };
    setSubmittedFilters(filters);

    let cancelled = false;
    setLoading(true);
    setError('');
    setDebugInfo(null);

    // Do NOT send expiry_offset to the API — the backend may return empty
    // data for non-zero offsets. Fetch the full date range once and filter
    // by trading-day offset purely on the client in buildPoints().
    const params = {
      index,
      from_date: fromDate,
      to_date: toDate,
      interval,
    } as {
      index: string;
      from_date: string;
      to_date: string;
      interval: MarketInterval;
    };

    api
      .getHistoricalStraddle<{ success?: boolean; data?: StraddleRecord[]; message?: string }>(params)
      .then((response) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.log('[ATMStraddle] raw response:', response);

        const data = Array.isArray(response?.data) ? response.data : [];
        setDebugInfo({
          raw: response,
          recordCount: data.length,
          sampleKeys: data[0] ? Object.keys(data[0]) : [],
        });

        if (response?.success === false) {
          setError(response.message || 'Unable to load straddle data');
          setRecords([]);
          return;
        }
        setRecords(data);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[ATMStraddle] request failed:', requestError);
        setError(requestError instanceof Error ? requestError.message : 'Unable to load straddle data');
        setDebugInfo({ raw: String(requestError), recordCount: 0, sampleKeys: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
  };

  const points = useMemo(
    () =>
      submittedFilters
        ? buildPoints(
            records,
            selectedTime,
            submittedFilters.index,
            expiryOffset,
            submittedFilters.interval,
          )
        : [],
    [records, selectedTime, expiryOffset, submittedFilters],
  );

  const activeMarketSlots = useMemo(
    () => generateMarketSlots(submittedFilters?.interval ?? interval),
    [interval, submittedFilters],
  );

  // Precompute each interval slot once so zoom/pan on the main chart does not
  // rebuild the mini-charts on every wheel tick.
  const slotRows = useMemo(() => {
    if (!submittedFilters) return new Map<string, ChartPoint[]>();
    return buildSlotRows(
      records,
      submittedFilters.index,
      expiryOffset,
      submittedFilters.interval,
      activeMarketSlots,
    );
  }, [activeMarketSlots, records, expiryOffset, submittedFilters]);

  // Reset pan/zoom when the filtered series changes
  useEffect(() => {
    setZoom(1);
    setPanStart(0);
  }, [submittedFilters, records]);

  const zoomIn = () => {
    setZoom((value) => {
      const next = Math.min(12, value * 1.5);
      // keep window near the right (latest) edge when zooming via buttons
      const vis = Math.max(2, Math.ceil(points.length / next));
      setPanStart(Math.max(0, points.length - vis));
      return next;
    });
  };
  const zoomOut = () => {
    setZoom((value) => {
      const next = Math.max(1, value / 1.5);
      const vis = Math.max(2, Math.ceil(points.length / next));
      setPanStart((start) => Math.min(start, Math.max(0, points.length - vis)));
      return next;
    });
  };
  const resetView = () => {
    setZoom(1);
    setPanStart(0);
  };
  const toggleSeries = (key: SeriesKey) =>
    setSeries((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  useEffect(() => {
    ivRequestIdRef.current += 1;
    setIvData(null);
    setIvError('');
  }, [index]);

  const fetchTodayIv = async () => {
    const requestId = ivRequestIdRef.current + 1;
    ivRequestIdRef.current = requestId;
    setIvLoading(true);
    setIvError('');

    try {
      const response = await api.getTodayIv<TodayIvResponse>(index, interval);
      if (requestId !== ivRequestIdRef.current) return;
      setIvData(response);
    } catch (requestError: unknown) {
      if (requestId !== ivRequestIdRef.current) return;
      setIvData(null);
      setIvError(requestError instanceof Error ? requestError.message : 'Unable to load today\'s IV');
    } finally {
      if (requestId === ivRequestIdRef.current) setIvLoading(false);
    }
  };

  const activeIndex = submittedFilters?.index ?? index;
  const activeTime = selectedTime;
  const activeExpiryOffset = expiryOffset;
  const activeFromDate = submittedFilters?.fromDate ?? fromDate;
  const activeToDate = submittedFilters?.toDate ?? toDate;
  const expiryLabel =
    activeExpiryOffset === 0
      ? `Expiry day (0 · ${WEEKDAY_NAMES[INDEX_EXPIRY_WEEKDAY[activeIndex]]})`
      : `${activeExpiryOffset} (${offsetDescription(activeIndex, activeExpiryOffset)})`;

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 pb-8 text-[#e7ecf4]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-accent">Market analytics</p>
          <h1 className="font-display text-3xl font-semibold text-white">Straddle snapshot grid</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#8b96ac]">
            ATM straddle filtered by trading-day offset from index expiry. Weekends always skipped.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-accent" />
          {loading ? 'Fetching data' : `${points.length} points`}
        </div>
      </div>

      <form onSubmit={submitFilters} className="rounded-xl border border-[#232b3a] bg-[#121722] p-3 shadow-panel">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <label className="text-xs font-semibold text-slate-400">
            Index
            <select
              value={index}
              onChange={(event) => setIndex(event.target.value as IndexName)}
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-xs text-white outline-none focus:border-accent"
            >
              {INDEXES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-400">
            Expiry offset
            <select
              value={expiryOffset}
              onChange={(event) => setExpiryOffset(Number(event.target.value) as ExpiryOffset)}
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
            >
              {EXPIRY_OFFSETS.slice(0, 5).map((offset) => (
                <option key={offset} value={offset}>
                  {offsetOptionLabel(index, offset)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-400">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
            />
          </label>

          <label className="text-xs font-semibold text-slate-400">
            To
            <input
              type="date"
              min={fromDate}
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
            />
          </label>

          <label className="text-xs font-semibold text-slate-400">
            Market time
            <select
              value={selectedTime}
              onChange={(event) => setSelectedTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
            >
              {generateMarketSlots(interval).map((time) => (
                <option key={time}>{time}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-400">
            Interval
            <select
              value={interval}
              onChange={(event) => {
                setInterval(Number(event.target.value) as MarketInterval);
                setSelectedTime('09:15');
              }}
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
            >
              <option value={1}>1 min</option>
              <option value={15}>15 min</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-auto min-h-[42px] rounded-lg bg-accent px-4 py-2 text-xs font-bold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Submit'}
          </button>
        </div>
        <div className="mt-3 font-mono text-[11px] text-[#8b96ac]">
          Market session 09:15 - 15:30 · {interval} min · {offsetDescription(index, expiryOffset)} · weekends
          skipped
        </div>
      </form>

      <section className="rounded-xl border border-[#232b3a] bg-[#121722] p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Today&apos;s ATM data · {index}
            </p>
            {ivData ? (
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-400 sm:grid-cols-3 lg:grid-cols-6">
                <span>
                  IV <b className="ml-1 font-mono text-accent">{formatIvValue(ivData.iv)}%</b>
                </span>
                <span>
                  Call IV <b className="ml-1 font-mono text-slate-200">{formatIvValue(ivData.callIv)}%</b>
                </span>
                <span>
                  Put IV <b className="ml-1 font-mono text-slate-200">{formatIvValue(ivData.putIv)}%</b>
                </span>
                <span>
                  Call <b className="ml-1 font-mono text-[#e8a33d]">{formatIvValue(ivData.callPrice)}</b>
                </span>
                <span>
                  Put <b className="ml-1 font-mono text-[#e0607a]">{formatIvValue(ivData.putPrice)}</b>
                </span>
                <span>
                  Straddle <b className="ml-1 font-mono text-[#4fd8c4]">{formatIvValue(ivData.straddlePrice)}</b>
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Click Get latest IV to fetch today&apos;s values.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {ivData && (
              <div className="text-right text-xs text-slate-400">
                <p>{formatIvTimestamp(ivData.timestamp)}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  Spot {formatIvValue(ivData.spot)} · Strike {formatIvValue(ivData.strike)}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={fetchTodayIv}
              disabled={ivLoading}
              className="rounded-lg border border-accent/60 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ivLoading ? 'Loading IV...' : 'Get latest IV'}
            </button>
          </div>
        </div>
        {ivError && <p className="mt-2 text-xs text-danger">{ivError}</p>}
      </section>

      <section className="flex flex-wrap gap-5 rounded-xl border border-[#232b3a] bg-[#121722] px-4 py-3">
        {(Object.keys(SERIES_META) as SeriesKey[]).map((key) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-xs text-[#8b96ac]">
            <input
              type="checkbox"
              checked={series.includes(key)}
              onChange={() => toggleSeries(key)}
              className="accent-[#4fd8c4]"
            />
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SERIES_META[key].color }} />
            {SERIES_META[key].label}
          </label>
        ))}
      </section>

      <section className="rounded-xl border border-[#232b3a] bg-[#121722] p-5 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {activeIndex} · {activeTime} · {expiryLabel}
            </h2>
            <p className="text-xs text-slate-400">
              {activeFromDate} to {activeToDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= 1}
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-900 text-lg text-slate-200 disabled:opacity-40"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= 12}
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-900 text-lg text-slate-200 disabled:opacity-40"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200"
            >
              Reset
            </button>
          </div>
        </div>

        <p className="mb-3 text-xs text-[#8b96ac]">
          Only {offsetDescription(activeIndex, activeExpiryOffset)} · weekends excluded · tooltip shows date +
          weekday
        </p>

        {error ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-5 text-sm text-danger">{error}</div>
        ) : loading ? (
          <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">
            Loading historical straddle data...
          </div>
        ) : !submittedFilters ? (
          <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">
            Select filters and click Submit to load historical straddle data.
          </div>
        ) : points.length === 0 ? (
          <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">
            No data for {activeTime} with offset {activeExpiryOffset} (
            {offsetDescription(activeIndex, activeExpiryOffset)}).
          </div>
        ) : (
          <MuiLineChart
            points={points}
            zoom={zoom}
            series={series}
            onZoomChange={setZoom}
            panStart={panStart}
            onPanChange={setPanStart}
          />
        )}
      </section>

      <div>
        <h2 className="font-display text-base font-semibold">All time slots</h2>
        <p className="mt-1 text-xs text-[#8b96ac]">
          Same expiry-offset filter applied to every {submittedFilters?.interval ?? interval}-minute slot.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
        {activeMarketSlots.map((slot) => {
          const rows = slotRows.get(slot) ?? [];
          const latest = rows[rows.length - 1];
          const first = rows[0];
          const change =
            first?.straddle && latest?.straddle !== null
              ? ((latest.straddle! - first.straddle) / first.straddle) * 100
              : null;
          return (
            <article key={slot} className="rounded-xl border border-[#232b3a] bg-[#121722] p-3.5">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-display text-base font-semibold">{slot}</h3>
                {change !== null && (
                  <span
                    className={
                      change >= 0 ? 'font-mono text-xs text-[#48c78e]' : 'font-mono text-xs text-[#e0607a]'
                    }
                  >
                    {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                  </span>
                )}
              </div>
              {latest && (
                <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-[#8b96ac]">
                  <span>
                    Straddle{' '}
                    <b className="text-[#4fd8c4]">
                      ₹{latest.straddle === null ? '--' : latest.straddle.toFixed(1)}
                    </b>
                  </span>
                  <span>
                    Spot{' '}
                    <b className="text-[#7c93c9]">
                      {latest.spot === null ? '--' : latest.spot.toFixed(1)}
                    </b>
                  </span>
                  <span>
                    Call{' '}
                    <b className="text-[#e8a33d]">
                      ₹{latest.call === null ? '--' : latest.call.toFixed(1)}
                    </b>
                  </span>
                  <span>
                    Put{' '}
                    <b className="text-[#e0607a]">
                      ₹{latest.put === null ? '--' : latest.put.toFixed(1)}
                    </b>
                  </span>
                  <span>
                    IV{' '}
                    <b className="text-[#a78bfa]">
                      {latest.iv === null ? '--' : `${latest.iv.toFixed(2)}%`}
                    </b>
                  </span>
                  <span>
                    Vol <b className="text-[#38bdf8]">{formatVolume(latest.volume)}</b>
                  </span>
                </div>
              )}
              <p className="mb-1 text-[10px] text-[#8b96ac]">
                {rows.length ? `${rows.length} sessions · latest ${latest.date}` : 'No data for this slot'}
              </p>
              <MiniChart points={rows} series={series} />
            </article>
          );
        })}
      </div>

      {debugInfo && (
        <details className="rounded-xl border border-ink-700 bg-panel p-4 text-xs text-slate-400 shadow-panel">
          <summary className="cursor-pointer select-none font-semibold text-slate-300">
            Debug: last response — {debugInfo.recordCount} record
            {debugInfo.recordCount === 1 ? '' : 's'}
            {debugInfo.sampleKeys.length > 0 ? ` · fields: ${debugInfo.sampleKeys.join(', ')}` : ''}
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-950/70 p-3 text-[11px] text-slate-300">
            {JSON.stringify(debugInfo.raw, null, 2).slice(0, 4000)}
          </pre>
        </details>
      )}
    </div>
  );
}

// import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import Box from '@mui/material/Box';
// import { LineChart } from '@mui/x-charts/LineChart';
// import { useAxesTooltip, ChartsTooltipContainer } from '@mui/x-charts/ChartsTooltip';
// import type { ChartsTooltipProps } from '@mui/x-charts/ChartsTooltip';
// import { api } from '../../api/api';

// type IndexName = 'NIFTY' | 'SENSEX' | 'BANKNIFTY';
// type MarketInterval = 1 | 15;

// type StraddleRecord = Record<string, unknown>;

// type TodayIvResponse = {
//   date: string;
//   index: string;
//   timestamp: string;
//   spot: number | null;
//   strike: number | null;
//   iv: number | null;
//   callIv: number | null;
//   putIv: number | null;
//   callPrice: number | null;
//   putPrice: number | null;
//   straddlePrice: number | null;
// };

// type ChartPoint = {
//   date: string;
//   label: string;
//   straddle: number | null;
//   call: number | null;
//   put: number | null;
//   spot: number | null;
//   underlying: number | null;
//   iv: number | null;
//   volume: number | null;
// };

// type SeriesKey = 'straddle' | 'call' | 'put' | 'spot';

// const SERIES_META: Record<SeriesKey, { label: string; color: string; key: keyof ChartPoint }> = {
//   straddle: { label: 'Straddle', color: '#4FD8C4', key: 'straddle' },
//   call: { label: 'Call', color: '#E8A33D', key: 'call' },
//   put: { label: 'Put', color: '#E0607A', key: 'put' },
//   spot: { label: 'Spot', color: '#7C93C9', key: 'spot' },
// };

// const INDEXES: IndexName[] = ['NIFTY', 'SENSEX', 'BANKNIFTY'];
// const EXPIRY_OFFSETS = [0, -1, -2, -3, -4] as const;
// type ExpiryOffset = (typeof EXPIRY_OFFSETS)[number];

// const MARKET_START_MINUTES = 9 * 60 + 15;
// const MARKET_END_MINUTES = 15 * 60 + 30;

// function generateMarketSlots(interval: MarketInterval): string[] {
//   const slots: string[] = [];
//   for (let minutes = MARKET_START_MINUTES; minutes <= MARKET_END_MINUTES; minutes += interval) {
//     slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
//   }
//   return slots;
// }

// const TODAY = new Date().toISOString().slice(0, 10);

// const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// /**
//  * Expiry weekday for each index (0=Sun … 6=Sat).
//  * NIFTY weekly → Tuesday, SENSEX weekly → Thursday,
//  * BANKNIFTY monthly → Monday.
//  */
// const INDEX_EXPIRY_WEEKDAY: Record<IndexName, number> = {
//   NIFTY: 2, // Tuesday
//   SENSEX: 4, // Thursday
//   BANKNIFTY: 1, // Monday (monthly)
// };

// /** "2026-06-04" → "2026-06-04 (Thu)" — used only in tooltip title */
// function formatDateWithWeekday(dateStr: string): string {
//   if (!dateStr || dateStr.length < 10) return dateStr;
//   try {
//     const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
//     if (Number.isNaN(d.getTime())) return dateStr;
//     return `${dateStr.slice(0, 10)} (${WEEKDAY_NAMES[d.getDay()]})`;
//   } catch {
//     return dateStr;
//   }
// }

// function numberValue(record: StraddleRecord, keys: string[]): number | null {
//   for (const key of keys) {
//     const value = record[key];
//     const number = typeof value === 'number' ? value : Number(value);
//     if (value !== null && value !== undefined && value !== '' && Number.isFinite(number)) return number;
//   }
//   return null;
// }

// // Only real contract-expiry fields — never "datetime" (trade timestamp),
// // or every row is treated as its own expiry and offset filtering breaks
// // (offset 0 matches all days; -1/-2/… match nothing).
// const EXPIRY_KEYS = [
//   'expiry',
//   'expiry_date',
//   'expiryDate',
//   'contract_expiry',
//   'weekly_expiry',
//   'week_expiry',
//   'nearest_expiry',
//   'expiry_dt',
//   'expiry_datetime',
// ];

// function recordExpiry(record: StraddleRecord): string {
//   for (const key of EXPIRY_KEYS) {
//     const value = record[key];
//     if (value !== null && value !== undefined && value !== '') return String(value).slice(0, 10);
//   }
//   return '';
// }

// function recordDate(record: StraddleRecord): string {
//   if (record.datetime) return String(record.datetime).slice(0, 10);
//   const value = record.timestamp ?? record.datetime ?? record.date ?? record.time;
//   return value ? String(value).slice(0, 10) : '';
// }

// function recordTime(record: StraddleRecord, interval: MarketInterval): string {
//   let time = '';
//   if (record.datetime) {
//     const match = String(record.datetime).match(/\b(\d{1,2}):(\d{2})/);
//     if (match) time = `${match[1].padStart(2, '0')}:${match[2]}`;
//   }
//   if (!time) {
//     const value = record.timestamp ?? record.datetime ?? record.time;
//     if (!value) return '';
//     const match = String(value).match(/(\d{1,2}:\d{2})/);
//     if (!match) return '';
//     time = match[1];
//   }

//   const [hours, minutes] = time.split(':').map(Number);
//   const totalMinutes = hours * 60 + minutes;
//   const nearestSlot = Math.round((totalMinutes - MARKET_START_MINUTES) / interval) * interval + MARKET_START_MINUTES;
//   return `${String(Math.floor(nearestSlot / 60)).padStart(2, '0')}:${String(nearestSlot % 60).padStart(2, '0')}`;
// }

// function parseDate(dateStr: string): Date | null {
//   if (!dateStr || dateStr.length < 10) return null;
//   const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
//   return Number.isNaN(d.getTime()) ? null : d;
// }

// function isWeekend(dateStr: string): boolean {
//   const d = parseDate(dateStr);
//   if (!d) return false;
//   const day = d.getDay();
//   return day === 0 || day === 6;
// }

// /**
//  * Walk back `offset` trading days (skip Sat/Sun) from the index's expiry
//  * weekday. offset 0 → expiry weekday itself; -1 → previous trading day; etc.
//  *
//  * NIFTY (Tue):  0→Tue, -1→Mon, -2→Fri, -3→Thu, -4→Wed
//  * SENSEX (Thu): 0→Thu, -1→Wed, -2→Tue, -3→Mon, -4→Fri
//  * BANKNIFTY (Mon): 0→Mon, -1→Fri, -2→Thu, -3→Wed, -4→Tue
//  */
// function weekdayFromTradingOffset(expiryWeekday: number, offset: number): number {
//   let day = expiryWeekday;
//   let remaining = Math.abs(offset);
//   while (remaining > 0) {
//     day = (day - 1 + 7) % 7;
//     if (day !== 0 && day !== 6) remaining -= 1;
//   }
//   return day;
// }

// /**
//  * Match dates by the selected index's expiry weekday + trading-day offset.
//  * Weekends are always skipped. The API only returns trading days, so holidays
//  * simply have no rows — no extra holiday calendar is needed.
//  */
// function matchesExpiryOffset(dateStr: string, index: IndexName, offset: ExpiryOffset): boolean {
//   if (isWeekend(dateStr)) return false;
//   const d = parseDate(dateStr);
//   if (!d) return false;
//   return d.getDay() === weekdayFromTradingOffset(INDEX_EXPIRY_WEEKDAY[index], offset);
// }

// /**
//  * Real offset from a row's own expiry date (when the backend sends one).
//  * 0 = expiry day, -1 = one trading day before, etc.
//  */
// function computeOffsetFromExpiry(dateStr: string, expiryStr: string): number | null {
//   const date = parseDate(dateStr);
//   const expiry = parseDate(expiryStr);
//   if (!date || !expiry) return null;
//   if (date.getTime() === expiry.getTime()) return 0;
//   if (date.getTime() > expiry.getTime()) return null;

//   let count = 0;
//   const cursor = new Date(expiry);
//   while (cursor.getTime() > date.getTime()) {
//     cursor.setDate(cursor.getDate() - 1);
//     const day = cursor.getDay();
//     if (day !== 0 && day !== 6) count += 1;
//   }
//   return -count;
// }

// /**
//  * Keep only the nearest-upcoming-expiry row per calendar date when multiple
//  * contracts exist on the same day.
//  */
// function keepNearestExpiryPerDate<T extends { date: string; expiry: string }>(items: T[]): T[] {
//   const bestByDate = new Map<string, T>();
//   for (const item of items) {
//     const existing = bestByDate.get(item.date);
//     if (!existing) {
//       bestByDate.set(item.date, item);
//       continue;
//     }
//     if (item.expiry && (!existing.expiry || item.expiry < existing.expiry)) {
//       bestByDate.set(item.date, item);
//     }
//   }
//   return Array.from(bestByDate.values());
// }

// function buildPoints(
//   records: StraddleRecord[],
//   selectedTime: string,
//   index: IndexName,
//   expiryOffset: ExpiryOffset,
//   interval: MarketInterval,
// ): ChartPoint[] {
//   // Prefer each row's own expiry date when present (holiday-shifted expiries).
//   // Otherwise match by index expiry weekday + trading-day offset.
//   const hasExpiryField = records.some((record) => recordExpiry(record));

//   const filtered = records
//     .map((record) => {
//       const date = recordDate(record);
//       return {
//         date,
//         expiry: recordExpiry(record),
//         label: date,
//         straddle: numberValue(record, ['straddle_price', 'straddle', 'total_price', 'close']),
//         call: numberValue(record, ['call_price', 'call', 'ce_close']),
//         put: numberValue(record, ['put_price', 'put', 'pe_close']),
//         spot: numberValue(record, ['spot_price', 'spot', 'index_price', 'nifty50']),
//         underlying: numberValue(record, ['underlying_price', 'underlying', 'spot_price', 'spot', 'index_price', 'nifty50',]),
//         iv: numberValue(record, ['iv', 'implied_volatility', 'straddle_iv', 'atm_iv', 'avg_iv']),
//         volume: numberValue(record, ['volume', 'total_volume', 'straddle_volume', 'vol']),
//         time: recordTime(record, interval),
//       };
//     })
//     .filter((point) => {
//       if (!point.date || point.time !== selectedTime) return false;
//       if (point.straddle === null && point.underlying === null) return false;
//       if (hasExpiryField) {
//         return computeOffsetFromExpiry(point.date, point.expiry) === expiryOffset;
//       }
//       return matchesExpiryOffset(point.date, index, expiryOffset);
//     });

//   const deduped = hasExpiryField ? keepNearestExpiryPerDate(filtered) : filtered;

//   return deduped
//     .sort((left, right) => left.date.localeCompare(right.date))
//     .map(({ time: _time, expiry: _expiry, ...point }) => point);
// }

// function buildSlotRows(
//   records: StraddleRecord[],
//   index: IndexName,
//   expiryOffset: ExpiryOffset,
//   interval: MarketInterval,
//   slots: string[],
// ): Map<string, ChartPoint[]> {
//   const rowsBySlot = new Map<string, ChartPoint[]>();
//   for (const slot of slots) rowsBySlot.set(slot, []);

//   const hasExpiryField = records.some((record) => recordExpiry(record));
//   for (const record of records) {
//     const date = recordDate(record);
//     const time = recordTime(record, interval);
//     if (!date || !rowsBySlot.has(time)) continue;

//     const expiry = recordExpiry(record);
//     if (
//       (hasExpiryField && computeOffsetFromExpiry(date, expiry) !== expiryOffset) ||
//       (!hasExpiryField && !matchesExpiryOffset(date, index, expiryOffset))
//     ) {
//       continue;
//     }

//     const point: ChartPoint = {
//       date,
//       label: date,
//       straddle: numberValue(record, ['straddle_price', 'straddle', 'total_price', 'close']),
//       call: numberValue(record, ['call_price', 'call', 'ce_close']),
//       put: numberValue(record, ['put_price', 'put', 'pe_close']),
//       spot: numberValue(record, ['spot_price', 'spot', 'index_price', 'nifty50']),
//       underlying: numberValue(record, [
//         'underlying_price',
//         'underlying',
//         'spot_price',
//         'spot',
//         'index_price',
//         'nifty50',
//       ]),
//       iv: numberValue(record, ['iv', 'implied_volatility', 'straddle_iv', 'atm_iv', 'avg_iv']),
//       volume: numberValue(record, ['volume', 'total_volume', 'straddle_volume', 'vol']),
//     };
//     if (point.straddle === null && point.underlying === null) continue;
//     rowsBySlot.get(time)?.push(point);
//   }

//   rowsBySlot.forEach((rows) => rows.sort((left, right) => left.date.localeCompare(right.date)));
//   return rowsBySlot;
// }

// /**
//  * Custom axis tooltip.
//  * - Title = date + weekday (the x-axis itself only shows the plain date).
//  * - Appends an IV row, since IV is not a plotted series.
//  */
// function AxisTooltipContent({
//   visiblePoints,
//   ...containerProps
// }: { visiblePoints: ChartPoint[] } & Omit<
//   React.ComponentProps<typeof ChartsTooltipContainer>,
//   'children'
// >) {
//   const tooltipData = useAxesTooltip();
//   if (!tooltipData || tooltipData.length === 0) return null;

//   const first = tooltipData[0];
//   const axisValue = first?.axisValue;
//   const point =
//     axisValue !== null && axisValue !== undefined
//       ? visiblePoints.find((p) => p.label === String(axisValue))
//       : undefined;
//   const title = point
//     ? formatDateWithWeekday(point.date)
//     : axisValue !== null && axisValue !== undefined
//       ? String(axisValue)
//       : '';

//   return (
//     <ChartsTooltipContainer trigger="axis" {...containerProps}>
//       <div
//         style={{
//           background: '#1a2233',
//           border: '1px solid #334155',
//           borderRadius: 8,
//           padding: '8px 12px',
//           fontSize: 12,
//           color: '#e2e8f0',
//           boxShadow: '0 8px 24px rgba(0,0,0,.35)',
//         }}
//       >
//         <div style={{ fontWeight: 600, marginBottom: 6, color: '#f1f5f9' }}>{title}</div>
//         {tooltipData.map((axisTip) =>
//           axisTip.seriesItems?.map((item) => (
//             <div
//               key={String(item.seriesId)}
//               style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}
//             >
//               <span
//                 style={{
//                   width: 10,
//                   height: 10,
//                   borderRadius: 2,
//                   background: item.color,
//                   flexShrink: 0,
//                 }}
//               />
//               <span style={{ color: '#94a3b8', minWidth: 56 }}>{item.formattedLabel ?? item.seriesId}</span>
//               <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
//                 {item.formattedValue}
//               </span>
//             </div>
//           )),
//         )}
//         {point && point.iv !== null && point.iv !== undefined && (
//           <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
//             <span
//               style={{
//                 width: 10,
//                 height: 10,
//                 borderRadius: 2,
//                 background: '#a78bfa',
//                 flexShrink: 0,
//               }}
//             />
//             <span style={{ color: '#94a3b8', minWidth: 56 }}>IV</span>
//             <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
//               {point.iv.toFixed(2)}%
//             </span>
//           </div>
//         )}
//       </div>
//     </ChartsTooltipContainer>
//   );
// }

// /**
//  * Interactive line chart with:
//  * - Mouse-wheel zoom (stays on the chart — does not scroll the page)
//  * - Left-click + drag horizontal pan
//  * - Optional external zoom buttons via zoom / onZoomChange / panStart / onPanChange
//  *
//  * Performance:
//  * - Wheel/pan handlers read latest values from refs so the listener is attached once
//  *   and is not torn down/re-bound on every zoom tick (main lag source before).
//  * - Wheel + pan updates are coalesced via requestAnimationFrame.
//  * - Marks only drawn when few points are visible (marks are expensive in MUI X).
//  */
// function MuiLineChart({
//   points,
//   zoom,
//   series,
//   onZoomChange,
//   panStart,
//   onPanChange,
// }: {
//   points: ChartPoint[];
//   zoom: number;
//   series: SeriesKey[];
//   onZoomChange: (next: number) => void;
//   panStart: number;
//   onPanChange: (next: number) => void;
// }) {
//   const containerRef = useRef<HTMLDivElement>(null);
//   // Left-button drag to pan. Small move threshold keeps simple clicks free for tooltip.
//   const dragRef = useRef<{
//     active: boolean;
//     dragging: boolean;
//     startX: number;
//     originPan: number;
//     pointerId: number;
//   } | null>(null);

//   // Latest values in refs so the stable wheel listener never needs re-binding
//   const zoomRef = useRef(zoom);
//   const panStartRef = useRef(panStart);
//   const pointsLenRef = useRef(points.length);
//   const onZoomChangeRef = useRef(onZoomChange);
//   const onPanChangeRef = useRef(onPanChange);
//   const rafRef = useRef<number | null>(null);
//   const pendingRef = useRef<{ zoom: number; pan: number } | null>(null);

//   zoomRef.current = zoom;
//   panStartRef.current = panStart;
//   pointsLenRef.current = points.length;
//   onZoomChangeRef.current = onZoomChange;
//   onPanChangeRef.current = onPanChange;

//   const total = points.length;
//   const visibleCount = Math.max(2, Math.min(total, Math.ceil(total / zoom)));
//   // panStart = index of the first visible point (0 = leftmost / oldest)
//   const maxStart = Math.max(0, total - visibleCount);
//   const start = Math.max(0, Math.min(panStart, maxStart));
//   const visiblePoints = useMemo(
//     () => points.slice(start, start + visibleCount),
//     [points, start, visibleCount],
//   );

//   const xLabels = useMemo(() => visiblePoints.map((p) => p.label), [visiblePoints]);

//   // Keep a ref to the current visible window for the tooltip (avoids recreating
//   // the tooltip component identity more often than needed).
//   const visiblePointsRef = useRef(visiblePoints);
//   visiblePointsRef.current = visiblePoints;

//   const TooltipContent = useMemo(
//     () =>
//       function TooltipContentWithPoints(props: ChartsTooltipProps) {
//         return <AxisTooltipContent {...props} visiblePoints={visiblePointsRef.current} />;
//       },
//     [],
//   );

//   // Marks are costly; only show them when the window is small enough
//   const showMarks = visibleCount <= 40;

//   const chartSeries = useMemo(
//     () =>
//       series.map((key) => {
//         const meta = SERIES_META[key];
//         return {
//           data: visiblePoints.map((p) => {
//             const v = p[meta.key];
//             return typeof v === 'number' ? v : null;
//           }),
//           label: meta.label,
//           color: meta.color,
//           yAxisId: key === 'spot' ? 'rightAxisId' : 'leftAxisId',
//           showMark: showMarks,
//           curve: 'linear' as const,
//           connectNulls: true,
//         };
//       }),
//     [series, visiblePoints, showMarks],
//   );

//   const hasSpot = series.includes('spot');
//   const hasOptions = series.some((k) => k !== 'spot');

//   const flushPending = useCallback(() => {
//     rafRef.current = null;
//     const pending = pendingRef.current;
//     if (!pending) return;
//     pendingRef.current = null;
//     if (pending.zoom !== zoomRef.current) onZoomChangeRef.current(pending.zoom);
//     if (pending.pan !== panStartRef.current) onPanChangeRef.current(pending.pan);
//   }, []);

//   const scheduleUpdate = useCallback(
//     (nextZoom: number, nextPan: number) => {
//       pendingRef.current = { zoom: nextZoom, pan: nextPan };
//       if (rafRef.current == null) {
//         rafRef.current = requestAnimationFrame(flushPending);
//       }
//     },
//     [flushPending],
//   );

//   // Left-click + drag horizontally to pan (no Shift needed).
//   // ~6px threshold so a plain click still leaves the tooltip alone.
//   const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
//     if (event.button !== 0) return;
//     dragRef.current = {
//       active: true,
//       dragging: false,
//       startX: event.clientX,
//       originPan: panStartRef.current,
//       pointerId: event.pointerId,
//     };
//   }, []);

//   const handlePointerMove = useCallback(
//     (event: React.PointerEvent<HTMLDivElement>) => {
//       const drag = dragRef.current;
//       if (!drag?.active) return;

//       const dx = event.clientX - drag.startX;
//       if (!drag.dragging) {
//         if (Math.abs(dx) < 6) return;
//         drag.dragging = true;
//         try {
//           (event.currentTarget as HTMLElement).setPointerCapture(drag.pointerId);
//           (event.currentTarget as HTMLElement).style.cursor = 'grabbing';
//         } catch {
//           /* ignore */
//         }
//       }

//       const t = pointsLenRef.current;
//       const z = zoomRef.current;
//       const vis = Math.max(2, Math.min(t, Math.ceil(t / z)));
//       const max = Math.max(0, t - vis);
//       const width = containerRef.current?.clientWidth ?? 1;
//       const pxPerPoint = width / Math.max(1, vis);
//       const deltaPoints = Math.round((drag.startX - event.clientX) / pxPerPoint);
//       const next = Math.max(0, Math.min(max, drag.originPan + deltaPoints));
//       if (next !== panStartRef.current) {
//         scheduleUpdate(z, next);
//       }
//     },
//     [scheduleUpdate],
//   );

//   const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
//     const drag = dragRef.current;
//     if (!drag?.active) return;
//     dragRef.current = null;
//     try {
//       (event.currentTarget as HTMLElement).style.cursor = 'grab';
//     } catch {
//       /* ignore */
//     }
//     if (drag.dragging) {
//       try {
//         (event.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId);
//       } catch {
//         /* already released */
//       }
//     }
//   }, []);

//   // Keep panStart in range when zoom / data length changes
//   useEffect(() => {
//     if (panStart > maxStart) onPanChange(maxStart);
//   }, [panStart, maxStart, onPanChange]);

//   // Stable native wheel listener — deps intentionally minimal; values come from refs.
//   // This is the main fix for laggy zoom: previously the listener was removed +
//   // re-added on every zoom/pan change, which made continuous scrolling feel sticky.
//   useEffect(() => {
//     const el = containerRef.current;
//     if (!el) return;

//     const onNativeWheel = (e: WheelEvent) => {
//       e.preventDefault();
//       e.stopPropagation();

//       const t = pointsLenRef.current;
//       if (t < 3) return;

//       const z = zoomRef.current;
//       const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
//       const nextZoom = Math.min(12, Math.max(1, z * factor));
//       if (nextZoom === z) return;

//       const vis = Math.max(2, Math.min(t, Math.ceil(t / z)));
//       const s = Math.max(0, Math.min(panStartRef.current, Math.max(0, t - vis)));
//       const mid = s + vis / 2;
//       const nextVisible = Math.max(2, Math.min(t, Math.ceil(t / nextZoom)));
//       const nextStart = Math.max(0, Math.min(t - nextVisible, Math.round(mid - nextVisible / 2)));

//       scheduleUpdate(nextZoom, nextStart);
//     };

//     el.addEventListener('wheel', onNativeWheel, { passive: false });
//     return () => {
//       el.removeEventListener('wheel', onNativeWheel);
//       if (rafRef.current != null) {
//         cancelAnimationFrame(rafRef.current);
//         rafRef.current = null;
//       }
//     };
//   }, [scheduleUpdate]);

//   return (
//     <div
//       ref={containerRef}
//       className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-950/70 p-2"
//       style={{ touchAction: 'none', cursor: 'grab' }}
//       onPointerDown={handlePointerDown}
//       onPointerMove={handlePointerMove}
//       onPointerUp={handlePointerUp}
//       onPointerCancel={handlePointerUp}
//       onPointerLeave={handlePointerUp}
//     >
//       <Box sx={{ width: '100%', height: { xs: 320, sm: 420, md: 460 } }}>
//         <LineChart
//           series={chartSeries}
//           xAxis={[
//             {
//               scaleType: 'point',
//               data: xLabels,
//               height: 48,
//               tickLabelStyle: { fill: '#94a3b8', fontSize: 10 },
//             },
//           ]}
//           yAxis={[
//             ...(hasOptions
//               ? [{ id: 'leftAxisId', width: 56, tickLabelStyle: { fill: '#94a3b8', fontSize: 11 } }]
//               : []),
//             ...(hasSpot
//               ? [
//                   {
//                     id: 'rightAxisId',
//                     position: 'right' as const,
//                     width: 64,
//                     tickLabelStyle: { fill: '#94a3b8', fontSize: 11 },
//                   },
//                 ]
//               : []),
//           ]}
//           grid={{ horizontal: true, vertical: false }}
//           margin={{ top: 24, right: hasSpot ? 12 : 8, bottom: 8, left: 8 }}
//           slots={{ tooltip: TooltipContent }}
//           slotProps={{
//             legend: {
//               direction: 'horizontal',
//               position: { vertical: 'top', horizontal: 'end' },
//             },
//           }}
//           sx={{
//             '& .MuiChartsAxis-line': { stroke: '#475569' },
//             '& .MuiChartsAxis-tick': { stroke: '#475569' },
//             '& .MuiChartsGrid-line': { stroke: 'rgba(148,163,184,.16)' },
//             '& .MuiChartsLegend-root': { color: '#94a3b8' },
//             '& .MuiChartsLegend-label': { fill: '#94a3b8', fontSize: 12, fontWeight: 600 },
//           }}
//         />
//       </Box>
//       {zoom > 1 && (
//         <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-ink-700 bg-ink-950/90 px-3 py-1 font-mono text-[10px] text-slate-400">
//           {start + 1}–{start + visiblePoints.length} / {total} · scroll to zoom · drag to pan
//         </div>
//       )}
//     </div>
//   );
// }

// const MiniChart = memo(function MiniChart({
//   points,
//   series,
// }: {
//   points: ChartPoint[];
//   series: SeriesKey[];
// }) {
//   if (!points.length) {
//     return <div className="grid h-28 place-items-center text-xs text-slate-500">No data for this slot</div>;
//   }

//   const xLabels = points.map((p) => p.label);
//   const chartSeries = series.map((key) => {
//     const meta = SERIES_META[key];
//     return {
//       data: points.map((p) => {
//         const v = p[meta.key];
//         return typeof v === 'number' ? v : null;
//       }),
//       label: meta.label,
//       color: meta.color,
//       showMark: false,
//       curve: 'linear' as const,
//       connectNulls: true,
//     };
//   });

//   return (
//     <Box sx={{ width: '100%', height: 112 }}>
//       <LineChart
//         series={chartSeries}
//         xAxis={[{ scaleType: 'point', data: xLabels }]}
//         yAxis={[{ width: 0 }]}
//         margin={{ top: 8, right: 4, bottom: 4, left: 4 }}
//         hideLegend
//         sx={{
//           '& .MuiChartsAxis-root': { display: 'none' },
//           '& .MuiChartsGrid-line': { stroke: '#232b3a' },
//         }}
//         grid={{ horizontal: true, vertical: false }}
//       />
//     </Box>
//   );
// });

// function formatVolume(value: number | null | undefined): string {
//   if (value === null || value === undefined || !Number.isFinite(value)) return '--';
//   if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
//   if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
//   return value.toFixed(0);
// }

// function offsetDescription(index: IndexName, offset: ExpiryOffset): string {
//   const target = weekdayFromTradingOffset(INDEX_EXPIRY_WEEKDAY[index], offset);
//   if (offset === 0) return `Expiry day (${WEEKDAY_NAMES[INDEX_EXPIRY_WEEKDAY[index]]})`;
//   return `${Math.abs(offset)} trading day(s) before expiry (${WEEKDAY_NAMES[target]})`;
// }

// /** Label for the expiry-offset <option>, e.g. "0 (Tue)" / "-1 (Mon)". */
// function offsetOptionLabel(index: IndexName, offset: ExpiryOffset): string {
//   const target = weekdayFromTradingOffset(INDEX_EXPIRY_WEEKDAY[index], offset);
//   return `${offset} (${WEEKDAY_NAMES[target]})`;
// }

// function formatIvTimestamp(timestamp: string): string {
//   const date = new Date(timestamp);
//   if (Number.isNaN(date.getTime())) return timestamp;
//   return date.toLocaleString([], {
//     year: 'numeric',
//     month: 'short',
//     day: '2-digit',
//     hour: '2-digit',
//     minute: '2-digit',
//     second: '2-digit',
//   });
// }

// function formatIvValue(value: number | null): string {
//   return value === null || !Number.isFinite(value) ? '--' : value.toFixed(2);
// }


// /** Split [from, to] into inclusive ~chunkDays windows for parallel API calls. */
// const CHUNK_DAYS = 30;

// function splitDateRange(
//   fromDate: string,
//   toDate: string,
//   chunkDays = CHUNK_DAYS,
// ): { from: string; to: string }[] {
//   const chunks: { from: string; to: string }[] = [];
//   const start = new Date(fromDate + 'T00:00:00');
//   const end = new Date(toDate + 'T00:00:00');
//   if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

//   let cur = new Date(start);
//   while (cur <= end) {
//     const chunkEnd = new Date(cur);
//     chunkEnd.setDate(chunkEnd.getDate() + chunkDays - 1);
//     if (chunkEnd > end) chunkEnd.setTime(end.getTime());

//     chunks.push({
//       from: cur.toISOString().slice(0, 10),
//       to: chunkEnd.toISOString().slice(0, 10),
//     });

//     cur = new Date(chunkEnd);
//     cur.setDate(cur.getDate() + 1);
//   }
//   return chunks;
// }

// /** Run async work with a fixed concurrency pool. */
// async function mapPool<T, R>(
//   items: T[],
//   concurrency: number,
//   fn: (item: T, index: number) => Promise<R>,
// ): Promise<R[]> {
//   const results: R[] = new Array(items.length);
//   let next = 0;

//   async function worker() {
//     while (next < items.length) {
//       const i = next++;
//       results[i] = await fn(items[i], i);
//     }
//   }

//   const n = Math.max(1, Math.min(concurrency, items.length));
//   await Promise.all(Array.from({ length: n }, () => worker()));
//   return results;
// }

// type HistoricalStraddleResponse = {
//   success?: boolean;
//   data?: StraddleRecord[];
//   message?: string;
//   count?: number;
// };

// /**
//  * Fetch historical straddle in ~30-day chunks in parallel, then merge + sort.
//  * Keeps each backend request small and fast.
//  */
// async function fetchHistoricalStraddleParallel(params: {
//   index: string;
//   from_date: string;
//   to_date: string;
//   interval: MarketInterval;
//   onProgress?: (done: number, total: number) => void;
// }): Promise<HistoricalStraddleResponse> {
//   const chunks = splitDateRange(params.from_date, params.to_date, CHUNK_DAYS);
//   if (chunks.length === 0) {
//     return { success: true, data: [], count: 0 };
//   }

//   // Modest concurrency so we don't overload a single backend process
//   const concurrency = params.interval === 1 ? 3 : 4;
//   let done = 0;

//   const responses = await mapPool(chunks, concurrency, async ({ from, to }) => {
//     const res = await api.getHistoricalStraddle<HistoricalStraddleResponse>({
//       index: params.index,
//       from_date: from,
//       to_date: to,
//       interval: params.interval,
//     });
//     done += 1;
//     params.onProgress?.(done, chunks.length);
//     return res;
//   });

//   const byKey = new Map<string, StraddleRecord>();
//   const errors: string[] = [];

//   for (const res of responses) {
//     if (res?.success === false && res.message) {
//       errors.push(res.message);
//       continue;
//     }
//     const rows = Array.isArray(res?.data) ? res.data : [];
//     for (const row of rows) {
//       const key = String(row.datetime ?? row.timestamp ?? row.date ?? '');
//       if (key) byKey.set(key, row);
//     }
//   }

//   const merged = Array.from(byKey.values()).sort((a, b) =>
//     String(a.datetime ?? '').localeCompare(String(b.datetime ?? '')),
//   );

//   if (merged.length === 0 && errors.length > 0) {
//     return { success: false, data: [], message: errors[0], count: 0 };
//   }

//   return { success: true, data: merged, count: merged.length };
// }

// export default function ATMStraddlePage() {
//   const [index, setIndex] = useState<IndexName>('NIFTY');
//   const [fromDate, setFromDate] = useState('2026-04-01');
//   const [toDate, setToDate] = useState(TODAY);
//   const [selectedTime, setSelectedTime] = useState('09:15');
//   const [interval, setInterval] = useState<MarketInterval>(15);
//   const [expiryOffset, setExpiryOffset] = useState<ExpiryOffset>(0);
//   const [submittedFilters, setSubmittedFilters] = useState<{
//     index: IndexName;
//     fromDate: string;
//     toDate: string;
//     interval: MarketInterval;
//   } | null>(null);
//   const [records, setRecords] = useState<StraddleRecord[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [ivData, setIvData] = useState<TodayIvResponse | null>(null);
//   const [ivLoading, setIvLoading] = useState(false);
//   const [ivError, setIvError] = useState('');
//   const ivRequestIdRef = useRef(0);
//   const [zoom, setZoom] = useState(1);
//   const [panStart, setPanStart] = useState(0); // index of first visible point
//   const [series, setSeries] = useState<SeriesKey[]>(['straddle', 'spot']);
//   const [debugInfo, setDebugInfo] = useState<{
//     raw: unknown;
//     recordCount: number;
//     sampleKeys: string[];
//   } | null>(null);

//   const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
//   const loadAbortRef = useRef(0);

//   const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();

//     if (fromDate > toDate) {
//       setError('From date must be before or equal to the To date');
//       setRecords([]);
//       return;
//     }

//     const filters = { index, fromDate, toDate, interval };
//     setSubmittedFilters(filters);

//     const requestId = loadAbortRef.current + 1;
//     loadAbortRef.current = requestId;

//     setLoading(true);
//     setError('');
//     setDebugInfo(null);
//     setLoadProgress(null);

//     // Parallel ~30-day chunks — do NOT send expiry_offset (client filters in buildPoints).
//     fetchHistoricalStraddleParallel({
//       index,
//       from_date: fromDate,
//       to_date: toDate,
//       interval,
//       onProgress: (done, total) => {
//         if (requestId === loadAbortRef.current) {
//           setLoadProgress({ done, total });
//         }
//       },
//     })
//       .then((response) => {
//         if (requestId !== loadAbortRef.current) return;
//         // eslint-disable-next-line no-console
//         console.log('[ATMStraddle] merged parallel response:', response);

//         const data = Array.isArray(response?.data) ? response.data : [];
//         setDebugInfo({
//           raw: { ...response, note: 'merged from parallel 30-day chunks' },
//           recordCount: data.length,
//           sampleKeys: data[0] ? Object.keys(data[0]) : [],
//         });

//         if (response?.success === false) {
//           setError(response.message || 'Unable to load straddle data');
//           setRecords([]);
//           return;
//         }
//         setRecords(data);
//       })
//       .catch((requestError: unknown) => {
//         if (requestId !== loadAbortRef.current) return;
//         // eslint-disable-next-line no-console
//         console.error('[ATMStraddle] request failed:', requestError);
//         setError(requestError instanceof Error ? requestError.message : 'Unable to load straddle data');
//         setDebugInfo({ raw: String(requestError), recordCount: 0, sampleKeys: [] });
//       })
//       .finally(() => {
//         if (requestId === loadAbortRef.current) {
//           setLoading(false);
//           setLoadProgress(null);
//         }
//       });
//   };

//   const points = useMemo(
//     () =>
//       submittedFilters
//         ? buildPoints(
//             records,
//             selectedTime,
//             submittedFilters.index,
//             expiryOffset,
//             submittedFilters.interval,
//           )
//         : [],
//     [records, selectedTime, expiryOffset, submittedFilters],
//   );

//   const activeMarketSlots = useMemo(
//     () => generateMarketSlots(submittedFilters?.interval ?? interval),
//     [interval, submittedFilters],
//   );

//   // Precompute each interval slot once so zoom/pan on the main chart does not
//   // rebuild the mini-charts on every wheel tick.
//   const slotRows = useMemo(() => {
//     if (!submittedFilters) return new Map<string, ChartPoint[]>();
//     return buildSlotRows(
//       records,
//       submittedFilters.index,
//       expiryOffset,
//       submittedFilters.interval,
//       activeMarketSlots,
//     );
//   }, [activeMarketSlots, records, expiryOffset, submittedFilters]);

//   // Reset pan/zoom when the filtered series changes
//   useEffect(() => {
//     setZoom(1);
//     setPanStart(0);
//   }, [submittedFilters, records]);

//   const zoomIn = () => {
//     setZoom((value) => {
//       const next = Math.min(12, value * 1.5);
//       // keep window near the right (latest) edge when zooming via buttons
//       const vis = Math.max(2, Math.ceil(points.length / next));
//       setPanStart(Math.max(0, points.length - vis));
//       return next;
//     });
//   };
//   const zoomOut = () => {
//     setZoom((value) => {
//       const next = Math.max(1, value / 1.5);
//       const vis = Math.max(2, Math.ceil(points.length / next));
//       setPanStart((start) => Math.min(start, Math.max(0, points.length - vis)));
//       return next;
//     });
//   };
//   const resetView = () => {
//     setZoom(1);
//     setPanStart(0);
//   };
//   const toggleSeries = (key: SeriesKey) =>
//     setSeries((current) =>
//       current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
//     );

//   useEffect(() => {
//     ivRequestIdRef.current += 1;
//     setIvData(null);
//     setIvError('');
//   }, [index]);

//   const fetchTodayIv = async () => {
//     const requestId = ivRequestIdRef.current + 1;
//     ivRequestIdRef.current = requestId;
//     setIvLoading(true);
//     setIvError('');

//     try {
//       const response = await api.getTodayIv<TodayIvResponse>(index, interval);
//       if (requestId !== ivRequestIdRef.current) return;
//       setIvData(response);
//     } catch (requestError: unknown) {
//       if (requestId !== ivRequestIdRef.current) return;
//       setIvData(null);
//       setIvError(requestError instanceof Error ? requestError.message : 'Unable to load today\'s IV');
//     } finally {
//       if (requestId === ivRequestIdRef.current) setIvLoading(false);
//     }
//   };

//   const activeIndex = submittedFilters?.index ?? index;
//   const activeTime = selectedTime;
//   const activeExpiryOffset = expiryOffset;
//   const activeFromDate = submittedFilters?.fromDate ?? fromDate;
//   const activeToDate = submittedFilters?.toDate ?? toDate;
//   const expiryLabel =
//     activeExpiryOffset === 0
//       ? `Expiry day (0 · ${WEEKDAY_NAMES[INDEX_EXPIRY_WEEKDAY[activeIndex]]})`
//       : `${activeExpiryOffset} (${offsetDescription(activeIndex, activeExpiryOffset)})`;

//   return (
//     <div className="mx-auto max-w-[1500px] space-y-3 pb-8 text-[#e7ecf4]">
//       <div className="flex flex-wrap items-end justify-between gap-4">
//         <div>
//           <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-accent">Market analytics</p>
//           <h1 className="font-display text-3xl font-semibold text-white">Straddle snapshot grid</h1>
//           <p className="mt-1 max-w-2xl text-sm leading-6 text-[#8b96ac]">
//             ATM straddle filtered by trading-day offset from index expiry. Weekends always skipped.
//           </p>
//         </div>
//         <div className="flex items-center gap-2 text-xs text-slate-400">
//           <span className="h-2 w-2 rounded-full bg-accent" />
//           {loading
//             ? loadProgress
//               ? `Fetching ${loadProgress.done}/${loadProgress.total} chunks`
//               : 'Fetching data'
//             : `${points.length} points`}
//         </div>
//       </div>

//       <form onSubmit={submitFilters} className="rounded-xl border border-[#232b3a] bg-[#121722] p-3 shadow-panel">
//         <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
//           <label className="text-xs font-semibold text-slate-400">
//             Index
//             <select
//               value={index}
//               onChange={(event) => setIndex(event.target.value as IndexName)}
//               className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-xs text-white outline-none focus:border-accent"
//             >
//               {INDEXES.map((item) => (
//                 <option key={item}>{item}</option>
//               ))}
//             </select>
//           </label>

//           <label className="text-xs font-semibold text-slate-400">
//             Expiry offset
//             <select
//               value={expiryOffset}
//               onChange={(event) => setExpiryOffset(Number(event.target.value) as ExpiryOffset)}
//               className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
//             >
//               {EXPIRY_OFFSETS.slice(0, 5).map((offset) => (
//                 <option key={offset} value={offset}>
//                   {offsetOptionLabel(index, offset)}
//                 </option>
//               ))}
//             </select>
//           </label>

//           <label className="text-xs font-semibold text-slate-400">
//             From
//             <input
//               type="date"
//               value={fromDate}
//               onChange={(event) => setFromDate(event.target.value)}
//               className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
//             />
//           </label>

//           <label className="text-xs font-semibold text-slate-400">
//             To
//             <input
//               type="date"
//               min={fromDate}
//               value={toDate}
//               onChange={(event) => setToDate(event.target.value)}
//               className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
//             />
//           </label>

//           <label className="text-xs font-semibold text-slate-400">
//             Market time
//             <select
//               value={selectedTime}
//               onChange={(event) => setSelectedTime(event.target.value)}
//               className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
//             >
//               {generateMarketSlots(interval).map((time) => (
//                 <option key={time}>{time}</option>
//               ))}
//             </select>
//           </label>

//           <label className="text-xs font-semibold text-slate-400">
//             Interval
//             <select
//               value={interval}
//               onChange={(event) => {
//                 setInterval(Number(event.target.value) as MarketInterval);
//                 setSelectedTime('09:15');
//               }}
//               className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
//             >
//               <option value={1}>1 min</option>
//               <option value={15}>15 min</option>
//             </select>
//           </label>

//           <button
//             type="submit"
//             disabled={loading}
//             className="mt-auto min-h-[42px] rounded-lg bg-accent px-4 py-2 text-xs font-bold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
//           >
//             {loading ? 'Loading...' : 'Submit'}
//           </button>
//         </div>
//         <div className="mt-3 font-mono text-[11px] text-[#8b96ac]">
//           Market session 09:15 - 15:30 · {interval} min · {offsetDescription(index, expiryOffset)} · weekends
//           skipped
//         </div>
//       </form>

//       <section className="rounded-xl border border-[#232b3a] bg-[#121722] p-4 shadow-panel">
//         <div className="flex flex-wrap items-center justify-between gap-3">
//           <div>
//             <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
//               Today&apos;s ATM data · {index}
//             </p>
//             {ivData ? (
//               <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-400 sm:grid-cols-3 lg:grid-cols-6">
//                 <span>
//                   IV <b className="ml-1 font-mono text-accent">{formatIvValue(ivData.iv)}%</b>
//                 </span>
//                 <span>
//                   Call IV <b className="ml-1 font-mono text-slate-200">{formatIvValue(ivData.callIv)}%</b>
//                 </span>
//                 <span>
//                   Put IV <b className="ml-1 font-mono text-slate-200">{formatIvValue(ivData.putIv)}%</b>
//                 </span>
//                 <span>
//                   Call <b className="ml-1 font-mono text-[#e8a33d]">{formatIvValue(ivData.callPrice)}</b>
//                 </span>
//                 <span>
//                   Put <b className="ml-1 font-mono text-[#e0607a]">{formatIvValue(ivData.putPrice)}</b>
//                 </span>
//                 <span>
//                   Straddle <b className="ml-1 font-mono text-[#4fd8c4]">{formatIvValue(ivData.straddlePrice)}</b>
//                 </span>
//               </div>
//             ) : (
//               <p className="mt-1 text-sm text-slate-500">Click Get latest IV to fetch today&apos;s values.</p>
//             )}
//           </div>
//           <div className="flex items-center gap-3">
//             {ivData && (
//               <div className="text-right text-xs text-slate-400">
//                 <p>{formatIvTimestamp(ivData.timestamp)}</p>
//                 <p className="mt-1 font-mono text-[11px] text-slate-500">
//                   Spot {formatIvValue(ivData.spot)} · Strike {formatIvValue(ivData.strike)}
//                 </p>
//               </div>
//             )}
//             <button
//               type="button"
//               onClick={fetchTodayIv}
//               disabled={ivLoading}
//               className="rounded-lg border border-accent/60 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
//             >
//               {ivLoading ? 'Loading IV...' : 'Get latest IV'}
//             </button>
//           </div>
//         </div>
//         {ivError && <p className="mt-2 text-xs text-danger">{ivError}</p>}
//       </section>

//       <section className="flex flex-wrap gap-5 rounded-xl border border-[#232b3a] bg-[#121722] px-4 py-3">
//         {(Object.keys(SERIES_META) as SeriesKey[]).map((key) => (
//           <label key={key} className="flex cursor-pointer items-center gap-2 text-xs text-[#8b96ac]">
//             <input
//               type="checkbox"
//               checked={series.includes(key)}
//               onChange={() => toggleSeries(key)}
//               className="accent-[#4fd8c4]"
//             />
//             <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SERIES_META[key].color }} />
//             {SERIES_META[key].label}
//           </label>
//         ))}
//       </section>

//       <section className="rounded-xl border border-[#232b3a] bg-[#121722] p-5 shadow-panel">
//         <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
//           <div>
//             <h2 className="font-display text-lg font-semibold text-white">
//               {activeIndex} · {activeTime} · {expiryLabel}
//             </h2>
//             <p className="text-xs text-slate-400">
//               {activeFromDate} to {activeToDate}
//             </p>
//           </div>
//           <div className="flex items-center gap-2">
//             <button
//               type="button"
//               onClick={zoomOut}
//               disabled={zoom <= 1}
//               className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-900 text-lg text-slate-200 disabled:opacity-40"
//               aria-label="Zoom out"
//             >
//               −
//             </button>
//             <button
//               type="button"
//               onClick={zoomIn}
//               disabled={zoom >= 12}
//               className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-900 text-lg text-slate-200 disabled:opacity-40"
//               aria-label="Zoom in"
//             >
//               +
//             </button>
//             <button
//               type="button"
//               onClick={resetView}
//               className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200"
//             >
//               Reset
//             </button>
//           </div>
//         </div>

//         <p className="mb-3 text-xs text-[#8b96ac]">
//           Only {offsetDescription(activeIndex, activeExpiryOffset)} · weekends excluded · tooltip shows date +
//           weekday
//         </p>

//         {error ? (
//           <div className="rounded-lg border border-danger/40 bg-danger/10 p-5 text-sm text-danger">{error}</div>
//         ) : loading ? (
//           <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">
//             Loading historical straddle data...
//           </div>
//         ) : !submittedFilters ? (
//           <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">
//             Select filters and click Submit to load historical straddle data.
//           </div>
//         ) : points.length === 0 ? (
//           <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">
//             No data for {activeTime} with offset {activeExpiryOffset} (
//             {offsetDescription(activeIndex, activeExpiryOffset)}).
//           </div>
//         ) : (
//           <MuiLineChart
//             points={points}
//             zoom={zoom}
//             series={series}
//             onZoomChange={setZoom}
//             panStart={panStart}
//             onPanChange={setPanStart}
//           />
//         )}
//       </section>

//       <div>
//         <h2 className="font-display text-base font-semibold">All time slots</h2>
//         <p className="mt-1 text-xs text-[#8b96ac]">
//           Same expiry-offset filter applied to every {submittedFilters?.interval ?? interval}-minute slot.
//         </p>
//       </div>

//       <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
//         {activeMarketSlots.map((slot) => {
//           const rows = slotRows.get(slot) ?? [];
//           const latest = rows[rows.length - 1];
//           const first = rows[0];
//           const change =
//             first?.straddle && latest?.straddle !== null
//               ? ((latest.straddle! - first.straddle) / first.straddle) * 100
//               : null;
//           return (
//             <article key={slot} className="rounded-xl border border-[#232b3a] bg-[#121722] p-3.5">
//               <div className="mb-2 flex items-baseline justify-between">
//                 <h3 className="font-display text-base font-semibold">{slot}</h3>
//                 {change !== null && (
//                   <span
//                     className={
//                       change >= 0 ? 'font-mono text-xs text-[#48c78e]' : 'font-mono text-xs text-[#e0607a]'
//                     }
//                   >
//                     {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
//                   </span>
//                 )}
//               </div>
//               {latest && (
//                 <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-[#8b96ac]">
//                   <span>
//                     Straddle{' '}
//                     <b className="text-[#4fd8c4]">
//                       ₹{latest.straddle === null ? '--' : latest.straddle.toFixed(1)}
//                     </b>
//                   </span>
//                   <span>
//                     Spot{' '}
//                     <b className="text-[#7c93c9]">
//                       {latest.spot === null ? '--' : latest.spot.toFixed(1)}
//                     </b>
//                   </span>
//                   <span>
//                     Call{' '}
//                     <b className="text-[#e8a33d]">
//                       ₹{latest.call === null ? '--' : latest.call.toFixed(1)}
//                     </b>
//                   </span>
//                   <span>
//                     Put{' '}
//                     <b className="text-[#e0607a]">
//                       ₹{latest.put === null ? '--' : latest.put.toFixed(1)}
//                     </b>
//                   </span>
//                   <span>
//                     IV{' '}
//                     <b className="text-[#a78bfa]">
//                       {latest.iv === null ? '--' : `${latest.iv.toFixed(2)}%`}
//                     </b>
//                   </span>
//                   <span>
//                     Vol <b className="text-[#38bdf8]">{formatVolume(latest.volume)}</b>
//                   </span>
//                 </div>
//               )}
//               <p className="mb-1 text-[10px] text-[#8b96ac]">
//                 {rows.length ? `${rows.length} sessions · latest ${latest.date}` : 'No data for this slot'}
//               </p>
//               <MiniChart points={rows} series={series} />
//             </article>
//           );
//         })}
//       </div>

//       {debugInfo && (
//         <details className="rounded-xl border border-ink-700 bg-panel p-4 text-xs text-slate-400 shadow-panel">
//           <summary className="cursor-pointer select-none font-semibold text-slate-300">
//             Debug: last response — {debugInfo.recordCount} record
//             {debugInfo.recordCount === 1 ? '' : 's'}
//             {debugInfo.sampleKeys.length > 0 ? ` · fields: ${debugInfo.sampleKeys.join(', ')}` : ''}
//           </summary>
//           <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-950/70 p-3 text-[11px] text-slate-300">
//             {JSON.stringify(debugInfo.raw, null, 2).slice(0, 4000)}
//           </pre>
//         </details>
//       )}
//     </div>
//   );
// }

