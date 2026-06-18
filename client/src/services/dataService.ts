// Data-source switcher. Pages import services from here and stay agnostic to the source.
//   - Default (VITE_USE_API unset / false): in-memory mockService — client runs standalone.
//   - VITE_USE_API=true: apiService — live Express/MongoDB backend.
import { USE_API } from './api'
import * as mock from './mockService'
import * as live from './apiService'

const impl = USE_API ? live : mock

export const companyService = impl.companyService
export const financialYearService = impl.financialYearService
export const projectService = impl.projectService
export const fundReceiptService = impl.fundReceiptService
export const expenditureService = impl.expenditureService
export const analyticsService = impl.analyticsService
export const userAdminService = impl.userAdminService
export const logService = impl.logService
