import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Boxes, 
  AlertTriangle, 
  Activity, 
  ArrowLeftRight, 
  RotateCcw, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  MapPin, 
  PieChart, 
  BarChart3, 
  Sparkles, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';
import styles from './DashboardPage.module.css';

interface DashboardKpis {
  activeItems: number;
  lowStockItems: number;
  movementsToday: number;
  distinctItemsMovedThisWeek: number;
  totalInventoryUnits: number;
  timestamp: string;
}

interface CategoryDistribution {
  id: string;
  name: string;
  itemCount: number;
  totalQuantity: number;
  percentage: number;
  color: string;
}

interface LocationDistribution {
  id: string;
  name: string;
  code: string;
  totalQuantity: number;
  distinctItems: number;
  percentage: number;
}

interface DashboardDistribution {
  byCategory: CategoryDistribution[];
  byLocation: LocationDistribution[];
  totalCategoryUnits: number;
  totalLocationUnits: number;
}

interface MovementTrendWeek {
  weekIndex: number;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  receipts: number;
  issues: number;
  transfers: number;
  adjustments: number;
  totalVolume: number;
  netChange: number;
}

interface DashboardTrends {
  trends: MovementTrendWeek[];
  summary: {
    totalReceipts: number;
    totalIssues: number;
    netDelta: number;
    numberOfWeeks: number;
  };
}

