import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import { env, isProd } from '../config/env.js'
import type { Role } from '../models/User.js'

export interface JwtPayload {
  sub: string
  role: Role
  email: string
  name: string
}

export const AUTH_COOKIE = 'csr_token'

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}

// Store the JWT in an httpOnly cookie so it cannot be read by JS (XSS-resistant).
// SameSite=strict mitigates CSRF; Secure is enabled in production (HTTPS).
export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    path: '/',
  })
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: '/' })
}
