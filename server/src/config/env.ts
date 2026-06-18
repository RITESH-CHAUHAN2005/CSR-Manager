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
export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
