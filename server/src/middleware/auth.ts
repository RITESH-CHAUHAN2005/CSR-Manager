import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { AUTH_COOKIE, verifyToken } from '../utils/token.js'

// Require a valid JWT (from httpOnly cookie, or Bearer header as a fallback for API clients).
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[AUTH_COOKIE]
  const header = req.headers.authorization
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  // Query-string token fallback: lets the mobile app open a file-download URL
  // (e.g. the PDF/Excel report export) directly in the device browser, which
  // cannot attach an Authorization header. Used for GET downloads only.
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined
  const token = cookieToken || bearer || queryToken

  if (!token) throw new ApiError(401, 'Authentication required')

  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, role: payload.role, email: payload.email, name: payload.name }
    next()
  } catch {
    throw new ApiError(401, 'Invalid or expired session')
  }
}
