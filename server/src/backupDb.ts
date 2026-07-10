import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDB, disconnectDB } from './config/db.js'

// Full read-only dump of every collection to timestamped JSON files. This database
// has no automated backups (Atlas M0), so run this before any migration or seed:
//   npm run backup
// Output lands in server/backups/<timestamp>/, which is gitignored.
//
// Restore is a manual `mongoimport` per file, e.g.
//   mongoimport --uri "$MONGODB_URI" --collection projects --file projects.json --jsonArray --drop
async function backup() {
  const db = mongoose.connection.db
  if (!db) throw new Error('No database connection')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.resolve(process.cwd(), 'backups', stamp)
  fs.mkdirSync(dir, { recursive: true })

  const collections = await db.listCollections().toArray()
  console.log(`Backing up ${collections.length} collection(s) to ${dir}`)

  let totalDocs = 0
  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray()
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(docs, null, 2))
    totalDocs += docs.length
    console.log(`  ${name}: ${docs.length} document(s)`)
  }
  console.log(`\nDone — ${totalDocs} document(s) written to ${dir}`)
}

connectDB()
  .then(backup)
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('Backup failed:', err)
    await disconnectDB()
    process.exit(1)
  })
