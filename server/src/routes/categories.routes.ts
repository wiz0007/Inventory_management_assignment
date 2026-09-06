import { Router, Response } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';
import { z } from 'zod';

export const categoriesRouter = Router();

// Apply authentication to all category routes
categoriesRouter.use(requireAuth);

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(50, 'Category name cannot exceed 50 characters'),
});

/**
 * GET /api/categories
 * Returns all categories with item counts (accessible by Manager and Staff)
 */
categoriesRouter.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch categories.', details: err.message });
  }
});

/**
 * POST /api/categories
 * Create a new category (Manager only)
 */
categoriesRouter.post('/', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const existing = await prisma.category.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });

    if (existing) {
      return res.status(409).json({ error: `Category "${parsed.data.name}" already exists.` });
    }

    const category = await prisma.category.create({
      data: { name: parsed.data.name },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    res.status(201).json(category);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create category.', details: err.message });
  }
});

/**
 * PUT /api/categories/:id
 * Update category name (Manager only)
 */
categoriesRouter.put('/:id', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    // Check duplicate name on different id
    const duplicate = await prisma.category.findFirst({
      where: {
        name: { equals: parsed.data.name, mode: 'insensitive' },
        id: { not: id },
      },
    });

    if (duplicate) {
      return res.status(409).json({ error: `Category "${parsed.data.name}" already exists.` });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name: parsed.data.name },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update category.', details: err.message });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete category (Manager only, blocked if contains items)
 */
categoriesRouter.delete('/:id', requireRole(Role.MANAGER), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true } },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    if (category._count.items > 0) {
      return res.status(400).json({
        error: `Cannot delete category "${category.name}" because it contains ${category._count.items} item(s). Reassign or delete the items first.`,
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: `Category "${category.name}" was successfully deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete category.', details: err.message });
  }
});
