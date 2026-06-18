import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { AUTH_COOKIE, verifyToken } from '../utils/token.js'

// Require a valid JWT (from httpOnly cookie, or Bearer header as a fallback for API clients).
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[AUTH_COOKIE]
  const header = req.headers.authorization
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  const token = cookieToken || bearer

  if (!token) throw new ApiError(401, 'Authentication required')

  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, role: payload.role, email: payload.email, name: payload.name }
    next()
  } catch {
    throw new ApiError(401, 'Invalid or expired session')
  }
}
