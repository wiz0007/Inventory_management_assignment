import { Router, Response } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

interface EvaluatedAlertItem {
  id: string;
  sku: string;
  name: string;
  uom: string;
  reorderLevel: number;
  totalOnHand: number;
  deficit: number;
  category: {
    id: string;
    name: string;
  };
  isDismissed: boolean;
  isReArmed: boolean;
  reArmedAt?: Date | null;
  dismissedAt?: Date | null;
  dismissedByName?: string | null;
  dismissal?: {
    dismissedAt: string;
    quantityAtDismissal: number;
    user: {
      name: string;
      email: string;
    };
  } | null;
}

/**
 * Core Re-Arming State Machine Engine (Requirement 10)
 * Evaluates all active items at or below reorder level across all locations.
 * If dismissed, checks if the running stock balance crossed > reorderLevel after dismissal.
 * If it did, the alert automatically re-arms and resurfaces.
 */
async function evaluateLowStockAlerts(includeDismissed = false) {
  // Step 1: Calculate company-wide derived on-hand balance for all active items
  const itemsWithStock: any[] = await prisma.$queryRaw`
    WITH stock_balances AS (
      SELECT 
        sm."itemId",
        SUM(CASE WHEN sm."destinationLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) -
        SUM(CASE WHEN sm."sourceLocationId" IS NOT NULL THEN sm.quantity ELSE 0 END) AS "onHand"
      FROM stock_movements sm
      GROUP BY sm."itemId"
    )
    SELECT 
      i.id,
      i.sku,
      i.name,
      i.uom,
      i."reorderLevel",
      c.id as "categoryId",
      c.name as "categoryName",
      COALESCE(sb."onHand", 0)::int as "totalOnHand"
    FROM items i
    JOIN categories c ON i."categoryId" = c.id
    LEFT JOIN stock_balances sb ON sb."itemId" = i.id
    WHERE i."isArchived" = false AND COALESCE(sb."onHand", 0) <= i."reorderLevel"
    ORDER BY (i."reorderLevel" - COALESCE(sb."onHand", 0)) DESC, i.name ASC;
  `;

  if (itemsWithStock.length === 0) {
    return {
      count: 0,
      totalLowStock: 0,
      dismissedCount: 0,
      alerts: [] as EvaluatedAlertItem[],
    };
  }

  const itemIds = itemsWithStock.map((i) => i.id);

  // Step 2: Fetch latest dismissals for these low stock items
  const dismissals = await prisma.lowStockDismissal.findMany({
    where: { itemId: { in: itemIds } },
    include: { user: { select: { name: true } } },
    orderBy: { dismissedAt: 'desc' },
  });

  const latestDismissalMap = new Map<string, typeof dismissals[0]>();
  for (const dis of dismissals) {
    if (!latestDismissalMap.has(dis.itemId)) {
      latestDismissalMap.set(dis.itemId, dis);
    }
  }

  // Step 3: For dismissed items, query subsequent movements to evaluate the Re-Arming State Machine
  const dismissedItemIds = Array.from(latestDismissalMap.keys());
  const postDismissalMovements = dismissedItemIds.length > 0
    ? await prisma.stockMovement.findMany({
        where: { itemId: { in: dismissedItemIds } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          itemId: true,
          type: true,
          quantity: true,
          sourceLocationId: true,
          destinationLocationId: true,
          createdAt: true,
        },
      })
    : [];

  // Group movements by itemId
  const movementsByItem = new Map<string, typeof postDismissalMovements>();
  for (const m of postDismissalMovements) {
    const list = movementsByItem.get(m.itemId) || [];
    list.push(m);
    movementsByItem.set(m.itemId, list);
  }

  const evaluatedAlerts: EvaluatedAlertItem[] = [];
  let activeCount = 0;
  let dismissedCount = 0;

  for (const item of itemsWithStock) {
    const deficit = item.reorderLevel - item.totalOnHand;
    const dismissal = latestDismissalMap.get(item.id);

    let isDismissed = false;
    let isReArmed = false;
    let reArmedAt: Date | null = null;
    let dismissedAt: Date | null = null;
    let dismissedByName: string | null = null;

    if (dismissal) {
      dismissedAt = dismissal.dismissedAt;
      dismissedByName = dismissal.user?.name || 'Manager';

      // State Machine Evaluation:
      // Did stock cross > reorderLevel after dismissal.dismissedAt?
      const movementsAfter = (movementsByItem.get(item.id) || []).filter(
        (m) => m.createdAt > dismissal.dismissedAt
      );

      let runningBalance = dismissal.quantityAtDismissal;
      let hasRecoveredAboveReorder = false;

      for (const m of movementsAfter) {
        if (m.type === 'RECEIPT') {
          runningBalance += m.quantity;
        } else if (m.type === 'ISSUE') {
          runningBalance -= m.quantity;
        } else if (m.type === 'ADJUSTMENT') {
          if (m.destinationLocationId) runningBalance += m.quantity;
          if (m.sourceLocationId) runningBalance -= m.quantity;
        }

        if (runningBalance > item.reorderLevel) {
          hasRecoveredAboveReorder = true;
          reArmedAt = m.createdAt;
        }
      }

      if (hasRecoveredAboveReorder) {
        // State Machine: RE-ARMED
        // Stock rose above threshold, then fell back to <= reorderLevel -> Alert triggers again!
        isDismissed = false;
        isReArmed = true;
        activeCount++;
      } else {
        // Still continuously at or below reorder level -> Dismissal remains valid
        isDismissed = true;
        dismissedCount++;
      }
    } else {
      // No dismissal on record -> Active alert
      isDismissed = false;
      isReArmed = false;
      activeCount++;
    }

    const alertItem: EvaluatedAlertItem = {
      id: item.id,
      sku: item.sku,
      name: item.name,
      uom: item.uom,
      reorderLevel: item.reorderLevel,
      totalOnHand: item.totalOnHand,
      deficit,
      category: {
        id: item.categoryId,
        name: item.categoryName,
      },
      isDismissed,
      isReArmed,
      reArmedAt,
      dismissedAt,
      dismissedByName,
      dismissal: dismissedAt ? {
        dismissedAt: dismissedAt.toISOString(),
        quantityAtDismissal: dismissal?.quantityAtDismissal ?? item.totalOnHand,
        user: {
          name: dismissedByName || 'Manager',
          email: '',
        },
      } : null,
    };

    if (includeDismissed || !isDismissed) {
      evaluatedAlerts.push(alertItem);
    }
  }

  return {
    count: activeCount,
    totalLowStock: itemsWithStock.length,
    dismissedCount,
    alerts: evaluatedAlerts,
    items: evaluatedAlerts,
  };
}

