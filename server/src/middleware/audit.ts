import type { NextFunction, Request, Response } from 'express'
import { AuditLog } from '../models/AuditLog.js'

const METHOD_ACTION: Record<string, 'create' | 'update' | 'delete'> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
}

// Logs every successful mutating request. Attach AFTER authenticate so req.user is set.
// Fire-and-forget on response 'finish' so it never blocks or fails the request.
export function auditLog(entity: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const action = METHOD_ACTION[req.method]
    if (!action) return next()

    res.on('finish', () => {
      if (res.statusCode >= 400) return
      AuditLog.create({
        userId: req.user?.id,
        userEmail: req.user?.email ?? 'anonymous',
        userRole: req.user?.role,
        action,
        entity,
        entityId: req.params.id,
        label: res.locals.auditLabel,
        before: res.locals.auditBefore,
        after: res.locals.auditAfter,
        changes: res.locals.auditChanges,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        statusCode: res.statusCode,
      }).catch((e) => console.error('audit log failed:', e?.message))
    })

    next()
  }
}
