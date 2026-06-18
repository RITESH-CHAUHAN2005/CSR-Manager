import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import morgan from 'morgan'
import mongoSanitize from 'express-mongo-sanitize'
import hpp from 'hpp'
import { allowedOrigins, isProd } from './config/env.js'
import { globalLimiter } from './middleware/rateLimit.js'
import { errorHandler, notFound } from './middleware/error.js'
import api from './routes/index.js'

export function createApp() {
  const app = express()

  // Behind a reverse proxy (needed for correct req.ip + secure cookies in prod).
  app.set('trust proxy', 1)

  // --- Security headers ---
  app.use(helmet())

  // --- CORS: strict allow-list, credentials enabled for cookie auth ---
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) and allow-listed origins.
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        cb(new Error('Not allowed by CORS'))
      },
      credentials: true,
    }),
  )

  // --- Body parsing (with size cap to blunt large-payload DoS) ---
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))
  app.use(cookieParser())

  // --- Injection / pollution hardening ---
  app.use(mongoSanitize()) // strips $ and . from keys -> blocks NoSQL operator injection
  app.use(hpp()) // HTTP parameter pollution

  app.use(compression())
  app.use(morgan(isProd ? 'combined' : 'dev'))

  // --- Rate limiting ---
  app.use('/api', globalLimiter)

  // --- Routes ---
  app.use('/api', api)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
