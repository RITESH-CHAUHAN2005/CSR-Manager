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
    contactPerson: 'Nandita Taneja',
    email: 'csrtrust@hdfc.com',
    phone: '+91-22-66521000',
  },
  {
    id: 'c2',
    name: 'Infosys Foundation',
    cin: 'U93090KA2013NPL068315',
    contactPerson: 'Sudha Murthy',
    email: 'foundation@infosys.com',
    phone: '+91-80-28520261',
  },
  {
    id: 'c3',
    name: 'Tata Consultancy Services Ltd',
    cin: 'U72200MH2004PLC153930',
    contactPerson: 'Rajesh Kumar',
    email: 'csr@tcs.com',
    phone: '+91-22-67789999',
  },
]

export const financialYears: FinancialYear[] = [
  { id: 'fy1', name: 'FY 2022-23', startDate: '2022-04-01', endDate: '2023-03-31', isActive: false },
  { id: 'fy2', name: 'FY 2023-24', startDate: '2023-04-01', endDate: '2024-03-31', isActive: false },
  { id: 'fy3', name: 'FY 2024-25', startDate: '2024-04-01', endDate: '2025-03-31', isActive: true },
]

export const projects: Project[] = [
  {
    id: 'p1',
    name: 'Digital Literacy Program',
    companyId: 'c3',
    financialYearId: 'fy1',
    category: 'Education',
    location: 'Pune, Maharashtra',
    budget: 2500000,
    status: 'completed',
    description: 'Training rural youth in digital skills and computer usage',
  },
  {
    id: 'p2',
    name: 'Clean Water Initiative',
    companyId: 'c3',
    financialYearId: 'fy2',
    category: 'Environment',
    location: 'Nagpur District',
    budget: 3500000,
    status: 'completed',
    description: 'Installation of water purification systems in 10 villages',
  },
  {
    id: 'p3',
    name: 'Women Empowerment Program',
    companyId: 'c3',
    financialYearId: 'fy3',
    category: 'Skill Development',
    location: 'Nashik, Maharashtra',
    budget: 4000000,
    status: 'active',
    description: 'Skill development for rural women entrepreneurs',
  },
  {
    id: 'p4',
    name: 'BridgeIT Scholarship',
    companyId: 'c2',
    financialYearId: 'fy2',
    category: 'Education',
    location: 'Bengaluru, Karnataka',
    budget: 1800000,
    status: 'completed',
    description: 'Scholarships for underprivileged students in STEM',
  },
  {
    id: 'p5',
    name: 'Rural Healthcare Camp',
    companyId: 'c2',
    financialYearId: 'fy3',
    category: 'Healthcare',
    location: 'Mysuru District, Karnataka',
    budget: 2200000,
    status: 'active',
    description: 'Free healthcare services and medicine distribution',
  },
  {
    id: 'p6',
    name: 'Tree Plantation Drive',
    companyId: 'c1',
    financialYearId: 'fy2',
    category: 'Environment',
    location: 'Thane, Maharashtra',
    budget: 1000000,
    status: 'completed',
    description: 'Large-scale tree plantation and green cover initiative',
  },
  {
    id: 'p7',
    name: 'Old Age Care Center',
    companyId: 'c1',
    financialYearId: 'fy3',
    category: 'Healthcare',
    location: 'Mumbai, Maharashtra',
    budget: 2000000,
    status: 'active',
    description: 'Care and support center for senior citizens',
  },
]