/**
 * GET /api/alerts/low-stock
 * Retrieve all items at or below reorder level with dismissal state machine evaluation
 * Accessible by: ALL AUTHENTICATED ROLES
 */
alertsRouter.get('/low-stock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const includeDismissed = req.query.includeDismissed === 'true';
    const result = await evaluateLowStockAlerts(includeDismissed);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error evaluating low-stock alerts' });
  }
});

/**
 * GET /api/alerts/count
 * Fast endpoint for global navigation badge counter (Requirement 10)
 * Accessible by: ALL AUTHENTICATED ROLES
 */
alertsRouter.get('/count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await evaluateLowStockAlerts(false);
    res.json({ count: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error retrieving alert count' });
  }
});

/**
 * POST /api/alerts/dismiss/:itemId
 * Dismiss a low-stock alert for an item (Requirement 10)
 * Restricted to: MANAGER
 */
alertsRouter.post('/dismiss/:itemId', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    // Verify item exists and is active
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (item.isArchived) {
      return res.status(400).json({ error: 'Cannot dismiss alerts for archived items' });
    }

    // Compute current derived company-wide on-hand balance
    const stockMovements = await prisma.stockMovement.findMany({
      where: { itemId },
      select: {
        type: true,
        quantity: true,
        sourceLocationId: true,
        destinationLocationId: true,
      },
    });

    let currentOnHand = 0;
    for (const sm of stockMovements) {
      if (sm.destinationLocationId) currentOnHand += sm.quantity;
      if (sm.sourceLocationId) currentOnHand -= sm.quantity;
    }

    if (currentOnHand > item.reorderLevel) {
      return res.status(400).json({
        error: `Item is not currently low on stock (${currentOnHand} on hand > ${item.reorderLevel} reorder level)`,
      });
    }

    // Record dismissal
    const dismissal = await prisma.lowStockDismissal.create({
      data: {
        itemId,
        dismissedBy: req.user!.id,
        quantityAtDismissal: currentOnHand,
      },
    });

    res.json({
      success: true,
      message: `Low-stock alert dismissed for '${item.name}' until stock rises above ${item.reorderLevel} and drops again.`,
      dismissal,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error dismissing alert' });
  }
});
