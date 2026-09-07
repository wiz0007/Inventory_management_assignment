import { Router, Response } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

/**
 * GET /api/dashboard/kpis
 * Returns the 4 headline KPI metrics (Requirement 8):
 * 1. Active Items: Non-archived catalog items
 * 2. Items <= Reorder Level: Items at or below safety threshold across all locations
 * 3. Movements Today: Movements recorded since UTC 00:00:00 today
 * 4. Distinct Items Moved This Week: Distinct items with movements in the last 7 days
 */
dashboardRouter.get('/kpis', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Active Items
    const activeItemsPromise = prisma.item.count({
      where: { isArchived: false },
    });

    // 2. Items <= Reorder Level (Derived Company-wide On-Hand Balance)
    const lowStockPromise = prisma.$queryRaw<[{ count: number }]>`
      WITH stock_balances AS (
        SELECT 
          sm."itemId",
          SUM(CASE WHEN sm."destinationLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) -
          SUM(CASE WHEN sm."sourceLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) AS "onHand"
        FROM stock_movements sm
        GROUP BY sm."itemId"
      )
      SELECT COUNT(*)::int as count
      FROM items i
      LEFT JOIN stock_balances sb ON sb."itemId" = i.id
      WHERE i."isArchived" = false AND COALESCE(sb."onHand", 0) <= i."reorderLevel";
    `;

    // 3. Movements Today (UTC 00:00:00 to now)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const movementsTodayPromise = prisma.stockMovement.count({
      where: {
        createdAt: { gte: startOfToday },
      },
    });

    // 4. Distinct Items Moved in the Last 7 Days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const distinctItemsPromise = prisma.$queryRaw<[{ count: number }]>`
      SELECT COUNT(DISTINCT "itemId")::int as count
      FROM stock_movements
      WHERE "createdAt" >= ${sevenDaysAgo};
    `;

    // 5. Total Units in System
    const totalUnitsPromise = prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(
        SUM(CASE WHEN sm."destinationLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) -
        SUM(CASE WHEN sm."sourceLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END),
        0
      )::int as total
      FROM stock_movements sm;
    `;

    const [
      activeItems,
      lowStockResult,
      movementsToday,
      distinctItemsResult,
      totalUnitsResult,
    ] = await Promise.all([
      activeItemsPromise,
      lowStockPromise,
      movementsTodayPromise,
      distinctItemsPromise,
      totalUnitsPromise,
    ]);

    const lowStockItems = Number(lowStockResult[0]?.count ?? 0);
    const distinctItemsMovedThisWeek = Number(distinctItemsResult[0]?.count ?? 0);
    const totalInventoryUnits = Math.max(0, Number(totalUnitsResult[0]?.total ?? 0));

    res.json({
      activeItems,
      lowStockItems,
      movementsToday,
      distinctItemsMovedThisWeek,
      totalInventoryUnits,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to calculate dashboard KPIs' });
  }
});

/**
 * GET /api/dashboard/distribution
 * Returns stock distribution breakdown by:
 * 1. Category (Donut/Pie visualization data)
 * 2. Warehouse Location (Bar visualization data)
 */
