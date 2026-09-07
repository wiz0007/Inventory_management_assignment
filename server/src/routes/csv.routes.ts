import { Router, Response } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Role, MovementType, TimelineEventType } from '@prisma/client';
import { parseCSV, formatCSV } from '../utils/csv';

export const csvRouter = Router();

// Require authentication for all CSV routes
csvRouter.use(requireAuth);

/**
 * Helper to extract raw CSV string from request body
 */
function extractCSVContent(req: AuthenticatedRequest): string {
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (req.body && typeof req.body.csv === 'string') {
    return req.body.csv;
  }
  if (req.body && typeof req.body.content === 'string') {
    return req.body.content;
  }
  return '';
}

/**
 * Case-insensitive row key helper
 */
function getRowValue(row: Record<string, string>, ...patterns: RegExp[]): string {
  for (const pattern of patterns) {
    for (const key of Object.keys(row)) {
      if (pattern.test(key.trim())) {
        return row[key]?.trim() || '';
      }
    }
  }
  return '';
}

/**
 * POST /api/csv/import-items
 * Bulk import items with partial success and granular per-row error reporting (Requirement 7)
 * Restricted to: MANAGER
 */
csvRouter.post('/import-items', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const csvContent = extractCSVContent(req);
    if (!csvContent) {
      return res.status(400).json({ error: 'No CSV content provided. Please upload or provide CSV text.' });
    }

    const { headers, rows } = parseCSV(csvContent);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no data rows.' });
    }

    // Cache existing categories to avoid redundant queries
    const existingCategories = await prisma.category.findMany();
    const categoryMap = new Map<string, string>(); // name.toLowerCase() -> id
    for (const cat of existingCategories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    }

    // Cache existing SKUs to catch collisions
    const existingItems = await prisma.item.findMany({ select: { sku: true } });
    const existingSkus = new Set<string>(existingItems.map((i) => i.sku.toUpperCase()));
    const batchSkus = new Set<string>();

    const errors: { row: number; sku?: string; name?: string; error: string }[] = [];
    const validItemsToCreate: {
      sku: string;
      name: string;
      description: string | null;
      uom: string;
      reorderLevel: number;
      categoryId: string;
    }[] = [];

    // First pass: Validate each row independently
    for (let idx = 0; idx < rows.length; idx++) {
      const rowNum = idx + 2; // Row 1 is header, data starts at Row 2
      const row = rows[idx];

      const sku = getRowValue(row, /^sku$/i);
      const name = getRowValue(row, /^(name|item_name|item name)$/i);
      const description = getRowValue(row, /^description$/i);
      const categoryName = getRowValue(row, /^(category|category_name|category name)$/i);
      const uom = getRowValue(row, /^(uom|unit|unit of measure)$/i) || 'units';
      const reorderLevelStr = getRowValue(row, /^(reorderlevel|reorder_level|reorder level|reorder)$/i);

      // Validation 1: SKU
      if (!sku) {
        errors.push({ row: rowNum, name, error: 'SKU is required and cannot be blank' });
        continue;
      }
      if (sku.length < 2 || sku.length > 30) {
        errors.push({ row: rowNum, sku, name, error: 'SKU length must be between 2 and 30 characters' });
        continue;
      }
      if (!/^[A-Za-z0-9-_]+$/.test(sku)) {
        errors.push({ row: rowNum, sku, name, error: 'SKU may only contain letters, numbers, hyphens, and underscores' });
        continue;
      }
      const upperSku = sku.toUpperCase();
      if (existingSkus.has(upperSku)) {
        errors.push({ row: rowNum, sku, name, error: `SKU '${sku}' already exists in inventory` });
        continue;
      }
      if (batchSkus.has(upperSku)) {
        errors.push({ row: rowNum, sku, name, error: `Duplicate SKU '${sku}' found within the same CSV batch` });
        continue;
      }

      // Validation 2: Name
      if (!name) {
        errors.push({ row: rowNum, sku, error: 'Item name is required and cannot be blank' });
        continue;
      }
      if (name.length < 2 || name.length > 100) {
        errors.push({ row: rowNum, sku, name, error: 'Item name length must be between 2 and 100 characters' });
        continue;
      }

      // Validation 3: Category
      if (!categoryName) {
        errors.push({ row: rowNum, sku, name, error: 'Category name is required' });
        continue;
      }

      // Validation 4: Reorder Level
      let reorderLevel = 10;
      if (reorderLevelStr) {
        const parsed = parseInt(reorderLevelStr, 10);
        if (isNaN(parsed) || parsed < 0) {
          errors.push({ row: rowNum, sku, name, error: 'Reorder level must be a non-negative integer' });
          continue;
        }
        reorderLevel = parsed;
      }

      // Resolve Category ID (create if absent)
      let categoryId = categoryMap.get(categoryName.toLowerCase());
      if (!categoryId) {
        const newCat = await prisma.category.create({
          data: { name: categoryName },
        });
        categoryId = newCat.id;
        categoryMap.set(categoryName.toLowerCase(), newCat.id);
      }

      batchSkus.add(upperSku);
      validItemsToCreate.push({
        sku,
        name,
        description: description || null,
        uom: uom || 'units',
        reorderLevel,
        categoryId,
      });
    }

    // Second pass: Persist valid items and log initial timeline events
    let successCount = 0;
    for (const validItem of validItemsToCreate) {
      try {
        const createdItem = await prisma.item.create({
          data: validItem,
        });

        await prisma.itemTimeline.create({
          data: {
            itemId: createdItem.id,
            userId: req.user!.id,
            eventType: TimelineEventType.CREATED,
            newValue: `Bulk imported via CSV with SKU ${createdItem.sku}`,
          },
        });

        successCount++;
      } catch (err: any) {
        errors.push({
          row: 0,
          sku: validItem.sku,
          name: validItem.name,
          error: err.message || 'Database error creating item',
        });
      }
    }

    res.json({
      totalRows: rows.length,
      successCount,
      failureCount: errors.length,
      errors,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error during item CSV import' });
  }
});

