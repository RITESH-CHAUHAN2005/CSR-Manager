// Seed data reconstructed exactly from the reference images so every total matches:
//  - Total Received  ₹1,78,00,000
//  - Total Expenditure ₹1,23,00,000
//  - Per-company & per-year figures, reference codes (OAC=Old Age Care, TP=Tree Plantation, etc.)
// This same dataset is loaded into MongoDB by the backend seed script (Phase 3).

import type {
  Company,
  Expenditure,
  FinancialYear,
  FundReceipt,
  Project,
} from '../types'

export const companies: Company[] = [
  {
    id: 'c1',
    name: 'HDFC Bank CSR Trust',
    cin: 'U65920MH1994PLC080618',
    pan: 'AAACH2702H',
    contactPerson: 'Nandita Taneja',
    email: 'csrtrust@hdfc.com',
    phone: '+91-22-66521000',
    address: 'HDFC Bank House, Senapati Bapat Marg, Lower Parel, Mumbai - 400013',
    notes: 'Long-standing CSR partner; focus on environment and elderly-care programmes.',
  },
  {
    id: 'c2',
    name: 'Infosys Foundation',
    cin: 'U93090KA2013NPL068315',
    pan: 'AAAAI6743M',
    contactPerson: 'Sudha Murthy',
    email: 'foundation@infosys.com',
    phone: '+91-80-28520261',
    address: 'Infosys Foundation, Electronics City, Hosur Road, Bengaluru - 560100',
    notes: 'Supports education scholarships and rural healthcare initiatives.',
  },
  {
    id: 'c3',
    name: 'Tata Consultancy Services Ltd',
    cin: 'U72200MH2004PLC153930',
    pan: 'AAACT2727Q',
    contactPerson: 'Rajesh Kumar',
    email: 'csr@tcs.com',
    phone: '+91-22-67789999',
    address: 'TCS House, Raveline Street, Fort, Mumbai - 400001',
    notes: 'Primary donor for digital-literacy and skill-development programmes.',
  },
]

