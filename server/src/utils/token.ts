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
//
// SameSite:
//  - dev (same-origin via Vite proxy): 'strict' — strongest CSRF protection.
//  - prod: 'none' so the cookie is sent on cross-site requests when the frontend
//    (e.g. a static host) and the API (e.g. Railway) live on different domains.
//    'none' REQUIRES Secure=true, which is why prod must be served over HTTPS.
//    CSRF risk is contained by the strict CORS allow-list (see app.ts).
// clearAuthCookie must use the SAME attributes or browsers won't clear it.
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'strict') as 'none' | 'strict',
  path: '/',
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  })
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions)
}
