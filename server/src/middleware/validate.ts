import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodSchema } from 'zod'
import { ApiError } from '../utils/ApiError.js'

// Validate & coerce req.body against a Zod schema; replaces body with parsed data.
export const validateBody =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ApiError(422, 'Validation failed', err.flatten().fieldErrors)
      }
      throw err
    }
  }