interface DashboardPageProps {
  onNavigateToItems?: () => void;
  onNavigateToAlerts?: () => void;
  onNavigateToMovements?: () => void;
  onNavigateToLocations?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToItems,
  onNavigateToAlerts,
  onNavigateToMovements,
  onNavigateToLocations,
}) => {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [distribution, setDistribution] = useState<DashboardDistribution | null>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Interactive selections
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null);
  const [hoveredWeekIndex, setHoveredWeekIndex] = useState<number | null>(null);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      const [kpiRes, distRes, trendRes] = await Promise.all([
        fetch('/api/dashboard/kpis', { credentials: 'include' }),
        fetch('/api/dashboard/distribution', { credentials: 'include' }),
        fetch('/api/dashboard/movement-trends', { credentials: 'include' }),
      ]);

      if (!kpiRes.ok || !distRes.ok || !trendRes.ok) {
        throw new Error('Failed to retrieve analytics data from server.');
      }

      const [kpiData, distData, trendData] = await Promise.all([
        kpiRes.json(),
        distRes.json(),
        trendRes.json(),
      ]);

      setKpis(kpiData);
      setDistribution(distData);
      setTrends(trendData);
      setLastRefreshed(new Date());

      // Auto-select current week (last week index = 7) for inspection box
      if (trendData?.trends?.length > 0) {
        setHoveredWeekIndex(trendData.trends.length - 1);
      }
    } catch (err: any) {
      console.error('Error loading dashboard analytics:', err);
      setError(err.message || 'Unable to connect to analytics services.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Donut SVG Calculations
  const donutRadius = 65;
  const donutCircumference = 2 * Math.PI * donutRadius; // ≈ 408.4

  const donutSegments = useMemo(() => {
    if (!distribution || distribution.totalCategoryUnits === 0) return [];
    let accumulated = 0;
    return distribution.byCategory.map((cat, index) => {
      const fraction = cat.totalQuantity / distribution.totalCategoryUnits;
      const strokeLength = Math.max(0, fraction * donutCircumference);
      const strokeOffset = accumulated * donutCircumference;
      accumulated += fraction;

      return {
        ...cat,
        index,
        strokeLength,
        strokeOffset,
      };
    });
  }, [distribution, donutCircumference]);

  const activeCategory = useMemo(() => {
    if (!distribution || hoveredCategoryIndex === null) return null;
    return distribution.byCategory[hoveredCategoryIndex] || null;
  }, [distribution, hoveredCategoryIndex]);

  // 8-Week Trend Chart Scale Calculations
  const chartWidth = 720;
  const chartHeight = 160;
  const chartLeft = 50;
  const chartTop = 30;
  const chartBottom = chartTop + chartHeight;

  const maxTrendVolume = useMemo(() => {
    if (!trends || trends.trends.length === 0) return 20;
    const maxVal = Math.max(
      ...trends.trends.map((t) => Math.max(t.receipts, t.issues, t.totalVolume))
    );
    // Round up to nice number
    const ceiling = Math.ceil(maxVal / 20) * 20;
    return Math.max(ceiling, 20);
  }, [trends]);

  const selectedWeek = useMemo(() => {
    if (!trends || hoveredWeekIndex === null) return null;
    return trends.trends[hoveredWeekIndex] || null;
  }, [trends, hoveredWeekIndex]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingBox}>
          <RotateCcw size={36} className={styles.spinning} color="var(--accent-primary)" />
          <p>Synthesizing operational ledger analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header Area */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <Sparkles size={26} />
            Analytics & Stock Control Dashboard
          </h1>
          <p className={styles.subtitle}>
            Real-time operational inventory performance, threshold surveillance, and 8-week movement velocity.
          </p>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.lastUpdated}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            className={styles.refreshBtn}
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            title="Refresh analytics from ledger"
          >
            <RotateCcw size={16} className={refreshing ? styles.spinning : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={() => fetchDashboardData(true)} className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* 4 Headline KPI Cards (Requirement 8) */}
      <div className={styles.kpiGrid}>
        {/* KPI 1: Active Items */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}
          onClick={onNavigateToItems}
          title="Click to explore catalog items"
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiTop}>
            <div className={styles.kpiIconWrapper} style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <Boxes size={22} />
            </div>
            <span className={styles.kpiBadge} style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
              Catalog
            </span>
          </div>
          <div className={styles.kpiMain}>
            <div className={styles.kpiValue}>{kpis?.activeItems?.toLocaleString() ?? 0}</div>
            <div className={styles.kpiLabel}>Active Items in Catalog</div>
          </div>
          <div className={styles.kpiFooter}>
            <span>Non-archived SKUs</span>
            <span className={styles.kpiFooterLink}>
              View <ChevronRight size={14} />
            </span>
          </div>
        </div>

        {/* KPI 2: Items <= Reorder Level */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardWarning}`}
          onClick={onNavigateToAlerts}
          title="Click to inspect items at risk of stockout"
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiTop}>
            <div className={styles.kpiIconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <AlertTriangle size={22} />
            </div>
            <span className={styles.kpiBadge} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              Low Stock
            </span>
          </div>
          <div className={styles.kpiMain}>
            <div className={styles.kpiValue} style={{ color: (kpis?.lowStockItems ?? 0) > 0 ? '#fca5a5' : 'inherit' }}>
              {kpis?.lowStockItems?.toLocaleString() ?? 0}
            </div>
            <div className={styles.kpiLabel}>Items ≤ Reorder Level</div>
          </div>
          <div className={styles.kpiFooter}>
            <span>Across all locations</span>
            <span className={styles.kpiFooterLink}>
              Inspect <ChevronRight size={14} />
            </span>
          </div>
        </div>

        {/* KPI 3: Movements Today */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}
          onClick={onNavigateToMovements}
          title="Click to view daily transactions in ledger"
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiTop}>
            <div className={styles.kpiIconWrapper} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Activity size={22} />
            </div>
            <span className={styles.kpiBadge} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              Today
            </span>
          </div>
          <div className={styles.kpiMain}>
            <div className={styles.kpiValue}>{kpis?.movementsToday?.toLocaleString() ?? 0}</div>
            <div className={styles.kpiLabel}>Movements Recorded Today</div>
          </div>
          <div className={styles.kpiFooter}>
            <span>Since 00:00 UTC</span>
            <span className={styles.kpiFooterLink}>
              Ledger <ChevronRight size={14} />
            </span>
          </div>
        </div>

        {/* KPI 4: Distinct Items Moved This Week */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardInfo}`}
          onClick={onNavigateToMovements}
          title="Click to explore active inventory velocity"
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiTop}>
            <div className={styles.kpiIconWrapper} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' }}>
              <ArrowLeftRight size={22} />
            </div>
            <span className={styles.kpiBadge} style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#d8b4fe', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
              Trailing 7D
            </span>
          </div>
          <div className={styles.kpiMain}>
            <div className={styles.kpiValue}>{kpis?.distinctItemsMovedThisWeek?.toLocaleString() ?? 0}</div>
            <div className={styles.kpiLabel}>Distinct Items Moved This Week</div>
          </div>
          <div className={styles.kpiFooter}>
            <span>Total units: {kpis?.totalInventoryUnits?.toLocaleString() ?? 0}</span>
            <span className={styles.kpiFooterLink}>
              Details <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Category Breakdown Donut & Warehouse Capacity */}
      <div className={styles.vizGrid}>
        {/* Chart 1: Stock by Category (Donut Chart) */}
        <div className={styles.vizCard}>
          <div className={styles.vizHeader}>
            <div>
              <div className={styles.vizTitle}>
                <PieChart size={18} />
                Stock by Category
              </div>
              <div className={styles.vizSubtitle}>Proportional on-hand units across product categories</div>
            </div>
            <span className={styles.vizBadge}>
              {distribution?.totalCategoryUnits?.toLocaleString() ?? 0} Units Total
            </span>
          </div>

          <div className={styles.donutContainer}>
            <div className={styles.donutSvgWrapper}>
              <svg className={styles.donutSvg} viewBox="0 0 200 200">
                {/* Background Ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={donutRadius}
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="20"
                />

                {/* Donut Segments */}
                {donutSegments.map((segment) => {
                  const isHovered = hoveredCategoryIndex === segment.index;
                  return (
                    <circle
                      key={segment.id}
                      className={`${styles.donutSegment} ${isHovered ? styles.donutSegmentActive : ''}`}
                      cx="100"
                      cy="100"
                      r={donutRadius}
                      fill="transparent"
                      stroke={segment.color}
                      strokeWidth={isHovered ? 24 : 18}
                      strokeDasharray={`${Math.max(0, segment.strokeLength - 1.5)} ${donutCircumference}`}
                      strokeDashoffset={-segment.strokeOffset}
                      transform="rotate(-90 100 100)"
                      onMouseEnter={() => setHoveredCategoryIndex(segment.index)}
                      onMouseLeave={() => setHoveredCategoryIndex(null)}
                      style={{
                        opacity: hoveredCategoryIndex !== null && !isHovered ? 0.45 : 1,
                      }}
                    />
                  );
                })}
              </svg>

              {/* Dynamic Donut Center Display */}
              <div className={styles.donutCenter}>
                {activeCategory ? (
                  <>
                    <div className={styles.donutCenterValue} style={{ color: activeCategory.color }}>
                      {activeCategory.totalQuantity.toLocaleString()}
                    </div>
                    <div className={styles.donutCenterLabel} title={activeCategory.name}>
                      {activeCategory.name}
                    </div>
                    <div className={styles.donutCenterSub}>
                      {activeCategory.percentage}% of stock
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.donutCenterValue}>
                      {distribution?.totalCategoryUnits?.toLocaleString() ?? 0}
                    </div>
                    <div className={styles.donutCenterLabel}>On-Hand Units</div>
                    <div className={styles.donutCenterSub}>
                      {distribution?.byCategory?.length ?? 0} Categories
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Category Legend List */}
            <div className={styles.legendList}>
              {distribution?.byCategory?.map((cat, idx) => {
                const isActive = hoveredCategoryIndex === idx;
                return (
                  <div
                    key={cat.id}
                    className={`${styles.legendItem} ${isActive ? styles.legendItemActive : ''}`}
                    onMouseEnter={() => setHoveredCategoryIndex(idx)}
                    onMouseLeave={() => setHoveredCategoryIndex(null)}
                  >
                    <div className={styles.legendLeft}>
                      <span className={styles.legendDot} style={{ background: cat.color }} />
                      <span className={styles.legendName}>{cat.name}</span>
                      <span className={styles.legendCount}>({cat.itemCount} SKUs)</span>
                    </div>
                    <div className={styles.legendRight}>
                      <span className={styles.legendUnits}>{cat.totalQuantity.toLocaleString()}</span>
                      <span className={styles.legendPercent}>{cat.percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 2: Stock by Warehouse Location (Bar Visualization) */}
        <div className={styles.vizCard}>
          <div className={styles.vizHeader}>
            <div>
              <div className={styles.vizTitle}>
                <MapPin size={18} />
                Stock by Warehouse Location
              </div>
              <div className={styles.vizSubtitle}>Inventory balance and item breadth per facility</div>
            </div>
            <button
              onClick={onNavigateToLocations}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              Manage Facilities
            </button>
          </div>

          <div className={styles.locationList}>
            {distribution?.byLocation?.map((loc) => {
              return (
                <div key={loc.id} className={styles.locationItem}>
                  <div className={styles.locationHeader}>
                    <div className={styles.locationTitleArea}>
                      <span className={styles.locationCode}>{loc.code}</span>
                      <span className={styles.locationName}>{loc.name}</span>
                    </div>
                    <div className={styles.locationStats}>
                      <span className={styles.locationUnits}>{loc.totalQuantity.toLocaleString()}</span>
                      <span className={styles.locationUnitLabel}>units</span>
                      <span className={styles.locationPercent}>({loc.percentage}%)</span>
                    </div>
                  </div>

                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${Math.min(100, Math.max(loc.percentage, 2))}%`,
                      }}
                    />
                  </div>

                  <div className={styles.locationMeta}>
                    <span>{loc.distinctItems} distinct items stocked</span>
                    <span>Proportional Share</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 8-Week Movement Volume Trend Chart (Requirement 8) */}
      <div className={styles.trendSection}>
        <div className={styles.trendHeader}>
          <div>
            <div className={styles.vizTitle}>
              <BarChart3 size={20} />
              8-Week Movement Volume Trends
            </div>
            <div className={styles.vizSubtitle}>
              Weekly inflow (Receipts) vs. Outflow (Issues) comparison and velocity trajectory
            </div>
          </div>

          <div className={styles.chartLegend}>
            <div className={styles.chartLegendItem}>
              <span className={styles.chartLegendSwatch} style={{ background: '#10b981' }} />
              <span>Inflow (Receipts)</span>
            </div>
            <div className={styles.chartLegendItem}>
              <span className={styles.chartLegendSwatch} style={{ background: '#f43f5e' }} />
              <span>Outflow (Issues)</span>
            </div>
          </div>
        </div>

        {/* 8-Week High Level KPI Summary Bar */}
        <div className={styles.trendSummaryGrid}>
          <div className={styles.trendSummaryCard}>
            <span className={styles.trendSummaryLabel}>8-Week Total Inflow</span>
            <div className={styles.trendSummaryValue} style={{ color: '#34d399' }}>
              <ArrowDownRight size={18} />
              {trends?.summary?.totalReceipts?.toLocaleString() ?? 0}
            </div>
            <span className={styles.trendSummarySub}>Goods Received</span>
          </div>

          <div className={styles.trendSummaryCard}>
            <span className={styles.trendSummaryLabel}>8-Week Total Outflow</span>
            <div className={styles.trendSummaryValue} style={{ color: '#f87171' }}>
              <ArrowUpRight size={18} />
              {trends?.summary?.totalIssues?.toLocaleString() ?? 0}
            </div>
            <span className={styles.trendSummarySub}>Goods Dispatched / Issued</span>
          </div>

          <div className={styles.trendSummaryCard}>
            <span className={styles.trendSummaryLabel}>8-Week Net Inventory Delta</span>
            <div
              className={styles.trendSummaryValue}
              style={{
                color: (trends?.summary?.netDelta ?? 0) >= 0 ? '#34d399' : '#f87171',
              }}
            >
              {(trends?.summary?.netDelta ?? 0) >= 0 ? (
                <TrendingUp size={18} />
              ) : (
                <TrendingDown size={18} />
              )}
              {(trends?.summary?.netDelta ?? 0) >= 0 ? '+' : ''}
              {trends?.summary?.netDelta?.toLocaleString() ?? 0}
            </div>
            <span className={styles.trendSummarySub}>Inflow minus Outflow</span>
          </div>

          <div className={styles.trendSummaryCard}>
            <span className={styles.trendSummaryLabel}>Turnover Velocity</span>
            <div className={styles.trendSummaryValue} style={{ color: '#a78bfa' }}>
              <Layers size={18} />
              {trends?.trends?.reduce((sum, t) => sum + t.totalVolume, 0).toLocaleString() ?? 0}
            </div>
            <span className={styles.trendSummarySub}>Total Volume Handled</span>
          </div>
        </div>

        {/* SVG Time-Series Chart */}
        <div className={styles.chartContainer}>
          <svg className={styles.chartSvg} viewBox="0 0 800 240" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Gradients for bars */}
              <linearGradient id="receiptGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="issueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Scale */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = chartBottom - ratio * chartHeight;
              const val = Math.round(ratio * maxTrendVolume);
              return (
                <g key={ratio}>
                  <line
                    x1={chartLeft}
                    y1={y}
                    x2={chartLeft + chartWidth}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeDasharray={ratio === 0 ? '0' : '4 4'}
                  />
                  <text
                    x={chartLeft - 10}
                    y={y + 4}
                    fill="rgba(255, 255, 255, 0.35)"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="JetBrains Mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Render 8 Weekly Columns */}
            {trends?.trends?.map((t, idx) => {
              const colSlotWidth = chartWidth / trends.trends.length; // 90px
              const slotX = chartLeft + idx * colSlotWidth;
              const isSelected = hoveredWeekIndex === idx;

              // Bar dimensions
              const receiptHeight = Math.max(0, (t.receipts / maxTrendVolume) * chartHeight);
              const issueHeight = Math.max(0, (t.issues / maxTrendVolume) * chartHeight);
              const barWidth = 22;

              const receiptX = slotX + (colSlotWidth / 2) - barWidth - 3;
              const receiptY = chartBottom - receiptHeight;

              const issueX = slotX + (colSlotWidth / 2) + 3;
              const issueY = chartBottom - issueHeight;

              return (
                <g
                  key={t.weekIndex}
                  cursor="pointer"
                  onMouseEnter={() => setHoveredWeekIndex(idx)}
                  onClick={() => setHoveredWeekIndex(idx)}
                >
                  {/* Column Highlight Background */}
                  {isSelected && (
                    <rect
                      x={slotX + 4}
                      y={chartTop - 10}
                      width={colSlotWidth - 8}
                      height={chartHeight + 20}
                      fill="rgba(99, 102, 241, 0.12)"
                      rx="8"
                    />
                  )}

                  {/* Receipts Bar */}
                  <rect
                    x={receiptX}
                    y={receiptY}
                    width={barWidth}
                    height={Math.max(2, receiptHeight)}
                    fill="url(#receiptGradient)"
                    rx="4"
                    opacity={isSelected ? 1 : 0.85}
                  />

                  {/* Issues Bar */}
                  <rect
                    x={issueX}
                    y={issueY}
                    width={barWidth}
                    height={Math.max(2, issueHeight)}
                    fill="url(#issueGradient)"
                    rx="4"
                    opacity={isSelected ? 1 : 0.85}
                  />

                  {/* Value Labels Above Bars if Hovered */}
                  {isSelected && (
                    <>
                      {t.receipts > 0 && (
                        <text
                          x={receiptX + barWidth / 2}
                          y={receiptY - 6}
                          fill="#34d399"
                          fontSize="10"
                          fontWeight="700"
                          textAnchor="middle"
                          fontFamily="JetBrains Mono"
                        >
                          {t.receipts}
                        </text>
                      )}
                      {t.issues > 0 && (
                        <text
                          x={issueX + barWidth / 2}
                          y={issueY - 6}
                          fill="#f87171"
                          fontSize="10"
                          fontWeight="700"
                          textAnchor="middle"
                          fontFamily="JetBrains Mono"
                        >
                          {t.issues}
                        </text>
                      )}
                    </>
                  )}

                  {/* X-Axis Week Label */}
                  <text
                    x={slotX + colSlotWidth / 2}
                    y={chartBottom + 18}
                    fill={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'}
                    fontSize="11"
                    fontWeight={isSelected ? '700' : '500'}
                    textAnchor="middle"
                  >
                    {t.shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Interactive Week Inspection Box */}
        {selectedWeek && (
          <div className={styles.weekInspectionBox}>
            <div className={styles.weekInspectionTitle}>
              <Calendar size={16} />
              <span>Inspection: {selectedWeek.label} ({selectedWeek.shortLabel})</span>
            </div>

            <div className={styles.weekInspectionMetrics}>
              <div className={styles.weekInspectionMetric} style={{ color: '#34d399' }}>
                <span>Inflow (Receipts):</span>
                <strong>+{selectedWeek.receipts.toLocaleString()} units</strong>
              </div>
              <div className={styles.weekInspectionMetric} style={{ color: '#f87171' }}>
                <span>Outflow (Issues):</span>
                <strong>-{selectedWeek.issues.toLocaleString()} units</strong>
              </div>
              <div
                className={styles.weekInspectionMetric}
                style={{
                  color: selectedWeek.netChange >= 0 ? '#34d399' : '#f87171',
                }}
              >
                <span>Net Delta:</span>
                <strong>
                  {selectedWeek.netChange >= 0 ? '+' : ''}
                  {selectedWeek.netChange.toLocaleString()} units
                </strong>
              </div>
              <div className={styles.weekInspectionMetric} style={{ color: 'var(--text-secondary)' }}>
                <span>Total Movement Volume:</span>
                <strong>{selectedWeek.totalVolume.toLocaleString()} units</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
