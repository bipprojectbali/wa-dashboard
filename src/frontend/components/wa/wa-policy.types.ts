// Tipe respons GET /api/wa/policy yang dibagi antar komponen panel kebijakan WA.

export interface WaPolicy {
  id: string
  allowFirstContact: boolean
  maxPerMinute: number
  maxPerHour: number
  maxPerDay: number
  minIntervalSeconds: number
  perRecipientCooldownSeconds: number
  requireAck: boolean
  contractVersion: number
  verifyReplyEnabled: boolean
  verifyReplyMessage: string | null
  updatedAt: string
  updatedById: string | null
}

export interface UsageSnapshot {
  minute: { used: number; max: number }
  hour: { used: number; max: number }
  day: { used: number; max: number }
}

export interface ContractSection {
  title: string
  body: string[]
}

export interface PolicyResponse {
  policy: WaPolicy
  usage: UsageSnapshot
  ack: { version: number; at: string } | null
  contract: { version: number; sections: ContractSection[] }
  canEdit: boolean
}

// Field policy yang bisa diedit (subset tanpa metadata).
export type PolicyEditable = Pick<
  WaPolicy,
  | 'allowFirstContact'
  | 'maxPerMinute'
  | 'maxPerHour'
  | 'maxPerDay'
  | 'minIntervalSeconds'
  | 'perRecipientCooldownSeconds'
  | 'requireAck'
  | 'verifyReplyEnabled'
  | 'verifyReplyMessage'
>
