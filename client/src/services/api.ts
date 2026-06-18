import axios from 'axios'

// Axios instance for the Express API.
// withCredentials sends the httpOnly auth cookie on every request.
//
// Base URL resolution:
//  - Dev: leave VITE_API_URL unset -> baseURL '/api', which Vite proxies to
//    http://localhost:5000 (see vite.config.ts).
//  - Split-domain prod (e.g. frontend on static host, backend on Railway):
//    set VITE_API_URL to the backend origin, e.g. https://xxx.up.railway.app
//    The '/api' suffix is appended automatically.
const apiOrigin = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')
export const api = axios.create({
  baseURL: apiOrigin ? `${apiOrigin}/api` : '/api',
  withCredentials: true,
})

// Bearer-token fallback for split-domain deploys (frontend and API on different
// hosts). The httpOnly cookie still works same-origin, but third-party cookies
// can be blocked by the browser; storing the token and sending it as an
// Authorization header keeps login working everywhere.
const TOKEN_KEY = 'csr_token'
export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Toggle the data source: set VITE_USE_API=true (and run the backend) for live data.
// Default (unset) uses the in-memory mock so the client runs standalone.
export const USE_API = import.meta.env.VITE_USE_API === 'true'
