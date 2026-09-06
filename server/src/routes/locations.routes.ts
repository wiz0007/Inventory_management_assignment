import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

export const locationsRouter = Router();

const createLocationSchema = z.object({
  name: z.string().min(2, 'Location name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').toUpperCase(),
});

const updateLocationSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).toUpperCase().optional(),
  isActive: z.boolean().optional(),
});

const assignStaffSchema = z.object({
  staffUserIds: z.array(z.string().uuid()),
});

// GET /api/locations
// Returns all locations. If staff, indicates whether current user is assigned.
locationsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
      include: {
        users: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    const isManager = req.user?.role === Role.MANAGER;
    const userLocationIds = new Set(req.user?.assignedLocationIds || []);

    const enrichedLocations = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      isActive: loc.isActive,
      createdAt: loc.createdAt,
      assignedStaff: loc.users.map((u) => u.user),
      isAssignedToCurrentUser: isManager || userLocationIds.has(loc.id),
    }));

    res.json({ locations: enrichedLocations });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations (Manager only)
locationsRouter.post('/', requireAuth, requireRole(Role.MANAGER), async (req, res, next) => {
  try {
    const data = createLocationSchema.parse(req.body);

    const existingCode = await prisma.location.findUnique({
      where: { code: data.code },
    });
    if (existingCode) {
      return res.status(409).json({ error: `Location code "${data.code}" already in use.` });
    }

    const existingName = await prisma.location.findUnique({
      where: { name: data.name },
    });
    if (existingName) {
      return res.status(409).json({ error: `Location name "${data.name}" already in use.` });
    }

    const location = await prisma.location.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim(),
      },
    });

    res.status(201).json({
      message: 'Location created successfully.',
      location,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/locations/:id (Manager only)
locationsRouter.put('/:id', requireAuth, requireRole(Role.MANAGER), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateLocationSchema.parse(req.body);

    const updated = await prisma.location.update({
      where: { id },
      data,
    });

    res.json({
      message: 'Location updated successfully.',
      location: updated,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations/:id/assign-staff (Manager only: assign multiple staff members to this location)
locationsRouter.post('/:id/assign-staff', requireAuth, requireRole(Role.MANAGER), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { staffUserIds } = assignStaffSchema.parse(req.body);

    // Verify location exists
    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) {
      return res.status(404).json({ error: 'Location not found.' });
    }

    // Replace all current assignments for this location in an atomic transaction
    await prisma.$transaction(async (tx) => {
      await tx.userLocation.deleteMany({
        where: { locationId: id },
      });

      if (staffUserIds.length > 0) {
        await tx.userLocation.createMany({
          data: staffUserIds.map((userId) => ({
            userId,
            locationId: id,
          })),
        });
      }
    });

    const refreshedLocation = await prisma.location.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });

    res.json({
      message: 'Staff assigned successfully.',
      location: {
        ...refreshedLocation,
        assignedStaff: refreshedLocation?.users.map((u) => u.user) || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/locations/user-assignments/:userId (Manager only: assign multiple locations to a user)
locationsRouter.put('/user-assignments/:userId', requireAuth, requireRole(Role.MANAGER), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const schema = z.object({
      locationIds: z.array(z.string().uuid()),
    });
    const { locationIds } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userLocation.deleteMany({
        where: { userId },
      });

      if (locationIds.length > 0) {
        await tx.userLocation.createMany({
          data: locationIds.map((locationId) => ({
            userId,
            locationId,
          })),
        });
      }
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        locations: {
          select: {
            location: true,
          },
        },
      },
    });

    res.json({
      message: 'User location assignments updated successfully.',
      user: {
        id: updatedUser?.id,
        name: updatedUser?.name,
        email: updatedUser?.email,
        role: updatedUser?.role,
        assignedLocations: updatedUser?.locations.map((l) => l.location) || [],
      },
    });
  } catch (err) {
    next(err);
  }
});