/**
 * POST /api/csv/import-receipts
 * Bulk import stock receipts into the append-only ledger with partial success (Requirement 7)
 * Restricted to: STAFF & MANAGER (Staff scoped to assigned locations)
 */
csvRouter.post('/import-receipts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const csvContent = extractCSVContent(req);
    if (!csvContent) {
      return res.status(400).json({ error: 'No CSV content provided. Please upload or provide CSV text.' });
    }

    const { rows } = parseCSV(csvContent);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no data rows.' });
    }

    // Cache active items by SKU
    const activeItems = await prisma.item.findMany({
      where: { isArchived: false },
      select: { id: true, sku: true, name: true, uom: true },
    });
    const itemMap = new Map<string, typeof activeItems[0]>();
    for (const item of activeItems) {
      itemMap.set(item.sku.toUpperCase(), item);
    }

    // Cache active locations by Code and Name
    const activeLocations = await prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });
    const locationMap = new Map<string, typeof activeLocations[0]>();
    for (const loc of activeLocations) {
      locationMap.set(loc.code.toUpperCase(), loc);
      locationMap.set(loc.name.toLowerCase(), loc);
    }

    // Determine user location permissions
    let allowedLocationIds: Set<string> | null = null;
    if (req.user!.role === Role.STAFF) {
      const userAssignments = await prisma.userLocation.findMany({
        where: { userId: req.user!.id },
        select: { locationId: true },
      });
      allowedLocationIds = new Set<string>(userAssignments.map((ua) => ua.locationId));
    }

    const errors: { row: number; sku?: string; locationCode?: string; error: string }[] = [];
    const validReceiptsToInsert: {
      itemId: string;
      destinationLocationId: string;
      quantity: number;
      reason: string;
      rowNum: number;
    }[] = [];

    // Validation pass
    for (let idx = 0; idx < rows.length; idx++) {
      const rowNum = idx + 2;
      const row = rows[idx];

      const sku = getRowValue(row, /^sku$/i);
      const locationCode = getRowValue(row, /^(location|locationcode|location_code|location code|warehouse)$/i);
      const quantityStr = getRowValue(row, /^(quantity|qty)$/i);
      const notes = getRowValue(row, /^(notes|note|reason|comment)$/i) || 'Bulk CSV Inbound Receipt';

      // 1. SKU validation
      if (!sku) {
        errors.push({ row: rowNum, locationCode, error: 'SKU is required' });
        continue;
      }
      const item = itemMap.get(sku.toUpperCase());
      if (!item) {
        errors.push({ row: rowNum, sku, locationCode, error: `Item with SKU '${sku}' not found or is archived` });
        continue;
      }

      // 2. Location validation
      if (!locationCode) {
        errors.push({ row: rowNum, sku, error: 'Location code is required' });
        continue;
      }
      const location = locationMap.get(locationCode.toUpperCase()) || locationMap.get(locationCode.toLowerCase());
      if (!location) {
        errors.push({ row: rowNum, sku, locationCode, error: `Active location '${locationCode}' not found` });
        continue;
      }

      // 3. Staff RBAC validation
      if (allowedLocationIds && !allowedLocationIds.has(location.id)) {
        errors.push({
          row: rowNum,
          sku,
          locationCode,
          error: `Access Denied: Staff member is not assigned to location '${location.code}'`,
        });
        continue;
      }

      // 4. Quantity validation
      if (!quantityStr) {
        errors.push({ row: rowNum, sku, locationCode, error: 'Quantity is required' });
        continue;
      }
      const quantity = parseInt(quantityStr, 10);
      if (isNaN(quantity) || quantity <= 0) {
        errors.push({ row: rowNum, sku, locationCode, error: 'Quantity must be a positive integer greater than zero' });
        continue;
      }

      validReceiptsToInsert.push({
        itemId: item.id,
        destinationLocationId: location.id,
        quantity,
        reason: notes,
        rowNum,
      });
    }

    // Persistence pass
    let successCount = 0;
    for (const receipt of validReceiptsToInsert) {
      try {
        await prisma.stockMovement.create({
          data: {
            itemId: receipt.itemId,
            type: MovementType.RECEIPT,
            quantity: receipt.quantity,
            destinationLocationId: receipt.destinationLocationId,
            reason: receipt.reason,
            userId: req.user!.id,
          },
        });
        successCount++;
      } catch (err: any) {
        errors.push({
          row: receipt.rowNum,
          error: err.message || 'Database error creating stock receipt movement',
        });
      }
    }

    res.json({
      totalRows: rows.length,
      successCount,
      failureCount: errors.length,
      errors,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error during stock receipt CSV import' });
  }
});

