import { connectDB, disconnectDB } from './config/db.js'
import { seedDatabase } from './seed.js'

// CLI entry for `npm run seed` — connects, seeds, disconnects.
connectDB()
  .then(seedDatabase)
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await disconnectDB()
    process.exit(1)
  })
