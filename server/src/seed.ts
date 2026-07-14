import bcrypt from 'bcryptjs'
import { env, isProd } from './config/env.js'
import { User } from './models/User.js'
import { Company } from './models/Company.js'
import { FinancialYear } from './models/FinancialYear.js'
import { Project } from './models/Project.js'
import { FundReceipt } from './models/FundReceipt.js'
import { Expenditure } from './models/Expenditure.js'
import { AuditLog } from './models/AuditLog.js'
import { MasterDataItem } from './models/MasterDataItem.js'
import { SCHEDULE_VII } from './data/scheduleVII.js'

// Same dataset as the frontend mocks — totals match the reference images exactly.
// Assumes an active mongoose connection (caller connects/disconnects).
export async function seedDatabase() {
  // `SEED_ADMIN_PASSWORD` falls back to a well-known value committed to this repo.
  // That is fine locally, but seeding production with it would leave the admin
  // account publicly guessable — and seeding also wipes every collection first.
  if (isProd && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error(
      'Refusing to seed production: set SEED_ADMIN_PASSWORD to something other than the committed default.',
    )
  }

  console.log('Clearing collections…')
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    FinancialYear.deleteMany({}),
    Project.deleteMany({}),
    FundReceipt.deleteMany({}),
    Expenditure.deleteMany({}),
    AuditLog.deleteMany({}),
    MasterDataItem.deleteMany({}),
  ])

  // --- Companies ---
  const [hdfc, infosys, tcs] = await Company.create([
    { name: 'HDFC Bank CSR Trust', cin: 'U65920MH1994PLC080618', pan: 'AAACH2702H', contactPerson: 'Nandita Taneja', email: 'csrtrust@hdfc.com', phone: '+91-22-66521000', address: 'HDFC Bank House, Senapati Bapat Marg, Lower Parel, Mumbai - 400013', notes: 'Long-standing CSR partner; focus on environment and elderly-care programmes.' },
    { name: 'Infosys Foundation', cin: 'U93090KA2013NPL068315', pan: 'AAAAI6743M', contactPerson: 'Sudha Murthy', email: 'foundation@infosys.com', phone: '+91-80-28520261', address: 'Infosys Foundation, Electronics City, Hosur Road, Bengaluru - 560100', notes: 'Supports education scholarships and rural healthcare initiatives.' },
    { name: 'Tata Consultancy Services Ltd', cin: 'U72200MH2004PLC153930', pan: 'AAACT2727Q', contactPerson: 'Rajesh Kumar', email: 'csr@tcs.com', phone: '+91-22-67789999', address: 'TCS House, Raveline Street, Fort, Mumbai - 400001', notes: 'Primary donor for digital-literacy and skill-development programmes.' },
  ])

  // --- Users (passwords hashed with bcrypt, cost 12) ---
  // ONLY the admin account is seeded (created here, never via the API). The admin
  // creates real editor/viewer accounts from the Admin Panel — no demo logins.
  await User.create({
    name: 'CSR Administrator',
    email: env.SEED_ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12),
    role: 'admin',
  })

  // --- Financial Years ---
  const [fy1, fy2, fy3] = await FinancialYear.create([
    { name: 'FY 2022-23', startDate: '2022-04-01', endDate: '2023-03-31', isActive: false },
    { name: 'FY 2023-24', startDate: '2023-04-01', endDate: '2024-03-31', isActive: false },
    { name: 'FY 2024-25', startDate: '2024-04-01', endDate: '2025-03-31', isActive: true },
  ])

  // --- Projects ---
  // projectCode = first 4 letters of the name + the start year of its financial year
  // (what assignProjectCode issues at runtime). An Ongoing project runs 3 years past
  // its start FY; anything else closes with that FY.
  const ongoingEnd = '2028-03-31' // FY 2024-25 end date + 3 years
  const [p1, p2, p3, p4, p5, p6, p7] = await Project.create([
    { name: 'Digital Literacy Program', projectCode: 'DIGI2022', companyIds: [tcs._id], derivedStatus: 'other', startDate: '2022-04-15', endDate: fy1.endDate, category: 'Education & Livelihood', location: 'Pune, Maharashtra', budget: 2500000, status: 'completed', description: 'Training rural youth in digital skills and computer usage' },
    { name: 'Clean Water Initiative', projectCode: 'CLEA2023', companyIds: [tcs._id], derivedStatus: 'other', startDate: '2023-05-10', endDate: fy2.endDate, category: 'Hunger, Health & Sanitation', location: 'Nagpur District', budget: 3500000, status: 'completed', description: 'Installation of water purification systems in 10 villages' },
    { name: 'Women Empowerment Program', projectCode: 'WOME2024', companyIds: [tcs._id], derivedStatus: 'ongoing', startDate: '2024-04-20', endDate: ongoingEnd, category: 'Gender Equality & Women Empowerment', location: 'Nashik, Maharashtra', budget: 4000000, status: 'active', interventionPartner: 'Pragati Rural Foundation', description: 'Skill development for rural women entrepreneurs' },
    { name: 'BridgeIT Scholarship', projectCode: 'BRID2023', companyIds: [infosys._id], derivedStatus: 'other', startDate: '2023-07-01', endDate: fy2.endDate, category: 'Education & Livelihood', location: 'Bengaluru, Karnataka', budget: 1800000, status: 'completed', description: 'Scholarships for underprivileged students in STEM' },
    { name: 'Rural Healthcare Camp', projectCode: 'RURA2024', companyIds: [infosys._id], derivedStatus: 'ongoing', startDate: '2024-06-10', endDate: ongoingEnd, category: 'Hunger, Health & Sanitation', location: 'Mysuru District, Karnataka', budget: 2200000, status: 'active', interventionPartner: 'Sneha Health Trust', description: 'Free healthcare services and medicine distribution' },
    { name: 'Tree Plantation Drive', projectCode: 'TREE2023', companyIds: [hdfc._id], derivedStatus: 'other', startDate: '2023-08-05', endDate: fy2.endDate, category: 'Environmental Sustainability', location: 'Thane, Maharashtra', budget: 1000000, status: 'completed', description: 'Large-scale tree plantation and green cover initiative' },
    { name: 'Old Age Care Center', projectCode: 'OLDA2024', companyIds: [hdfc._id], derivedStatus: 'ongoing', startDate: '2024-07-15', endDate: ongoingEnd, category: 'Gender Equality & Women Empowerment', location: 'Mumbai, Maharashtra', budget: 2000000, status: 'active', description: 'Care and support center for senior citizens' },
  ])

  // --- Fund Receipts (total ₹1,78,00,000) ---
  // Each receipt names the project it funds. That link is what makes a project's carry
  // forward computable: money received against it, minus what has been spent on it.
  await FundReceipt.create([
    { date: '2022-04-15', companyId: tcs._id, projectId: p1._id, financialYearId: fy1._id, reference: 'TCS/CSR/2022-23/001', mode: 'NEFT', amount: 2500000 },
    { date: '2023-05-10', companyId: tcs._id, projectId: p2._id, financialYearId: fy2._id, reference: 'TCS/CSR/2023-24/001', mode: 'RTGS', amount: 3500000 },
    { date: '2023-07-01', companyId: infosys._id, projectId: p4._id, financialYearId: fy2._id, reference: 'INF/2023-24/SCH/001', mode: 'NEFT', amount: 1800000 },
    { date: '2023-08-05', companyId: hdfc._id, projectId: p6._id, financialYearId: fy2._id, reference: 'HDFC/CSR/2023-24/TP', mode: 'Cheque', amount: 800000 },
    { date: '2024-04-20', companyId: tcs._id, projectId: p3._id, financialYearId: fy3._id, reference: 'TCS/CSR/2024-25/001', mode: 'RTGS', amount: 4000000 },
    { date: '2024-06-10', companyId: infosys._id, projectId: p5._id, financialYearId: fy3._id, reference: 'INF/2024-25/HC/001', mode: 'NEFT', amount: 2200000 },
    { date: '2024-07-15', companyId: hdfc._id, projectId: p7._id, financialYearId: fy3._id, reference: 'HDFC/CSR/2024-25/OAC', mode: 'RTGS', amount: 3000000 },
  ])

  // --- Expenditures (total ₹1,23,00,000) ---
  await Expenditure.create([
    { date: '2022-06-20', projectId: p1._id, companyId: tcs._id, financialYearId: fy1._id, natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 800000, description: 'Setting up village learning centres' },
    { date: '2022-09-15', projectId: p1._id, companyId: tcs._id, financialYearId: fy1._id, natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 950000, description: 'Trainer fees and course material' },
    { date: '2023-01-20', projectId: p1._id, companyId: tcs._id, financialYearId: fy1._id, natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 500000, description: 'Computer lab for the Pune centre', capitalAsset: { particulars: '25 desktop computers and networking equipment', address: 'Zilla Parishad School, Hadapsar', district: 'Pune', state: 'Maharashtra', pinCode: '411028', dateOfCreation: '2023-01-20' } },
    { date: '2023-07-20', projectId: p2._id, companyId: tcs._id, financialYearId: fy2._id, natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 1200000, description: 'Water purification units', capitalAsset: { particulars: '10 reverse-osmosis water purification units', address: 'Kalmeshwar Block, Village Cluster 4', district: 'Nagpur', state: 'Maharashtra', pinCode: '441501', dateOfCreation: '2023-07-20' } },
    { date: '2023-08-15', projectId: p4._id, companyId: infosys._id, financialYearId: fy2._id, natureOfExpense: 'project_intervention', fundingRoute: 'intervention_partner', approvedBy: 'Trustee Board', amount: 1600000, description: 'Scholarship disbursal to 320 students' },
    { date: '2023-09-01', projectId: p6._id, companyId: hdfc._id, financialYearId: fy2._id, natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 750000, description: 'Saplings, plantation labour and 1-year upkeep' },
    { date: '2023-11-10', projectId: p2._id, companyId: tcs._id, financialYearId: fy2._id, natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 1800000, description: 'Pipeline laying and village distribution points' },
    { date: '2024-01-15', projectId: p2._id, companyId: tcs._id, financialYearId: fy2._id, natureOfExpense: 'administrative_overheads', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 220000, description: 'Programme administration for the year' },
    { date: '2024-05-30', projectId: p3._id, companyId: tcs._id, financialYearId: fy3._id, natureOfExpense: 'project_intervention', fundingRoute: 'intervention_partner', approvedBy: 'Trustee Board', amount: 900000, description: 'Tailoring and food-processing skill batches' },
    { date: '2024-07-12', projectId: p3._id, companyId: tcs._id, financialYearId: fy3._id, natureOfExpense: 'impact_assessment', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 650000, description: 'Independent impact assessment of batch 1' },
    { date: '2024-08-22', projectId: p5._id, companyId: infosys._id, financialYearId: fy3._id, natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 730000, description: 'Mobile health unit', capitalAsset: { particulars: 'Mobile medical van with diagnostic equipment', address: 'Primary Health Centre, T. Narasipura Road', district: 'Mysuru', state: 'Karnataka', pinCode: '571124', dateOfCreation: '2024-08-22' } },
    { date: '2024-09-18', projectId: p5._id, companyId: infosys._id, financialYearId: fy3._id, natureOfExpense: 'project_intervention', fundingRoute: 'intervention_partner', approvedBy: 'Executive Director', amount: 500000, description: 'Medicines and camp staffing' },
    { date: '2024-10-05', projectId: p7._id, companyId: hdfc._id, financialYearId: fy3._id, natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 1000000, description: 'Day-care wing construction', capitalAsset: { particulars: 'Day-care wing — 12-bed senior citizen facility', address: 'Plot 14, Sector 3, Charkop, Kandivali West', district: 'Mumbai Suburban', state: 'Maharashtra', pinCode: '400067', dateOfCreation: '2024-10-05' } },
    { date: '2024-11-28', projectId: p7._id, companyId: hdfc._id, financialYearId: fy3._id, natureOfExpense: 'other', otherNature: 'Furniture and fixtures', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 700000, description: 'Beds, seating and kitchen fit-out' },
  ])

  // --- Master Data (dropdown lists used on Projects/Expenditures/Fund Receipts) ---
  // Categories are the statutory Schedule VII activity heads: a short label to pick
  // from, with the full clause as the description.
  await MasterDataItem.create([
    ...SCHEDULE_VII.map((c) => ({ type: 'category', value: c.value, description: c.description })),
    { type: 'status', value: 'Active' },
    { type: 'status', value: 'Not Active' },
    { type: 'source', value: 'Interest' },
    { type: 'source', value: 'SIP' },
    { type: 'source', value: 'FD' },
    { type: 'source', value: 'Bank Deposit' },
  ])

  console.log('✅ Seed complete (sample data + admin only):')
  console.log('   Admin —', env.SEED_ADMIN_EMAIL, '/', isProd ? '(from SEED_ADMIN_PASSWORD)' : env.SEED_ADMIN_PASSWORD)
}
