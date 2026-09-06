import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Always log full error trace on the server for diagnostics
  console.error(`[Error Handler] ${req.method} ${req.url} -`, err);

  // 1. Zod Request Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // 2. Prisma Database Connection & Initialization Errors (e.g. unreachable DB host)
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err.name === 'PrismaClientInitializationError' ||
    err.message?.includes("Can't reach database server")
  ) {
    return res.status(503).json({
      error: 'Database service is temporarily unavailable. Please try again shortly.',
      ...(process.env.NODE_ENV === 'development' ? { debug: err.message } : {}),
    });
  }

  // 3. Prisma Known Request Errors (Constraints, Not Found, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'A record with this identifier already exists.',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'The requested resource was not found.',
      });
    }
  }

  // 4. Client-side HTTP Errors (4xx) - Safe to share explicit operational messages
  const statusCode =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;

  if (statusCode < 500) {
    return res.status(statusCode).json({
      error: err.message || 'Request failed.',
    });
  }

  // 5. Unhandled Internal Server Errors (500) - NEVER leak raw ORM traces, hosts, or SQL
  const safeMessage = 'An unexpected server error occurred. Please try again later.';

  return res.status(500).json({
    error: safeMessage,
    ...(process.env.NODE_ENV === 'development' ? { debug: err.message, stack: err.stack } : {}),
  });
}
