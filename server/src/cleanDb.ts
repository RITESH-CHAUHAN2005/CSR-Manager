import bcrypt from 'bcryptjs'
import { connectDB, disconnectDB } from './config/db.js'
import { env } from './config/env.js'
import { User } from './models/User.js'
import { Company } from './models/Company.js'
import { FinancialYear } from './models/FinancialYear.js'
import { Project } from './models/Project.js'
import { FundReceipt } from './models/FundReceipt.js'
import { Expenditure } from './models/Expenditure.js'
import { AuditLog } from './models/AuditLog.js'

// Production reset: wipe ALL data (demo accounts + sample business data) and leave
// ONLY the admin account. The admin then creates real editor/viewer users and enters
// real data from the app. Run with `npm run clean`.
async function clean() {
  console.log('Clearing all collections…')
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    FinancialYear.deleteMany({}),
    Project.deleteMany({}),
    FundReceipt.deleteMany({}),
    Expenditure.deleteMany({}),
    AuditLog.deleteMany({}),
  ])

  await User.create({
    name: 'CSR Administrator',
    email: env.SEED_ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12),
    role: 'admin',
  })

  console.log('✅ Clean complete — only the admin account remains:')
  console.log('   Admin —', env.SEED_ADMIN_EMAIL, '/', env.SEED_ADMIN_PASSWORD)
}

connectDB()
  .then(clean)
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('Clean failed:', err)
    await disconnectDB()
    process.exit(1)
  })
