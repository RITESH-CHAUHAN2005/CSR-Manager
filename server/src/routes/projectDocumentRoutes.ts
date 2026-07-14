import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth.js'
import { requireWrite } from '../middleware/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ProjectDocument } from '../models/ProjectDocument.js'

// Documents live in MongoDB (see ProjectDocument model) rather than on disk — the
// hosting free tier has no persistent disk.
//
// There is NO limit on how many files a project can carry. The per-file size cap is not
// a policy choice and cannot be lifted: the file's bytes are a field inside the document,
// and MongoDB rejects any document over 16MB. 15MB leaves room for the metadata.
const MAX_FILE_SIZE = 15 * 1024 * 1024

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } })

function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next()
    if (typeof err === 'object' && err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(413, `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`))
    }
    next(new ApiError(400, (err as Error).message ?? 'Upload failed'))
  })
}

const router = Router({ mergeParams: true })
router.use(authenticate)

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const docs = await ProjectDocument.find({ projectId: req.params.projectId })
      .select('-data')
      .sort({ createdAt: 1 })
    res.json(docs)
  }),
)

router.post(
  '/',
  requireWrite,
  uploadSingle,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new ApiError(400, 'No file uploaded')
    const doc = await ProjectDocument.create({
      projectId: req.params.projectId,
      filename: req.file.originalname,
      mimeType: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      data: req.file.buffer,
      uploadedById: req.user?.id,
      uploadedByName: req.user?.name,
      uploadedByEmail: req.user?.email,
    })
    const json = doc.toJSON() as Record<string, unknown>
    delete json.data
    res.status(201).json(json)
  }),
)

router.get(
  '/:docId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await ProjectDocument.findOne({ _id: req.params.docId, projectId: req.params.projectId })
    if (!doc) throw new ApiError(404, 'Not found')
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream')
    // `attachment`, never `inline`: an uploaded .html/.svg rendered inline would
    // execute on the API origin, where the auth cookie lives (stored XSS).
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(doc.data)
  }),
)

router.delete(
  '/:docId',
  requireWrite,
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await ProjectDocument.findOneAndDelete({ _id: req.params.docId, projectId: req.params.projectId })
    if (!doc) throw new ApiError(404, 'Not found')
    res.json({ id: req.params.docId })
  }),
)

export default router
