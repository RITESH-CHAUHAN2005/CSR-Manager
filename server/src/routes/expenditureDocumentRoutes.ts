import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth.js'
import { requireWrite } from '../middleware/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ExpenditureDocument } from '../models/ExpenditureDocument.js'

// Mirrors projectDocumentRoutes.ts — same 5 files/8MB caps, same shape.
const MAX_DOCS_PER_EXPENDITURE = 5
const MAX_FILE_SIZE = 8 * 1024 * 1024

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
    const docs = await ExpenditureDocument.find({ expenditureId: req.params.expenditureId })
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
    const count = await ExpenditureDocument.countDocuments({ expenditureId: req.params.expenditureId })
    if (count >= MAX_DOCS_PER_EXPENDITURE) {
      throw new ApiError(409, `Maximum ${MAX_DOCS_PER_EXPENDITURE} documents per expenditure`)
    }
    const doc = await ExpenditureDocument.create({
      expenditureId: req.params.expenditureId,
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
    const doc = await ExpenditureDocument.findOne({
      _id: req.params.docId,
      expenditureId: req.params.expenditureId,
    })
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
    const doc = await ExpenditureDocument.findOneAndDelete({
      _id: req.params.docId,
      expenditureId: req.params.expenditureId,
    })
    if (!doc) throw new ApiError(404, 'Not found')
    res.json({ id: req.params.docId })
  }),
)

export default router
