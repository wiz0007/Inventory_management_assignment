import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const reorderSuggestionsRouter = Router();

reorderSuggestionsRouter.use(requireAuth);

export interface ReorderSuggestion {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  uom: string;
  reorderLevel: number;
  totalOnHand: number;
  deficit: number;
  targetStock: number;
  recommendedOrderQuantity: number;
  urgency: 'CRITICAL' | 'HIGH' | 'NORMAL';
  suggestedLocation: {
    id: string;
    code: string;
    name: string;
  } | null;
  locationBreakdown: {
    locationId: string;
    code: string;
    name: string;
    onHand: number;
  }[];
}

async function computeReorderSuggestions(): Promise<ReorderSuggestion[]> {
  // Step 1: Query all active items that are at or below reorder level
  const rawItems: any[] = await prisma.$queryRaw`
    WITH stock_balances AS (
      SELECT 
        sm."itemId",
        SUM(CASE WHEN sm."destinationLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) -
        SUM(CASE WHEN sm."sourceLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) AS "totalOnHand"
      FROM stock_movements sm
      GROUP BY sm."itemId"
    )
    SELECT 
      i.id,
      i.sku,
      i.name,
      i.uom,
      i."reorderLevel",
      c.name as "categoryName",
      COALESCE(sb."totalOnHand", 0)::int as "totalOnHand"
    FROM items i
    JOIN categories c ON i."categoryId" = c.id
    LEFT JOIN stock_balances sb ON sb."itemId" = i.id
    WHERE i."isArchived" = false AND COALESCE(sb."totalOnHand", 0) <= i."reorderLevel"
    ORDER BY (i."reorderLevel" - COALESCE(sb."totalOnHand", 0)) DESC, i.name ASC;
  `;

  if (rawItems.length === 0) {
    return [];
  }

  // Step 2: Fetch all active locations
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  });

  const mainLocation = locations.find((l) => l.code === 'WH-MAIN') || locations[0] || null;

  // Step 3: Fetch per-location stock for these low-stock items
  const itemIds = rawItems.map((r) => r.id);
  const locationStocksRaw: any[] = await prisma.$queryRaw`
    SELECT 
      sm."itemId",
      l.id as "locationId",
      l.code as "locationCode",
      l.name as "locationName",
      SUM(CASE WHEN sm."destinationLocationId" = l.id THEN sm.quantity ELSE 0 END) -
      SUM(CASE WHEN sm."sourceLocationId" = l.id THEN sm.quantity ELSE 0 END) AS "onHand"
    FROM stock_movements sm
    JOIN locations l ON (sm."destinationLocationId" = l.id OR sm."sourceLocationId" = l.id)
    WHERE sm."itemId" IN (${Prisma.join(itemIds)}) AND l."isActive" = true
    GROUP BY sm."itemId", l.id, l.code, l.name;
  `;

  // Build a lookup: itemId -> locationId -> onHand
  const stockByItemAndLoc = new Map<string, Map<string, number>>();
  for (const row of locationStocksRaw) {
    if (!stockByItemAndLoc.has(row.itemId)) {
      stockByItemAndLoc.set(row.itemId, new Map());
    }
    stockByItemAndLoc.get(row.itemId)!.set(row.locationId, Number(row.onHand || 0));
  }

  return rawItems.map((item) => {
    const totalOnHand = Number(item.totalOnHand);
    const reorderLevel = Number(item.reorderLevel);
    const deficit = Math.max(0, reorderLevel - totalOnHand);
    // Target par stock is 2x the reorder level to buffer a full ordering cycle
    const targetStock = reorderLevel * 2;
    const recommendedOrderQuantity = Math.max(0, targetStock - totalOnHand);

    let urgency: 'CRITICAL' | 'HIGH' | 'NORMAL' = 'NORMAL';
    if (totalOnHand <= 0) {
      urgency = 'CRITICAL';
    } else if (totalOnHand <= Math.floor(reorderLevel * 0.5)) {
      urgency = 'HIGH';
    }

    const itemLocMap = stockByItemAndLoc.get(item.id);
    const locationBreakdown = locations.map((loc) => ({
      locationId: loc.id,
      code: loc.code,
      name: loc.name,
      onHand: itemLocMap ? itemLocMap.get(loc.id) || 0 : 0,
    }));

    // Choose suggested receipt destination: warehouse with lowest onHand, or default WH-MAIN
    let suggestedLocation = mainLocation;
    if (locationBreakdown.length > 0) {
      const sortedByStock = [...locationBreakdown].sort((a, b) => a.onHand - b.onHand);
      const lowestLoc = locations.find((l) => l.id === sortedByStock[0].locationId);
      if (lowestLoc) {
        suggestedLocation = lowestLoc;
      }
    }

    return {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      category: item.categoryName,
      uom: item.uom,
      reorderLevel,
      totalOnHand,
      deficit,
      targetStock,
      recommendedOrderQuantity,
      urgency,
      suggestedLocation: suggestedLocation
        ? { id: suggestedLocation.id, code: suggestedLocation.code, name: suggestedLocation.name }
        : null,
      locationBreakdown,
    };
  });
}

/**
 * GET /api/reorder-suggestions
 * Evaluates low-stock items and calculates recommended order quantities (ROQ).
 */
reorderSuggestionsRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const suggestions = await computeReorderSuggestions();

    const summary = {
      totalItemsNeedingReorder: suggestions.length,
      criticalCount: suggestions.filter((s) => s.urgency === 'CRITICAL').length,
      highCount: suggestions.filter((s) => s.urgency === 'HIGH').length,
      normalCount: suggestions.filter((s) => s.urgency === 'NORMAL').length,
      totalUnitsToOrder: suggestions.reduce((acc, s) => acc + s.recommendedOrderQuantity, 0),
    };

    res.json({
      summary,
      suggestions,
    });
  } catch (error) {
    console.error('Failed to compute reorder suggestions:', error);
    res.status(500).json({ error: 'Internal server error calculating reorder suggestions' });
  }
});

/**
 * GET /api/reorder-suggestions/export-csv
 * Exports calculated replenishment suggestions as a vendor purchase order requisition CSV.
 */
reorderSuggestionsRouter.get('/export-csv', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const suggestions = await computeReorderSuggestions();

    const csvHeaders = [
      'SKU',
      'Item Name',
      'Category',
      'Unit of Measure',
      'Current On-Hand',
      'Reorder Level',
      'Target Par Stock',
      'Recommended Order Qty',
      'Urgency',
      'Suggested Destination Code',
      'Suggested Destination Name',
    ];

    const csvRows = suggestions.map((s) => [
      `"${s.sku.replace(/"/g, '""')}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.category.replace(/"/g, '""')}"`,
      `"${s.uom.replace(/"/g, '""')}"`,
      s.totalOnHand,
      s.reorderLevel,
      s.targetStock,
      s.recommendedOrderQuantity,
      s.urgency,
      `"${(s.suggestedLocation?.code || '').replace(/"/g, '""')}"`,
      `"${(s.suggestedLocation?.name || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n');

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="po_reorder_requisitions_${dateStr}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Failed to export reorder suggestions CSV:', error);
    res.status(500).json({ error: 'Internal server error exporting reorder suggestions CSV' });
  }
});