/**
 * GET /api/csv/export-stock
 * Live export of current stock position by location across all items as a CSV file (Requirement 7)
 * Accessible by: ALL AUTHENTICATED ROLES
 */
csvRouter.get('/export-stock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Dynamic derivation of stock position across active items and locations
    const stockRows: any[] = await prisma.$queryRaw`
      SELECT 
        i.sku,
        i.name as "itemName",
        c.name as "categoryName",
        i.uom,
        i."reorderLevel",
        l.code as "locationCode",
        l.name as "locationName",
        COALESCE(
          SUM(CASE WHEN sm."destinationLocationId" = l.id THEN sm.quantity ELSE 0 END) -
          SUM(CASE WHEN sm."sourceLocationId" = l.id THEN sm.quantity ELSE 0 END),
          0
        )::int as "onHand"
      FROM items i
      JOIN categories c ON i."categoryId" = c.id
      CROSS JOIN locations l
      LEFT JOIN stock_movements sm ON sm."itemId" = i.id AND (sm."destinationLocationId" = l.id OR sm."sourceLocationId" = l.id)
      WHERE i."isArchived" = false AND l."isActive" = true
      GROUP BY i.id, i.sku, i.name, c.name, i.uom, i."reorderLevel", l.id, l.code, l.name
      ORDER BY i.sku ASC, l.code ASC;
    `;

    const formattedData = stockRows.map((row) => ({
      sku: row.sku,
      itemName: row.itemName,
      categoryName: row.categoryName,
      locationCode: row.locationCode,
      locationName: row.locationName,
      onHand: row.onHand,
      uom: row.uom,
      reorderLevel: row.reorderLevel,
      status: row.onHand <= row.reorderLevel ? 'AT_OR_BELOW_REORDER' : 'OPTIMAL',
    }));

    const csvContent = formatCSV(
      [
        { key: 'sku', label: 'SKU' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'categoryName', label: 'Category' },
        { key: 'locationCode', label: 'Location Code' },
        { key: 'locationName', label: 'Location Name' },
        { key: 'onHand', label: 'On Hand Quantity' },
        { key: 'uom', label: 'Unit of Measure' },
        { key: 'reorderLevel', label: 'Reorder Level' },
        { key: 'status', label: 'Status' },
      ],
      formattedData
    );

    const filename = `stock_position_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error exporting stock position' });
  }
});
