import { Router, Response } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { MovementType, Role, Prisma } from '@prisma/client';
import { z } from 'zod';

export const movementsRouter = Router();

// Authentication required for all movement routes
movementsRouter.use(requireAuth);

/**
 * Pure helper: Calculate on-hand quantity for an item at a specific location
 * Incomings (destinationLocationId) minus Outgoings (sourceLocationId)
 */
export async function getItemOnHandAtLocation(
  tx: Prisma.TransactionClient | typeof prisma,
  itemId: string,
  locationId: string
): Promise<number> {
  const [incoming, outgoing] = await Promise.all([
    tx.stockMovement.aggregate({
      where: { itemId, destinationLocationId: locationId },
      _sum: { quantity: true },
    }),
    tx.stockMovement.aggregate({
      where: { itemId, sourceLocationId: locationId },
      _sum: { quantity: true },
    }),
  ]);

  const inQty = incoming._sum.quantity || 0;
  const outQty = outgoing._sum.quantity || 0;
  return inQty - outQty;
}

/**
 * Helper: Calculate on-hand stock breakdown across all active locations
 */
export async function getItemStockBreakdown(
  tx: Prisma.TransactionClient | typeof prisma,
  itemId: string
) {
  const activeLocations = await tx.location.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  let totalOnHand = 0;
  const breakdown = await Promise.all(
    activeLocations.map(async (loc) => {
      const onHand = await getItemOnHandAtLocation(tx, itemId, loc.id);
      totalOnHand += onHand;
      return {
        locationId: loc.id,
        locationName: loc.name,
        locationCode: loc.code,
        onHand,
      };
    })
  );

  return { locations: breakdown, totalOnHand };
}

// Zod Schema for recording movements
const createMovementSchema = z.object({
  itemId: z.string().uuid('Invalid Item ID'),
  type: z.nativeEnum(MovementType, { errorMap: () => ({ message: 'Invalid movement type' }) }),
  quantity: z.coerce.number().int('Quantity must be an integer').positive('Quantity must be greater than 0'),
  sourceLocationId: z.string().uuid('Invalid Source Location ID').optional().nullable(),
  destinationLocationId: z.string().uuid('Invalid Destination Location ID').optional().nullable(),
  // For adjustments, accept either locationId + direction or source/dest
  locationId: z.string().uuid('Invalid Location ID').optional().nullable(),
  direction: z.enum(['INCREASE', 'DECREASE']).optional().nullable(),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional().nullable(),
});

/**
 * POST /api/movements
 * Append-only stock movement entry with transactional non-negative validation and strict RBAC
 */
movementsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const validation = createMovementSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { itemId, type, quantity } = validation.data;
    let { sourceLocationId, destinationLocationId, reason, locationId, direction } = validation.data;

    // 1. Verify item exists and is active (not archived)
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    if (item.isArchived) {
      return res.status(400).json({
        error: 'Cannot record stock movements against an archived item. Please restore the item first.',
      });
    }

    // 2. Normalization and type-specific rules
    if (type === MovementType.RECEIPT) {
      if (!destinationLocationId) {
        destinationLocationId = locationId;
      }
      if (!destinationLocationId) {
        return res.status(400).json({ error: 'Destination location is required for stock receipts.' });
      }
      sourceLocationId = null;

      // Staff RBAC check for destination
      if (user.role === Role.STAFF && !user.assignedLocationIds.includes(destinationLocationId)) {
        return res.status(403).json({
          error: 'Forbidden: You are not assigned to record receipts at this warehouse location.',
        });
      }
    } else if (type === MovementType.ISSUE) {
      if (!sourceLocationId) {
        sourceLocationId = locationId;
      }
      if (!sourceLocationId) {
        return res.status(400).json({ error: 'Source location is required for stock issues.' });
      }
      destinationLocationId = null;

      // Staff RBAC check for source
      if (user.role === Role.STAFF && !user.assignedLocationIds.includes(sourceLocationId)) {
        return res.status(403).json({
          error: 'Forbidden: You are not assigned to issue stock from this warehouse location.',
        });
      }
    } else if (type === MovementType.TRANSFER) {
      if (!sourceLocationId || !destinationLocationId) {
        return res.status(400).json({
          error: 'Both source location and destination location are required for transfers.',
        });
      }
      if (sourceLocationId === destinationLocationId) {
        return res.status(400).json({
          error: 'Source location and destination location cannot be the same.',
        });
      }

      // Staff RBAC check: must be assigned to source location
      if (user.role === Role.STAFF && !user.assignedLocationIds.includes(sourceLocationId)) {
        return res.status(403).json({
          error: 'Forbidden: You are not assigned to transfer stock out of this warehouse location.',
        });
      }
    } else if (type === MovementType.ADJUSTMENT) {
      // Requirement 1 & 4: Adjustments restricted to managers and MUST have a reason
      if (user.role !== Role.MANAGER) {
        return res.status(403).json({
          error: 'Forbidden: Only inventory managers can record stock adjustments.',
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          error: 'A non-empty reason is required when recording an inventory adjustment.',
        });
      }

      // Normalize adjustment direction and location
      if (locationId && direction) {
        if (direction === 'INCREASE') {
          destinationLocationId = locationId;
          sourceLocationId = null;
        } else {
          sourceLocationId = locationId;
          destinationLocationId = null;
        }
      } else if (!sourceLocationId && !destinationLocationId) {
        return res.status(400).json({
          error: 'An adjustment must specify a location and direction (increase or decrease).',
        });
      }
    }

    // 3. Verify location existence
    const locationIdsToCheck = [sourceLocationId, destinationLocationId].filter(Boolean) as string[];
    const locations = await prisma.location.findMany({
      where: { id: { in: locationIdsToCheck } },
    });

    if (locations.length !== locationIdsToCheck.length) {
      return res.status(404).json({ error: 'One or more specified warehouse locations do not exist.' });
    }

    // 4. Atomic Transaction: Check non-negative constraint and insert movement
    const movement = await prisma.$transaction(async (tx) => {
      // If movement consumes stock from source location, verify current on-hand
      if (sourceLocationId) {
        const currentOnHand = await getItemOnHandAtLocation(tx, itemId, sourceLocationId);
        if (currentOnHand < quantity) {
          const sourceLoc = locations.find((l) => l.id === sourceLocationId);
          const locName = sourceLoc ? sourceLoc.name : 'selected location';
          throw new Error(
            `INSUFFICIENT_STOCK: Cannot ${type.toLowerCase()} ${quantity} unit(s). Only ${currentOnHand} unit(s) available on hand at ${locName}.`
          );
        }
      }

      return tx.stockMovement.create({
        data: {
          itemId,
          type,
          quantity,
          sourceLocationId,
          destinationLocationId,
          reason: reason?.trim() || null,
          userId: user.id,
        },
        include: {
          item: {
            select: { id: true, sku: true, name: true, uom: true },
          },
          user: {
            select: { id: true, name: true, role: true, email: true },
          },
          sourceLocation: {
            select: { id: true, name: true, code: true },
          },
          destinationLocation: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    });

    // 5. Get updated on-hand stock for response
    const updatedStock = await getItemStockBreakdown(prisma, itemId);

    return res.status(201).json({
      message: 'Stock movement recorded successfully.',
      movement,
      stock: updatedStock,
    });
  } catch (err: any) {
    if (err.message && err.message.startsWith('INSUFFICIENT_STOCK:')) {
      return res.status(400).json({ error: err.message.replace('INSUFFICIENT_STOCK: ', '') });
    }
    console.error('Error recording stock movement:', err);
    return res.status(500).json({ error: 'Failed to record stock movement.' });
  }
});

/**
 * GET /api/movements
 * List all movements with optional filtering by itemId, locationId, or type
 */
movementsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId, locationId, type, search, limit = '50', offset = '0' } = req.query;

    const whereClause: Prisma.StockMovementWhereInput = {};

    if (itemId && typeof itemId === 'string') {
      whereClause.itemId = itemId;
    }

    if (type && typeof type === 'string' && Object.values(MovementType).includes(type as MovementType)) {
      whereClause.type = type as MovementType;
    }

    if (locationId && typeof locationId === 'string' && locationId !== 'all') {
      whereClause.OR = [
        { sourceLocationId: locationId },
        { destinationLocationId: locationId },
      ];
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      whereClause.item = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const take = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const skip = Math.max(parseInt(offset as string, 10) || 0, 0);

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where: whereClause,
        include: {
          item: {
            select: { id: true, sku: true, name: true, uom: true },
          },
          user: {
            select: { id: true, name: true, role: true },
          },
          sourceLocation: {
            select: { id: true, name: true, code: true },
          },
          destinationLocation: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.stockMovement.count({ where: whereClause }),
    ]);

    return res.json({ movements, total, limit: take, offset: skip });
  } catch (err) {
    console.error('Error fetching movements:', err);
    return res.status(500).json({ error: 'Failed to fetch stock movements.' });
  }
});

/**
 * GET /api/movements/on-hand/:itemId
 * Derived on-hand quantities for an item across all locations
 */
movementsRouter.get('/on-hand/:itemId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, sku: true, name: true, uom: true, reorderLevel: true, isArchived: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const stock = await getItemStockBreakdown(prisma, itemId);

    return res.json({
      item,
      locations: stock.locations,
      totalOnHand: stock.totalOnHand,
      isLowStock: stock.totalOnHand <= item.reorderLevel,
    });
  } catch (err) {
    console.error('Error fetching on-hand balance:', err);
    return res.status(500).json({ error: 'Failed to calculate on-hand stock.' });
  }
});

/**
 * GET /api/movements/item/:itemId
 * Chronological movement history for a specific item
 */
movementsRouter.get('/item/:itemId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const movements = await prisma.stockMovement.findMany({
      where: { itemId },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
        sourceLocation: {
          select: { id: true, name: true, code: true },
        },
        destinationLocation: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ movements });
  } catch (err) {
    console.error('Error fetching item movements:', err);
    return res.status(500).json({ error: 'Failed to fetch item movement history.' });
  }
});
