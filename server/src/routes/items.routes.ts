import { Router, Response } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Role, TimelineEventType } from '@prisma/client';
import { z } from 'zod';

export const itemsRouter = Router();

// Require authentication for all item routes
itemsRouter.use(requireAuth);

const createItemSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, 'SKU must be at least 2 characters')
    .max(30, 'SKU cannot exceed 30 characters')
    .regex(/^[A-Za-z0-9-_]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores'),
  name: z.string().trim().min(2, 'Item name must be at least 2 characters').max(100, 'Item name cannot exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  uom: z.string().trim().min(1, 'Unit of measure is required').max(20, 'Unit of measure cannot exceed 20 characters').default('units'),
  reorderLevel: z.coerce.number().int().min(0, 'Reorder level must be a non-negative integer').default(10),
  categoryId: z.string().uuid('Invalid Category ID'),
});

const updateItemSchema = z.object({
  name: z.string().trim().min(2, 'Item name must be at least 2 characters').max(100, 'Item name cannot exceed 100 characters').optional(),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  uom: z.string().trim().min(1, 'Unit of measure is required').max(20, 'Unit of measure cannot exceed 20 characters').optional(),
  reorderLevel: z.coerce.number().int().min(0, 'Reorder level must be a non-negative integer').optional(),
  categoryId: z.string().uuid('Invalid Category ID').optional(),
});

const addNoteSchema = z.object({
  noteText: z.string().trim().min(1, 'Note cannot be empty').max(1000, 'Note cannot exceed 1000 characters'),
});

/**
 * GET /api/items
 * List items with category, optional category filter, search, and archived filter
 */
itemsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryId, search, includeArchived, archivedOnly } = req.query;

    const whereClause: any = {};

    if (archivedOnly === 'true') {
      whereClause.isArchived = true;
    } else if (includeArchived !== 'true') {
      whereClause.isArchived = false;
    }

    if (categoryId && typeof categoryId === 'string' && categoryId !== 'all') {
      whereClause.categoryId = categoryId;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.item.findMany({
      where: whereClause,
      include: {
        category: true,
        _count: {
          select: { movements: true, timeline: true },
        },
      },
      orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
    });

    // Derive on-hand stock position from append-only movements for all items in 2 queries
    const itemIds = items.map((it) => it.id);
    const [incoming, outgoing] = await Promise.all([
      prisma.stockMovement.groupBy({
        by: ['itemId'],
        where: { itemId: { in: itemIds }, destinationLocationId: { not: null } },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.groupBy({
        by: ['itemId'],
        where: { itemId: { in: itemIds }, sourceLocationId: { not: null } },
        _sum: { quantity: true },
      }),
    ]);

    const inMap = new Map(incoming.map((i) => [i.itemId, i._sum.quantity || 0]));
    const outMap = new Map(outgoing.map((o) => [o.itemId, o._sum.quantity || 0]));

    const itemsWithStock = items.map((item) => {
      const onHand = (inMap.get(item.id) || 0) - (outMap.get(item.id) || 0);
      return {
        ...item,
        totalOnHand: onHand,
        isLowStock: onHand <= item.reorderLevel,
      };
    });

    res.json(itemsWithStock);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve items.', details: err.message });
  }
});

/**
 * GET /api/items/:id
 * Get single item with category, recent timeline, and derived stock position
 */
itemsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        timeline: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    // Derive on-hand quantity for this item
    const [incoming, outgoing] = await Promise.all([
      prisma.stockMovement.aggregate({
        where: { itemId: id, destinationLocationId: { not: null } },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.aggregate({
        where: { itemId: id, sourceLocationId: { not: null } },
        _sum: { quantity: true },
      }),
    ]);

    const totalOnHand = (incoming._sum.quantity || 0) - (outgoing._sum.quantity || 0);

    res.json({
      ...item,
      totalOnHand,
      isLowStock: totalOnHand <= item.reorderLevel,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve item.', details: err.message });
  }
});

/**
 * POST /api/items
 * Create a new item (Manager only).
 * Automatically writes a CREATED event to item_timeline.
 */
itemsRouter.post('/', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const normalizedSku = parsed.data.sku.toUpperCase();

    // Check SKU uniqueness
    const existingSku = await prisma.item.findUnique({
      where: { sku: normalizedSku },
    });

    if (existingSku) {
      return res.status(409).json({ error: `An item with SKU "${normalizedSku}" already exists.` });
    }

    // Check category exists
    const category = await prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
    });

    if (!category) {
      return res.status(400).json({ error: 'Selected category does not exist.' });
    }

    // Atomic transaction: create item and log CREATED timeline event
    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          sku: normalizedSku,
          name: parsed.data.name,
          description: parsed.data.description || null,
          uom: parsed.data.uom,
          reorderLevel: parsed.data.reorderLevel,
          categoryId: parsed.data.categoryId,
        },
        include: {
          category: true,
        },
      });

      await tx.itemTimeline.create({
        data: {
          itemId: item.id,
          userId: req.user!.id,
          eventType: TimelineEventType.CREATED,
          noteText: `Item initialized with SKU ${item.sku} in category "${category.name}". Initial reorder level: ${item.reorderLevel} ${item.uom}.`,
        },
      });

      return item;
    });

    res.status(201).json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create item.', details: err.message });
  }
});

