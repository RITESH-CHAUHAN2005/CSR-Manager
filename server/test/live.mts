// Dev/integration launcher: real Express app on :5000 backed by an ephemeral MongoDB,
// pre-seeded. Lets the client run against a live API without installing MongoDB.
import { MongoMemoryServer } from 'mongodb-memory-server'

const mongo = await MongoMemoryServer.create()
process.env.MONGODB_URI = mongo.getUri()
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-dev-secret-dev-secret-123456'
process.env.NODE_ENV = 'development'
process.env.PORT = '5000'
process.env.CLIENT_ORIGIN = 'http://localhost:5173,http://localhost:5175'

const { connectDB } = await import('../src/config/db.js')
const { seedDatabase } = await import('../src/seed.js')
const { createApp } = await import('../src/app.js')

await connectDB()
await seedDatabase()
createApp().listen(5000, () => console.log('🚀 LIVE API (ephemeral mongo) on http://localhost:5000'))
