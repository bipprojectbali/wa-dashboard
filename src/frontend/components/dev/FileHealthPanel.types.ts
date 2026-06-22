import { TbAlertTriangle, TbCheck, TbFileCheck, TbShieldOff, TbX } from 'react-icons/tb'

export interface FileHealth {
  path: string
  category: string
  lines: number
  chars: number
  limitLines: number
  limitChars: number
  ratioLines: number
  ratioChars: number
  status: 'ok' | 'warn' | 'critical' | 'exempt'
  exempt: boolean
}

export interface FileHealthResponse {
  files: FileHealth[]
  summary: {
    totalFiles: number
    totalLines: number
    totalChars: number
    hardLimitLines: number
    hardLimitChars: number
    byStatus: Record<string, number>
    byCategory: Record<string, number>
  }
  worstOffenders: FileHealth[]
}

export const STATUS_META: Record<FileHealth['status'], { color: string; label: string; icon: typeof TbCheck }> = {
  ok: { color: 'green', label: 'OK', icon: TbCheck },
  warn: { color: 'yellow', label: 'Warning', icon: TbAlertTriangle },
  critical: { color: 'red', label: 'Critical', icon: TbX },
  exempt: { color: 'gray', label: 'Exempt', icon: TbShieldOff },
}

export const STATS = [
  { key: 'totalFiles', title: 'Total Files', color: 'blue', icon: TbFileCheck },
  { key: 'ok', title: 'OK', color: 'green', icon: TbCheck },
  { key: 'warn', title: 'Warning', color: 'yellow', icon: TbAlertTriangle },
  { key: 'critical', title: 'Critical', color: 'red', icon: TbX },
] as const

export function fmtNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export function ratioColor(ratio: number, exempt: boolean): string {
  if (exempt) return 'gray'
  if (ratio > 1) return 'red'
  if (ratio >= 0.8) return 'yellow'
  return 'green'
}
