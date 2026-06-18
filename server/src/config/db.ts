import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDB() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  })
  console.log('✅ MongoDB connected')
}

export async function disconnectDB() {
  await mongoose.disconnect()
}
