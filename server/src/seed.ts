import bcrypt from 'bcryptjs'
import { env } from './config/env.js'
import { User } from './models/User.js'
import { Company } from './models/Company.js'
import { FinancialYear } from './models/FinancialYear.js'
import { Project } from './models/Project.js'
import { FundReceipt } from './models/FundReceipt.js'
import { Expenditure } from './models/Expenditure.js'
import { AuditLog } from './models/AuditLog.js'

// Same dataset as the frontend mocks — totals match the reference images exactly.
// Assumes an active mongoose connection (caller connects/disconnects).
export async function seedDatabase() {
  console.log('Clearing collections…')
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    FinancialYear.deleteMany({}),
    Project.deleteMany({}),
    FundReceipt.deleteMany({}),
    Expenditure.deleteMany({}),
    AuditLog.deleteMany({}),
  ])

  // --- Companies ---
  const [hdfc, infosys, tcs] = await Company.create([
    { name: 'HDFC Bank CSR Trust', cin: 'U65920MH1994PLC080618', contactPerson: 'Nandita Taneja', email: 'csrtrust@hdfc.com', phone: '+91-22-66521000' },
    { name: 'Infosys Foundation', cin: 'U93090KA2013NPL068315', contactPerson: 'Sudha Murthy', email: 'foundation@infosys.com', phone: '+91-80-28520261' },
    { name: 'Tata Consultancy Services Ltd', cin: 'U72200MH2004PLC153930', contactPerson: 'Rajesh Kumar', email: 'csr@tcs.com', phone: '+91-22-67789999' },
  ])

  // --- Users (passwords hashed with bcrypt, cost 12) ---
  await User.create([
    {
      name: 'CSR Administrator',
      email: env.SEED_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12),
      role: 'admin',
      status: 'approved',
    },
    {
      name: 'CSR Viewer',
      email: env.SEED_USER_EMAIL,
      passwordHash: await bcrypt.hash(env.SEED_USER_PASSWORD, 12),
      role: 'user',
      status: 'approved',
      companyId: tcs._id,
    },
    {
      // Demo employee awaiting approval — appears in the admin's pending-approvals list.
      name: 'Amit Verma',
      email: 'amit.verma@tcs.com',
      passwordHash: await bcrypt.hash('Employee@123', 12),
      role: 'user',
      status: 'pending',
      companyId: tcs._id,
    },
  ])

  // --- Financial Years ---
  const [fy1, fy2, fy3] = await FinancialYear.create([
    { name: 'FY 2022-23', startDate: '2022-04-01', endDate: '2023-03-31', isActive: false },
    { name: 'FY 2023-24', startDate: '2023-04-01', endDate: '2024-03-31', isActive: false },
    { name: 'FY 2024-25', startDate: '2024-04-01', endDate: '2025-03-31', isActive: true },
  ])

  // --- Projects ---
  const [p1, p2, p3, p4, p5, p6, p7] = await Project.create([
    { name: 'Digital Literacy Program', companyId: tcs._id, financialYearId: fy1._id, category: 'Education', location: 'Pune, Maharashtra', budget: 2500000, status: 'completed', description: 'Training rural youth in digital skills and computer usage' },
    { name: 'Clean Water Initiative', companyId: tcs._id, financialYearId: fy2._id, category: 'Environment', location: 'Nagpur District', budget: 3500000, status: 'completed', description: 'Installation of water purification systems in 10 villages' },
    { name: 'Women Empowerment Program', companyId: tcs._id, financialYearId: fy3._id, category: 'Skill Development', location: 'Nashik, Maharashtra', budget: 4000000, status: 'active', description: 'Skill development for rural women entrepreneurs' },
    { name: 'BridgeIT Scholarship', companyId: infosys._id, financialYearId: fy2._id, category: 'Education', location: 'Bengaluru, Karnataka', budget: 1800000, status: 'completed', description: 'Scholarships for underprivileged students in STEM' },
    { name: 'Rural Healthcare Camp', companyId: infosys._id, financialYearId: fy3._id, category: 'Healthcare', location: 'Mysuru District, Karnataka', budget: 2200000, status: 'active', description: 'Free healthcare services and medicine distribution' },
    { name: 'Tree Plantation Drive', companyId: hdfc._id, financialYearId: fy2._id, category: 'Environment', location: 'Thane, Maharashtra', budget: 1000000, status: 'completed', description: 'Large-scale tree plantation and green cover initiative' },
    { name: 'Old Age Care Center', companyId: hdfc._id, financialYearId: fy3._id, category: 'Healthcare', location: 'Mumbai, Maharashtra', budget: 2000000, status: 'active', description: 'Care and support center for senior citizens' },
  ])

  // --- Fund Receipts (total ₹1,78,00,000) ---
  await FundReceipt.create([
    { date: '2022-04-15', companyId: tcs._id, financialYearId: fy1._id, reference: 'TCS/CSR/2022-23/001', mode: 'NEFT', carryForward: 0, amount: 2500000 },
    { date: '2023-05-10', companyId: tcs._id, financialYearId: fy2._id, reference: 'TCS/CSR/2023-24/001', mode: 'RTGS', carryForward: 280000, amount: 3500000 },
    { date: '2023-07-01', companyId: infosys._id, financialYearId: fy2._id, reference: 'INF/2023-24/SCH/001', mode: 'NEFT', carryForward: 0, amount: 1800000 },
    { date: '2023-08-05', companyId: hdfc._id, financialYearId: fy2._id, reference: 'HDFC/CSR/2023-24/TP', mode: 'Cheque', carryForward: 0, amount: 800000 },
    { date: '2024-04-20', companyId: tcs._id, financialYearId: fy3._id, reference: 'TCS/CSR/2024-25/001', mode: 'RTGS', carryForward: 0, amount: 4000000 },
    { date: '2024-06-10', companyId: infosys._id, financialYearId: fy3._id, reference: 'INF/2024-25/HC/001', mode: 'NEFT', carryForward: 0, amount: 2200000 },
    { date: '2024-07-15', companyId: hdfc._id, financialYearId: fy3._id, reference: 'HDFC/CSR/2024-25/OAC', mode: 'RTGS', carryForward: 0, amount: 3000000 },
  ])

  // --- Expenditures (total ₹1,23,00,000) ---
  await Expenditure.create([
    { date: '2022-06-20', projectId: p1._id, companyId: tcs._id, financialYearId: fy1._id, category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 800000 },
    { date: '2022-09-15', projectId: p1._id, companyId: tcs._id, financialYearId: fy1._id, category: 'Training', approvedBy: 'Executive Director', amount: 950000 },
    { date: '2023-01-20', projectId: p1._id, companyId: tcs._id, financialYearId: fy1._id, category: 'Equipment', approvedBy: 'Trustee Board', amount: 500000 },
    { date: '2023-07-20', projectId: p2._id, companyId: tcs._id, financialYearId: fy2._id, category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 1200000 },
    { date: '2023-08-15', projectId: p4._id, companyId: infosys._id, financialYearId: fy2._id, category: 'Scholarships', approvedBy: 'Trustee Board', amount: 1600000 },
    { date: '2023-09-01', projectId: p6._id, companyId: hdfc._id, financialYearId: fy2._id, category: 'Environment', approvedBy: 'Trustee Board', amount: 750000 },
    { date: '2023-11-10', projectId: p2._id, companyId: tcs._id, financialYearId: fy2._id, category: 'Infrastructure', approvedBy: 'Executive Director', amount: 1800000 },
    { date: '2024-01-15', projectId: p2._id, companyId: tcs._id, financialYearId: fy2._id, category: 'Training', approvedBy: 'Executive Director', amount: 220000 },
    { date: '2024-05-30', projectId: p3._id, companyId: tcs._id, financialYearId: fy3._id, category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 900000 },
    { date: '2024-07-12', projectId: p3._id, companyId: tcs._id, financialYearId: fy3._id, category: 'Training', approvedBy: 'Executive Director', amount: 650000 },
    { date: '2024-08-22', projectId: p5._id, companyId: infosys._id, financialYearId: fy3._id, category: 'Equipment', approvedBy: 'Trustee Board', amount: 730000 },
    { date: '2024-09-18', projectId: p5._id, companyId: infosys._id, financialYearId: fy3._id, category: 'Training', approvedBy: 'Executive Director', amount: 500000 },
    { date: '2024-10-05', projectId: p7._id, companyId: hdfc._id, financialYearId: fy3._id, category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 1000000 },
    { date: '2024-11-28', projectId: p7._id, companyId: hdfc._id, financialYearId: fy3._id, category: 'Equipment', approvedBy: 'Trustee Board', amount: 700000 },
  ])

  console.log('✅ Seed complete:')
  console.log('   Admin —', env.SEED_ADMIN_EMAIL)
  console.log('   User  —', env.SEED_USER_EMAIL)
}