dashboardRouter.get('/distribution', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Stock by Category
    const categoryDistribution: any[] = await prisma.$queryRaw`
      WITH item_balances AS (
        SELECT 
          sm."itemId",
          SUM(CASE WHEN sm."destinationLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) -
          SUM(CASE WHEN sm."sourceLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) AS "onHand"
        FROM stock_movements sm
        GROUP BY sm."itemId"
      )
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT i.id)::int as "itemCount",
        COALESCE(SUM(GREATEST(ib."onHand", 0)), 0)::int as "totalQuantity"
      FROM categories c
      LEFT JOIN items i ON i."categoryId" = c.id AND i."isArchived" = false
      LEFT JOIN item_balances ib ON ib."itemId" = i.id
      GROUP BY c.id, c.name
      ORDER BY "totalQuantity" DESC, c.name ASC;
    `;

    // Calculate total units across all categories to determine percentages
    const totalCategoryUnits = categoryDistribution.reduce(
      (sum, cat) => sum + Number(cat.totalQuantity || 0),
      0
    );

    const byCategory = categoryDistribution.map((cat, index) => {
      const qty = Number(cat.totalQuantity || 0);
      const percentage = totalCategoryUnits > 0
        ? Number(((qty / totalCategoryUnits) * 100).toFixed(1))
        : 0;

      // Curated vibrant HSL palette for donut segments
      const colorPalette = [
        '#6366f1', // Indigo
        '#06b6d4', // Cyan
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#8b5cf6', // Violet
        '#3b82f6', // Blue
        '#14b8a6', // Teal
      ];

      return {
        id: cat.id,
        name: cat.name,
        itemCount: Number(cat.itemCount || 0),
        totalQuantity: qty,
        percentage,
        color: colorPalette[index % colorPalette.length],
      };
    });

    // 2. Stock by Warehouse Location
    const locationDistribution: any[] = await prisma.$queryRaw`
      SELECT 
        l.id,
        l.name,
        l.code,
        COALESCE(
          SUM(CASE WHEN sm."destinationLocationId" = l.id THEN sm.quantity ELSE 0 END) -
          SUM(CASE WHEN sm."sourceLocationId" = l.id THEN sm.quantity ELSE 0 END),
          0
        )::int as "totalQuantity",
        COUNT(DISTINCT sm."itemId")::int as "distinctItems"
      FROM locations l
      LEFT JOIN stock_movements sm ON sm."destinationLocationId" = l.id OR sm."sourceLocationId" = l.id
      GROUP BY l.id, l.name, l.code
      ORDER BY "totalQuantity" DESC, l.code ASC;
    `;

    const totalLocationUnits = locationDistribution.reduce(
      (sum, loc) => sum + Math.max(0, Number(loc.totalQuantity || 0)),
      0
    );

    const byLocation = locationDistribution.map((loc) => {
      const qty = Math.max(0, Number(loc.totalQuantity || 0));
      const percentage = totalLocationUnits > 0
        ? Number(((qty / totalLocationUnits) * 100).toFixed(1))
        : 0;

      return {
        id: loc.id,
        name: loc.name,
        code: loc.code,
        totalQuantity: qty,
        distinctItems: Number(loc.distinctItems || 0),
        percentage,
      };
    });

    res.json({
      byCategory,
      byLocation,
      totalCategoryUnits,
      totalLocationUnits,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to calculate stock distributions' });
  }
});

/**
 * GET /api/dashboard/movement-trends
 * Returns 8-week movement volume trend grouped by week (Requirement 8):
 * Compares weekly Inflow (RECEIPT) vs. Outflow (ISSUE) with net delta and volume metrics.
 */
dashboardRouter.get('/movement-trends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const numberOfWeeks = 8;
    const weekBuckets: {
      weekIndex: number;
      startDate: Date;
      endDate: Date;
      label: string;
      shortLabel: string;
    }[] = [];

    // Calculate 8 sequential weekly buckets ending today
    // Week 7 is the current week, Week 0 is 7 weeks ago (total 8 weeks)
    for (let w = numberOfWeeks - 1; w >= 0; w--) {
      const endDate = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startDay = startDate.getUTCDate();
      const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endDay = endDate.getUTCDate();

      const label = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
      const shortLabel = `W-${numberOfWeeks - 1 - w}`;

      weekBuckets.push({
        weekIndex: numberOfWeeks - 1 - w,
        startDate,
        endDate,
        label,
        shortLabel: w === 0 ? 'Current' : shortLabel,
      });
    }

    const oldestStartDate = weekBuckets[0].startDate;

    // Query movements within the 8-week window
    const movements = await prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: oldestStartDate,
        },
      },
      select: {
        id: true,
        type: true,
        quantity: true,
        createdAt: true,
      },
    });

    // Bucket movements into the 8 weeks
    const trends = weekBuckets.map((bucket) => {
      let receipts = 0;
      let issues = 0;
      let transfers = 0;
      let adjustments = 0;

      for (const m of movements) {
        const mTime = m.createdAt.getTime();
        if (mTime >= bucket.startDate.getTime() && mTime < bucket.endDate.getTime()) {
          if (m.type === 'RECEIPT') receipts += m.quantity;
          else if (m.type === 'ISSUE') issues += m.quantity;
          else if (m.type === 'TRANSFER') transfers += m.quantity;
          else if (m.type === 'ADJUSTMENT') adjustments += m.quantity;
        }
      }

      const totalVolume = receipts + issues + transfers + adjustments;
      const netChange = receipts - issues;

      return {
        weekIndex: bucket.weekIndex,
        label: bucket.label,
        shortLabel: bucket.shortLabel,
        startDate: bucket.startDate.toISOString(),
        endDate: bucket.endDate.toISOString(),
        receipts,
        issues,
        transfers,
        adjustments,
        totalVolume,
        netChange,
      };
    });

    // Overall summary across the 8 weeks
    const totalReceipts = trends.reduce((acc, t) => acc + t.receipts, 0);
    const totalIssues = trends.reduce((acc, t) => acc + t.issues, 0);
    const netDelta = totalReceipts - totalIssues;

    res.json({
      trends,
      summary: {
        totalReceipts,
        totalIssues,
        netDelta,
        numberOfWeeks,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to aggregate movement trends' });
  }
});
