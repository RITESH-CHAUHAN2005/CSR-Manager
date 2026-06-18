import axios from 'axios'

// Axios instance for the Express API.
// withCredentials sends the httpOnly auth cookie on every request.
// Vite proxies /api -> http://localhost:5000 in dev (see vite.config.ts).
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// Toggle the data source: set VITE_USE_API=true (and run the backend) for live data.
// Default (unset) uses the in-memory mock so the client runs standalone.
export const USE_API = import.meta.env.VITE_USE_API === 'true'