export const fundReceipts: FundReceipt[] = [
  { id: 'r1', date: '2022-04-15', companyId: 'c3', financialYearId: 'fy1', reference: 'TCS/CSR/2022-23/001', mode: 'NEFT', carryForward: 0, amount: 2500000 },
  { id: 'r2', date: '2023-05-10', companyId: 'c3', financialYearId: 'fy2', reference: 'TCS/CSR/2023-24/001', mode: 'RTGS', carryForward: 280000, amount: 3500000 },
  { id: 'r3', date: '2023-07-01', companyId: 'c2', financialYearId: 'fy2', reference: 'INF/2023-24/SCH/001', mode: 'NEFT', carryForward: 0, amount: 1800000 },
  { id: 'r4', date: '2023-08-05', companyId: 'c1', financialYearId: 'fy2', reference: 'HDFC/CSR/2023-24/TP', mode: 'Cheque', carryForward: 0, amount: 800000 },
  { id: 'r5', date: '2024-04-20', companyId: 'c3', financialYearId: 'fy3', reference: 'TCS/CSR/2024-25/001', mode: 'RTGS', carryForward: 0, amount: 4000000 },
  { id: 'r6', date: '2024-06-10', companyId: 'c2', financialYearId: 'fy3', reference: 'INF/2024-25/HC/001', mode: 'NEFT', carryForward: 0, amount: 2200000 },
  { id: 'r7', date: '2024-07-15', companyId: 'c1', financialYearId: 'fy3', reference: 'HDFC/CSR/2024-25/OAC', mode: 'RTGS', carryForward: 0, amount: 3000000 },
]

export const expenditures: Expenditure[] = [
  // FY 2022-23 — total ₹22,50,000 (Digital Literacy Program, TCS)
  { id: 'e1', date: '2022-06-20', projectId: 'p1', companyId: 'c3', financialYearId: 'fy1', category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 800000 },
  { id: 'e2', date: '2022-09-15', projectId: 'p1', companyId: 'c3', financialYearId: 'fy1', category: 'Training', approvedBy: 'Executive Director', amount: 950000 },
  { id: 'e3', date: '2023-01-20', projectId: 'p1', companyId: 'c3', financialYearId: 'fy1', category: 'Equipment', approvedBy: 'Trustee Board', amount: 500000 },
  // FY 2023-24 — total ₹55,70,000
  { id: 'e4', date: '2023-07-20', projectId: 'p2', companyId: 'c3', financialYearId: 'fy2', category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 1200000 },
  { id: 'e5', date: '2023-08-15', projectId: 'p4', companyId: 'c2', financialYearId: 'fy2', category: 'Scholarships', approvedBy: 'Trustee Board', amount: 1600000 },
  { id: 'e6', date: '2023-09-01', projectId: 'p6', companyId: 'c1', financialYearId: 'fy2', category: 'Environment', approvedBy: 'Trustee Board', amount: 750000 },
  { id: 'e7', date: '2023-11-10', projectId: 'p2', companyId: 'c3', financialYearId: 'fy2', category: 'Infrastructure', approvedBy: 'Executive Director', amount: 1800000 },
  { id: 'e8', date: '2024-01-15', projectId: 'p2', companyId: 'c3', financialYearId: 'fy2', category: 'Training', approvedBy: 'Executive Director', amount: 220000 },
  // FY 2024-25 — total ₹44,80,000
  { id: 'e9', date: '2024-05-30', projectId: 'p3', companyId: 'c3', financialYearId: 'fy3', category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 900000 },
  { id: 'e10', date: '2024-07-12', projectId: 'p3', companyId: 'c3', financialYearId: 'fy3', category: 'Training', approvedBy: 'Executive Director', amount: 650000 },
  { id: 'e11', date: '2024-08-22', projectId: 'p5', companyId: 'c2', financialYearId: 'fy3', category: 'Equipment', approvedBy: 'Trustee Board', amount: 730000 },
  { id: 'e12', date: '2024-09-18', projectId: 'p5', companyId: 'c2', financialYearId: 'fy3', category: 'Training', approvedBy: 'Executive Director', amount: 500000 },
  { id: 'e13', date: '2024-10-05', projectId: 'p7', companyId: 'c1', financialYearId: 'fy3', category: 'Infrastructure', approvedBy: 'Trustee Board', amount: 1000000 },
  { id: 'e14', date: '2024-11-28', projectId: 'p7', companyId: 'c1', financialYearId: 'fy3', category: 'Equipment', approvedBy: 'Trustee Board', amount: 700000 },
]

// Demo credentials for the login screen (Phase 4 replaces with real JWT auth).
export const demoUsers = [
  { email: 'admin@csr.com', password: 'Admin@123', role: 'admin' as const, name: 'CSR Administrator' },
  { email: 'user@csr.com', password: 'User@123', role: 'user' as const, name: 'CSR Viewer' },
]