export const financialYears: FinancialYear[] = [
  { id: 'fy_2020', name: 'FY 2020-21', startDate: '2020-04-01', endDate: '2021-03-31', isActive: false },
  { id: 'fy_2021', name: 'FY 2021-22', startDate: '2021-04-01', endDate: '2022-03-31', isActive: false },
  { id: 'fy1', name: 'FY 2022-23', startDate: '2022-04-01', endDate: '2023-03-31', isActive: false },
  { id: 'fy2', name: 'FY 2023-24', startDate: '2023-04-01', endDate: '2024-03-31', isActive: false },
  { id: 'fy3', name: 'FY 2024-25', startDate: '2024-04-01', endDate: '2025-03-31', isActive: false },
  { id: 'fy_2025', name: 'FY 2025-26', startDate: '2025-04-01', endDate: '2026-03-31', isActive: false },
  { id: 'fy_2026', name: 'FY 2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isActive: true },
]

// projectCode = 4 letters of the name + the start year of its FY (what the server
// issues). Ongoing runs 3 years past its start FY; anything else closes with that FY.
export const projects: Project[] = [
  {
    id: 'p1',
    name: 'Digital Literacy Program',
    projectCode: 'DIGI2022',
    companyIds: ['c3'],
    derivedStatus: 'other',
    startDate: '2022-04-15',
    endDate: '2023-03-31',
    category: 'Education & Livelihood',
    location: 'Pune, Maharashtra',
    budget: 2500000,
    status: 'completed',
    description: 'Training rural youth in digital skills and computer usage',
  },
  {
    id: 'p2',
    name: 'Clean Water Initiative',
    projectCode: 'CLEA2023',
    companyIds: ['c3'],
    derivedStatus: 'other',
    startDate: '2023-05-10',
    endDate: '2024-03-31',
    category: 'Hunger, Health & Sanitation',
    location: 'Nagpur District',
    budget: 3500000,
    status: 'completed',
    description: 'Installation of water purification systems in 10 villages',
  },
  {
    id: 'p3',
    name: 'Women Empowerment Program',
    projectCode: 'WOME2024',
    companyIds: ['c3'],
    derivedStatus: 'ongoing',
    startDate: '2024-04-20',
    endDate: '2028-03-31',
    category: 'Gender Equality & Women Empowerment',
    location: 'Nashik, Maharashtra',
    interventionPartner: 'Pragati Rural Foundation',
    budget: 4000000,
    status: 'active',
    description: 'Skill development for rural women entrepreneurs',
  },
  {
    id: 'p4',
    name: 'BridgeIT Scholarship',
    projectCode: 'BRID2023',
    companyIds: ['c2'],
    derivedStatus: 'other',
    startDate: '2023-07-01',
    endDate: '2024-03-31',
    category: 'Education & Livelihood',
    location: 'Bengaluru, Karnataka',
    budget: 1800000,
    status: 'completed',
    description: 'Scholarships for underprivileged students in STEM',
  },
  {
    id: 'p5',
    name: 'Rural Healthcare Camp',
    projectCode: 'RURA2024',
    companyIds: ['c2'],
    derivedStatus: 'ongoing',
    startDate: '2024-06-10',
    endDate: '2028-03-31',
    category: 'Hunger, Health & Sanitation',
    location: 'Mysuru District, Karnataka',
    interventionPartner: 'Sneha Health Trust',
    budget: 2200000,
    status: 'active',
    description: 'Free healthcare services and medicine distribution',
  },
  {
    id: 'p6',
    name: 'Tree Plantation Drive',
    projectCode: 'TREE2023',
    companyIds: ['c1'],
    derivedStatus: 'other',
    startDate: '2023-08-05',
    endDate: '2024-03-31',
    category: 'Environmental Sustainability',
    location: 'Thane, Maharashtra',
    budget: 1000000,
    status: 'completed',
    description: 'Large-scale tree plantation and green cover initiative',
  },
  {
    id: 'p7',
    name: 'Old Age Care Center',
    projectCode: 'OLDA2024',
    companyIds: ['c1'],
    derivedStatus: 'ongoing',
    startDate: '2024-07-15',
    endDate: '2028-03-31',
    category: 'Gender Equality & Women Empowerment',
    location: 'Mumbai, Maharashtra',
    budget: 2000000,
    status: 'active',
    description: 'Care and support center for senior citizens',
  },
]

// Each receipt names the project it funds — that link is what makes a project's carry
// forward computable (received against it, minus spent on it).
export const fundReceipts: FundReceipt[] = [
  { id: 'r1', date: '2022-04-15', receiptType: 'company', companyId: 'c3', projectId: 'p1', financialYearId: 'fy1', reference: 'TCS/CSR/2022-23/001', mode: 'NEFT', amount: 2500000 },
  { id: 'r2', date: '2023-05-10', receiptType: 'company', companyId: 'c3', projectId: 'p2', financialYearId: 'fy2', reference: 'TCS/CSR/2023-24/001', mode: 'RTGS', amount: 3500000 },
  { id: 'r3', date: '2023-07-01', receiptType: 'company', companyId: 'c2', projectId: 'p4', financialYearId: 'fy2', reference: 'INF/2023-24/SCH/001', mode: 'NEFT', amount: 1800000 },
  { id: 'r4', date: '2023-08-05', receiptType: 'company', companyId: 'c1', projectId: 'p6', financialYearId: 'fy2', reference: 'HDFC/CSR/2023-24/TP', mode: 'Cheque', amount: 800000 },
  { id: 'r5', date: '2024-04-20', receiptType: 'company', companyId: 'c3', projectId: 'p3', financialYearId: 'fy3', reference: 'TCS/CSR/2024-25/001', mode: 'RTGS', amount: 4000000 },
  { id: 'r6', date: '2024-06-10', receiptType: 'company', companyId: 'c2', projectId: 'p5', financialYearId: 'fy3', reference: 'INF/2024-25/HC/001', mode: 'NEFT', amount: 2200000 },
  { id: 'r7', date: '2024-07-15', receiptType: 'company', companyId: 'c1', projectId: 'p7', financialYearId: 'fy3', reference: 'HDFC/CSR/2024-25/OAC', mode: 'RTGS', amount: 3000000 },
]

export const expenditures: Expenditure[] = [
  // FY 2022-23 — total ₹22,50,000 (Digital Literacy Program, TCS)
  { id: 'e1', date: '2022-06-20', projectId: 'p1', companyId: 'c3', financialYearId: 'fy1', natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 800000, description: 'Setting up village learning centres' },
  { id: 'e2', date: '2022-09-15', projectId: 'p1', companyId: 'c3', financialYearId: 'fy1', natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 950000, description: 'Trainer fees and course material' },
  { id: 'e3', date: '2023-01-20', projectId: 'p1', companyId: 'c3', financialYearId: 'fy1', natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 500000, description: 'Computer lab for the Pune centre', capitalAsset: { particulars: '25 desktop computers and networking equipment', address: 'Zilla Parishad School, Hadapsar', district: 'Pune', state: 'Maharashtra', pinCode: '411028', dateOfCreation: '2023-01-20' } },
  // FY 2023-24 — total ₹55,70,000
  { id: 'e4', date: '2023-07-20', projectId: 'p2', companyId: 'c3', financialYearId: 'fy2', natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 1200000, description: 'Water purification units', capitalAsset: { particulars: '10 reverse-osmosis water purification units', address: 'Kalmeshwar Block, Village Cluster 4', district: 'Nagpur', state: 'Maharashtra', pinCode: '441501', dateOfCreation: '2023-07-20' } },
  { id: 'e5', date: '2023-08-15', projectId: 'p4', companyId: 'c2', financialYearId: 'fy2', natureOfExpense: 'project_intervention', fundingRoute: 'intervention_partner', approvedBy: 'Trustee Board', amount: 1600000, description: 'Scholarship disbursal to 320 students' },
  { id: 'e6', date: '2023-09-01', projectId: 'p6', companyId: 'c1', financialYearId: 'fy2', natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 750000, description: 'Saplings, plantation labour and 1-year upkeep' },
  { id: 'e7', date: '2023-11-10', projectId: 'p2', companyId: 'c3', financialYearId: 'fy2', natureOfExpense: 'project_intervention', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 1800000, description: 'Pipeline laying and village distribution points' },
  { id: 'e8', date: '2024-01-15', projectId: 'p2', companyId: 'c3', financialYearId: 'fy2', natureOfExpense: 'administrative_overheads', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 220000, description: 'Programme administration for the year' },
  // FY 2024-25 — total ₹44,80,000
  { id: 'e9', date: '2024-05-30', projectId: 'p3', companyId: 'c3', financialYearId: 'fy3', natureOfExpense: 'project_intervention', fundingRoute: 'intervention_partner', approvedBy: 'Trustee Board', amount: 900000, description: 'Tailoring and food-processing skill batches' },
  { id: 'e10', date: '2024-07-12', projectId: 'p3', companyId: 'c3', financialYearId: 'fy3', natureOfExpense: 'impact_assessment', fundingRoute: 'direct', approvedBy: 'Executive Director', amount: 650000, description: 'Independent impact assessment of batch 1' },
  { id: 'e11', date: '2024-08-22', projectId: 'p5', companyId: 'c2', financialYearId: 'fy3', natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 730000, description: 'Mobile health unit', capitalAsset: { particulars: 'Mobile medical van with diagnostic equipment', address: 'Primary Health Centre, T. Narasipura Road', district: 'Mysuru', state: 'Karnataka', pinCode: '571124', dateOfCreation: '2024-08-22' } },
  { id: 'e12', date: '2024-09-18', projectId: 'p5', companyId: 'c2', financialYearId: 'fy3', natureOfExpense: 'project_intervention', fundingRoute: 'intervention_partner', approvedBy: 'Executive Director', amount: 500000, description: 'Medicines and camp staffing' },
  { id: 'e13', date: '2024-10-05', projectId: 'p7', companyId: 'c1', financialYearId: 'fy3', natureOfExpense: 'capital_asset', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 1000000, description: 'Day-care wing construction', capitalAsset: { particulars: 'Day-care wing — 12-bed senior citizen facility', address: 'Plot 14, Sector 3, Charkop, Kandivali West', district: 'Mumbai Suburban', state: 'Maharashtra', pinCode: '400067', dateOfCreation: '2024-10-05' } },
  { id: 'e14', date: '2024-11-28', projectId: 'p7', companyId: 'c1', financialYearId: 'fy3', natureOfExpense: 'other', otherNature: 'Furniture and fixtures', fundingRoute: 'direct', approvedBy: 'Trustee Board', amount: 700000, description: 'Beds, seating and kitchen fit-out' },
]

// Demo credentials for the login screen (mock mode). The live API uses real JWT auth
// against the seeded MongoDB accounts (same emails/passwords).
export const demoUsers = [
  { email: 'admin@csr.com', password: 'Admin@123', role: 'admin' as const, name: 'CSR Administrator' },
  { email: 'editor@csr.com', password: 'Editor@123', role: 'editor' as const, name: 'CSR Editor' },
  { email: 'viewer@csr.com', password: 'Viewer@123', role: 'viewer' as const, name: 'CSR Viewer' },
]
