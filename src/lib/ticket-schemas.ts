import { t } from 'elysia'

export const TicketUserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  role: t.String(),
})

export const CommentSchema = t.Object({
  id: t.String(),
  body: t.String(),
  authorTag: t.String(),
  createdAt: t.Date(),
  author: t.Nullable(TicketUserSchema),
})

export const EvidenceSchema = t.Object({
  id: t.String(),
  kind: t.String(),
  url: t.String(),
  note: t.Nullable(t.String()),
  createdAt: t.Date(),
})

export const StatusUnion = t.Union([
  t.Literal('OPEN'),
  t.Literal('IN_PROGRESS'),
  t.Literal('READY_FOR_QC'),
  t.Literal('REOPENED'),
  t.Literal('CLOSED'),
])

export const PriorityUnion = t.Union([t.Literal('LOW'), t.Literal('MEDIUM'), t.Literal('HIGH'), t.Literal('CRITICAL')])

export const EvidenceKindUnion = t.Union([
  t.Literal('screenshot'),
  t.Literal('commit'),
  t.Literal('test_log'),
  t.Literal('trace'),
  t.Literal('other'),
])
