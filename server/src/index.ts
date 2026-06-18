import type { Server } from 'node:http'
import mongoose from 'mongoose'
import { createApp } from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'

async function bootstrap() {
  await connectDB()
  const app = createApp()
  const server = app.listen(env.PORT, () => {
    console.log(`🚀 CSR Manager API running on http://localhost:${env.PORT}`)
  })

  // Surface listen errors clearly instead of an unhandled 'error' crash.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `❌ Port ${env.PORT} is already in use. A previous server is probably still running.\n` +
          `   Stop it and try again. On Windows you can free the port with:\n` +
          `   PowerShell: Get-NetTCPConnection -LocalPort ${env.PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`,
      )
    } else {
      console.error('❌ Server error:', err)
    }
    process.exit(1)
  })

  return server
}

// Close the HTTP server and DB connection so the port is released cleanly.
function setupGracefulShutdown(server: Server) {
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n${signal} received — shutting down gracefully...`)
    server.close(async () => {
      await mongoose.connection.close()
      console.log('✅ Server closed and MongoDB disconnected')
      process.exit(0)
    })
    // Force exit if something hangs.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  // tsx watch sends SIGTERM on restart; this releases the port between reloads.
}

bootstrap()
  .then(setupGracefulShutdown)
  .catch((err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
