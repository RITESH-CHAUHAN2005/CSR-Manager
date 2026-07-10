// Standalone Hostinger static-site deploy — replicates hostinger-api-mcp's
// handleStaticWebsiteDeploy flow using the NEW API token directly (no MCP restart
// needed). Run:  node deploy-hostinger.mjs
// It will: resolve username -> fetch upload creds -> TUS-upload the archive ->
// trigger deploy/extract into public_html.
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'

const NM = 'C:/Users/Administrator/AppData/Local/npm-cache/_npx/d0cc975fc42cbc0b/node_modules'
const require = createRequire(NM + '/')
const axios = require('axios')
const tus = require('tus-js-client')

const TOKEN = process.env.HOSTINGER_API_TOKEN
const DOMAIN = process.env.HOSTINGER_DOMAIN || 'wheat-aardvark-709394.hostingersite.com'
// Path to the built client tarball. Pass as argv[2] or CSR_ARCHIVE — the old
// hard-coded scratchpad path was gone the moment that session ended.
const ARCHIVE = process.argv[2] || process.env.CSR_ARCHIVE
if (!ARCHIVE) { console.error('Usage: node deploy-hostinger.mjs <path-to-dist.tar.gz>'); process.exit(1) }
const BASE = 'https://developers.hostinger.com/'
if (!TOKEN) { console.error('Set HOSTINGER_API_TOKEN env var'); process.exit(1) }
const H = { Authorization: `Bearer ${TOKEN}` }

const log = (...a) => console.log('[deploy]', ...a)

async function resolveUsername() {
  const url = new URL(`api/hosting/v1/websites?domain=${encodeURIComponent(DOMAIN)}`, BASE).toString()
  const r = await axios.get(url, { headers: H, timeout: 60000 })
  const site = r.data?.data?.find((w) => w.domain === DOMAIN) || r.data?.data?.[0]
  if (!site?.username) throw new Error('username not resolved')
  return site.username
}

async function fetchUploadCreds(username) {
  const url = new URL('api/hosting/v1/files/upload-urls', BASE).toString()
  const r = await axios.post(url, { username, domain: DOMAIN }, {
    headers: { ...H, 'Content-Type': 'application/json' }, timeout: 60000,
    validateStatus: (s) => s < 500,
  })
  if (r.status !== 200) throw new Error(`upload-urls status ${r.status}: ${JSON.stringify(r.data)}`)
  return r.data
}

function uploadFile(filePath, relativePath, uploadUrl, authRestToken, authToken) {
  return new Promise(async (resolve, reject) => {
    const stats = fs.statSync(filePath)
    const cleanUrl = uploadUrl.replace(/\/$/, '')
    const target = `${cleanUrl}/${relativePath}?override=true`
    const headers = {
      'X-Auth': authToken, 'X-Auth-Rest': authRestToken,
      'upload-length': String(stats.size), 'upload-offset': '0',
    }
    log('pre-upload POST', target)
    try {
      await axios.post(target, '', { headers, timeout: 60000, validateStatus: (s) => s === 201 })
    } catch (e) {
      return reject(new Error(`Pre-upload failed: ${e.message}`))
    }
    log('TUS upload start (', stats.size, 'bytes )')
    const up = new tus.Upload(fs.createReadStream(filePath), {
      uploadUrl: target, retryDelays: [1000, 2000, 4000, 8000, 16000, 20000],
      uploadDataDuringCreation: false, parallelUploads: 1, chunkSize: 10485760,
      headers, removeFingerprintOnSuccess: true, uploadSize: stats.size,
      metadata: { filename: path.basename(relativePath) },
      onProgress: (a, b) => log(`  ${Math.round((a / b) * 100)}%`),
      onError: (e) => reject(new Error(`Upload failed: ${e.message}`)),
      onSuccess: () => resolve({ url: up.url }),
    })
    up.start()
  })
}

async function triggerDeploy(username, archiveBasename) {
  const url = new URL(`api/hosting/v1/accounts/${username}/websites/${DOMAIN}/deploy`, BASE).toString()
  const r = await axios.post(url, { archive_path: archiveBasename }, {
    headers: { ...H, 'Content-Type': 'application/json' }, timeout: 60000,
    validateStatus: (s) => s < 500,
  })
  if (r.status !== 200) throw new Error(`deploy status ${r.status}: ${JSON.stringify(r.data)}`)
  return r.data
}

;(async () => {
  log('archive:', ARCHIVE, fs.existsSync(ARCHIVE) ? '(exists)' : '(MISSING)')
  const username = await resolveUsername()
  log('username:', username)
  const creds = await fetchUploadCreds(username)
  log('upload host:', new URL(creds.url).host)
  const base = path.basename(ARCHIVE)
  await uploadFile(ARCHIVE, base, creds.url, creds.rest_auth_key, creds.auth_key)
  log('upload OK, triggering deploy…')
  const res = await triggerDeploy(username, base)
  log('DEPLOY TRIGGERED:', JSON.stringify(res))
  log('Done. Check https://' + DOMAIN + '/ in ~1 min.')
})().catch((e) => { console.error('[deploy] FAILED:', e.message); process.exit(1) })
