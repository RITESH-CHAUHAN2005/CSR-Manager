import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { isProd } from '../config/env.js'

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' })
}

// Centralized error handler. Never leaks stack traces / internals in production.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    })
  }

  // Mongoose duplicate key
  if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ error: 'Duplicate value violates a unique constraint' })
  }

  // Mongoose cast error (bad ObjectId)
  if ((err as { name?: string })?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid identifier' })
  }

  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    ...(isProd ? {} : { detail: (err as Error)?.message }),
  })
}
