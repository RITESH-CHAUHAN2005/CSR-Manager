import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { File, FileCsv, FileDoc, FileImage, FilePdf, Upload, X } from './icons'
import { getErrorMessage } from '../lib/errors'

// There is no limit on how many files a record can carry. The per-file size cap is not a
// policy choice: a file's bytes are stored inside its MongoDB document, and MongoDB
// rejects any document over 16MB — 15MB leaves room for the metadata.
export const MAX_FILE_SIZE = 15 * 1024 * 1024
const sizeLabel = `${MAX_FILE_SIZE / (1024 * 1024)}MB`

interface AttachmentMeta {
  id: string
  filename: string
  mimeType: string
}

interface AttachmentService {
  list: (parentId: string) => Promise<AttachmentMeta[]>
  upload: (parentId: string, file: File) => Promise<AttachmentMeta>
  remove: (parentId: string, docId: string) => Promise<unknown>
  downloadUrl: (parentId: string, docId: string) => string
}

// Icon by mime type — images get an actual thumbnail, everything else a file-type glyph.
export function DocIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <FileImage size={22} />
  if (mimeType === 'application/pdf') return <FilePdf size={22} />
  if (mimeType.includes('csv') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileCsv size={22} />
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileDoc size={22} />
  return <File size={22} />
}

// Row of document cards — as many files of any type as the user wants against a given
// parent record (a Project, a Receipt or an Expenditure). Editor/admin can upload (when
// allowUpload — only inside the Add/Edit modal, not the list row) and delete; everyone
// can open/download. Generic over `service` so every parent type shares this component.
export function DocumentAttachments({
  parentId,
  canWrite,
  allowUpload = true,
  service,
  queryKey,
}: {
  parentId: string
  canWrite: boolean
  allowUpload?: boolean
  service: AttachmentService
  queryKey: string
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const key = [queryKey, parentId]
  const { data: docs = [] } = useQuery({ queryKey: key, queryFn: () => service.list(parentId) })
  const [uploadError, setUploadError] = useState('')

  // Uploads run one request per file, so picking several at once still works against the
  // single-file endpoint. Failures are reported without losing the ones that succeeded.
  const uploadM = useMutation({
    mutationFn: async (files: File[]) => {
      const results = await Promise.allSettled(files.map((f) => service.upload(parentId, f)))
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        throw new Error(
          getErrorMessage((failed[0] as PromiseRejectedResult).reason, 'Upload failed') +
            (failed.length > 1 ? ` (${failed.length} of ${files.length} files failed)` : ''),
        )
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
    onError: (err) => setUploadError(getErrorMessage(err, 'Upload failed')),
  })
  const deleteM = useMutation({
    mutationFn: (docId: string) => service.remove(parentId, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    const tooBig = files.filter((f) => f.size > MAX_FILE_SIZE)
    if (tooBig.length > 0) {
      setUploadError(`${tooBig.map((f) => f.name).join(', ')} — each file must be under ${sizeLabel}`)
      return
    }
    setUploadError('')
    uploadM.mutate(files)
  }

  if (docs.length === 0 && !(canWrite && allowUpload)) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {docs.map((d) => (
        <a
          key={d.id}
          href={service.downloadUrl(parentId, d.id)}
          target="_blank"
          rel="noreferrer"
          className="group relative flex w-20 flex-col items-center gap-1 rounded-xl border border-line bg-surface/70 p-2 text-center hover:bg-ink/5"
          title={d.filename}
        >
          <span className="text-muted">
            <DocIcon mimeType={d.mimeType} />
          </span>
          <span className="w-full truncate text-[10px] text-muted">{d.filename}</span>
          {canWrite && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                deleteM.mutate(d.id)
              }}
              className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-danger p-0.5 text-white group-hover:block"
              title="Remove document"
            >
              <X size={11} />
            </button>
          )}
        </a>
      ))}
      {canWrite && allowUpload && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadM.isPending}
            title={`Upload documents (any number, up to ${sizeLabel} each)`}
            className="flex w-20 flex-col items-center gap-1 rounded-xl border border-dashed border-line p-2 text-muted hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={20} />
            <span className="text-[10px]">{uploadM.isPending ? 'Uploading…' : 'Upload'}</span>
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPick} />
        </>
      )}
      {uploadError && <p className="w-full text-xs text-danger">{uploadError}</p>}
    </div>
  )
}

// Local-only file staging for a brand-new parent record (no id to upload
// against yet) — the actual upload happens right after the parent is created.
export function StagedAttachments({ files, setFiles }: { files: File[]; setFiles: (files: File[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])]
    e.target.value = ''
    if (picked.length === 0) return
    const tooBig = picked.filter((f) => f.size > MAX_FILE_SIZE)
    if (tooBig.length > 0) {
      setError(`${tooBig.map((f) => f.name).join(', ')} — each file must be under ${sizeLabel}`)
      return
    }
    setError('')
    setFiles([...files, ...picked])
  }
  function remove(index: number) {
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="group relative flex w-20 flex-col items-center gap-1 rounded-xl border border-line bg-surface/70 p-2 text-center"
          title={f.name}
        >
          <span className="text-muted">
            <DocIcon mimeType={f.type || 'application/octet-stream'} />
          </span>
          <span className="w-full truncate text-[10px] text-muted">{f.name}</span>
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-danger p-0.5 text-white group-hover:block"
            title="Remove"
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title={`Add documents (any number, up to ${sizeLabel} each)`}
        className="flex w-20 flex-col items-center gap-1 rounded-xl border border-dashed border-line p-2 text-muted hover:bg-ink/5"
      >
        <Upload size={20} />
        <span className="text-[10px]">Add</span>
      </button>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPick} />
      {error && <p className="w-full text-xs text-danger">{error}</p>}
      <p className="w-full text-xs text-muted">Uploaded once the record is created.</p>
    </div>
  )
}
