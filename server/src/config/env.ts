import 'dotenv/config'
import { z } from 'zod'

// Validate & freeze environment at startup — fail fast if misconfigured.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@csr.com'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@123'),
  SEED_USER_EMAIL: z.string().email().default('user@csr.com'),
  SEED_USER_PASSWORD: z.string().default('User@123'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'

// Known production frontend(s) — always allowed for CORS regardless of the
// CLIENT_ORIGIN env value, so a deploy keeps working without re-editing Render env.
// firebrick-hedgehog-486591 was the old Hostinger account's temp domain (plan
// retired 2026-07-10); wheat-aardvark-709394 is the new Hostinger account's domain.
const PROD_FRONTENDS = ['https://wheat-aardvark-709394.hostingersite.com']
// Local dev origins (Vite). Only trusted when NOT in production.
const DEV_FRONTENDS = ['http://localhost:5173', 'http://127.0.0.1:5173']

// In production, CLIENT_ORIGIN is only honoured if it was actually set — otherwise
// its localhost default would become a credentialed-CORS-allowed origin in prod.
const configuredOrigins =
  isProd && !process.env.CLIENT_ORIGIN ? [] : env.CLIENT_ORIGIN.split(',')

export const allowedOrigins = Array.from(
  new Set(
    [...configuredOrigins, ...PROD_FRONTENDS, ...(isProd ? [] : DEV_FRONTENDS)]
      .map((o) => o.trim())
      .filter(Boolean),
  ),
)
