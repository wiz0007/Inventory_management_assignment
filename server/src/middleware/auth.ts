import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  assignedLocationIds: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        locations: {
          select: { locationId: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      assignedLocationIds: user.locations.map((l) => l.locationId),
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This action requires one of the following roles: ${roles.join(', ')}.`,
      });
    }

    next();
  };
}

export function requireLocationPermission(getLocationId: (req: AuthenticatedRequest) => string | undefined | null) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Managers have global access to all locations
    if (req.user.role === Role.MANAGER) {
      return next();
    }

    const targetLocationId = getLocationId(req);
    if (!targetLocationId) {
      return res.status(400).json({ error: 'Location ID is required for this operation.' });
    }

    // Warehouse staff can only record operations at their assigned locations
    if (!req.user.assignedLocationIds.includes(targetLocationId)) {
      return res.status(403).json({
        error: 'Forbidden: You are not assigned to this warehouse location.',
      });
    }

    next();
  };
}