/**
 * PUT /api/items/:id
 * Update item details (Manager only).
 * Automatically computes field diffs and writes atomic FIELD_CHANGE events to item_timeline.
 */
itemsRouter.put('/:id', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const currentItem = await prisma.item.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!currentItem) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    // If category is changing, verify new category exists
    let newCategory = currentItem.category;
    if (parsed.data.categoryId && parsed.data.categoryId !== currentItem.categoryId) {
      const catCheck = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
      if (!catCheck) {
        return res.status(400).json({ error: 'Selected category does not exist.' });
      }
      newCategory = catCheck;
    }

    // Detect field changes for timeline auditing
    const changes: { fieldName: string; oldValue: string; newValue: string }[] = [];

    if (parsed.data.name !== undefined && parsed.data.name !== currentItem.name) {
      changes.push({
        fieldName: 'name',
        oldValue: currentItem.name,
        newValue: parsed.data.name,
      });
    }

    const currentDesc = currentItem.description || '';
    const incomingDesc = parsed.data.description || '';
    if (parsed.data.description !== undefined && incomingDesc !== currentDesc) {
      changes.push({
        fieldName: 'description',
        oldValue: currentDesc || '(empty)',
        newValue: incomingDesc || '(empty)',
      });
    }

    if (parsed.data.uom !== undefined && parsed.data.uom !== currentItem.uom) {
      changes.push({
        fieldName: 'uom',
        oldValue: currentItem.uom,
        newValue: parsed.data.uom,
      });
    }

    if (parsed.data.reorderLevel !== undefined && parsed.data.reorderLevel !== currentItem.reorderLevel) {
      changes.push({
        fieldName: 'reorderLevel',
        oldValue: String(currentItem.reorderLevel),
        newValue: String(parsed.data.reorderLevel),
      });
    }

    if (parsed.data.categoryId !== undefined && parsed.data.categoryId !== currentItem.categoryId) {
      changes.push({
        fieldName: 'category',
        oldValue: currentItem.category.name,
        newValue: newCategory.name,
      });
    }

    // Atomic update + audit log insertion
    const updatedItem = await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.description !== undefined && { description: parsed.data.description || null }),
          ...(parsed.data.uom !== undefined && { uom: parsed.data.uom }),
          ...(parsed.data.reorderLevel !== undefined && { reorderLevel: parsed.data.reorderLevel }),
          ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
        },
        include: { category: true },
      });

      // Insert audit timeline entries for each modified field
      for (const change of changes) {
        await tx.itemTimeline.create({
          data: {
            itemId: id,
            userId: req.user!.id,
            eventType: TimelineEventType.FIELD_CHANGE,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            noteText: `Changed ${change.fieldName} from "${change.oldValue}" to "${change.newValue}".`,
          },
        });
      }

      return updated;
    });

    res.json({ item: updatedItem, changesLogged: changes.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update item.', details: err.message });
  }
});

/**
 * PATCH /api/items/:id/archive
 * Toggle or set item archive state (Manager only)
 * Records a FIELD_CHANGE in the immutable audit timeline.
 */
itemsRouter.patch('/:id/archive', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isArchived } = req.body;

    const currentItem = await prisma.item.findUnique({ where: { id } });
    if (!currentItem) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const nextState = typeof isArchived === 'boolean' ? isArchived : !currentItem.isArchived;

    if (nextState === currentItem.isArchived) {
      return res.json({ item: currentItem, message: `Item is already ${nextState ? 'archived' : 'active'}.` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resItem = await tx.item.update({
        where: { id },
        data: { isArchived: nextState },
        include: { category: true },
      });

      await tx.itemTimeline.create({
        data: {
          itemId: id,
          userId: req.user!.id,
          eventType: TimelineEventType.FIELD_CHANGE,
          fieldName: 'isArchived',
          oldValue: currentItem.isArchived ? 'archived' : 'active',
          newValue: nextState ? 'archived' : 'active',
          noteText: nextState
            ? 'Item was archived. Future stock movements are restricted.'
            : 'Item was unarchived and returned to active stock catalog.',
        },
      });

      return resItem;
    });

    res.json({
      item: updated,
      message: `Item "${updated.name}" (${updated.sku}) has been ${nextState ? 'archived' : 'unarchived'}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to change item archive status.', details: err.message });
  }
});

/**
 * GET /api/items/:id/timeline
 * Retrieve the complete chronological audit timeline for an item
 */
itemsRouter.get('/:id/timeline', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const itemExists = await prisma.item.findUnique({ where: { id }, select: { id: true, name: true, sku: true } });
    if (!itemExists) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const timeline = await prisma.itemTimeline.findMany({
      where: { itemId: id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ item: itemExists, timeline });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve item timeline.', details: err.message });
  }
});

/**
 * POST /api/items/:id/notes
 * Append a note to the item audit timeline (Manager & Staff)
 */
itemsRouter.post('/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const parsed = addNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const itemExists = await prisma.item.findUnique({ where: { id } });
    if (!itemExists) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const note = await prisma.itemTimeline.create({
      data: {
        itemId: id,
        userId: req.user!.id,
        eventType: TimelineEventType.NOTE,
        noteText: parsed.data.noteText,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    res.status(201).json(note);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add note.', details: err.message });
  }
});
