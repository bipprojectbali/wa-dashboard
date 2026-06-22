import { Handle, type Node, Position } from '@xyflow/react'
import type { SchemaField } from './shared'

export function ModelNode({ data }: { data: { label: string; tableName: string; fields: SchemaField[] } }) {
  return (
    <div
      style={{
        background: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 8,
        minWidth: 240,
        fontSize: 12,
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--mantine-color-blue-6)' }} />
      <div
        style={{
          padding: '8px 12px',
          fontWeight: 700,
          fontSize: 13,
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-blue-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{data.label}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>{data.tableName}</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {data.fields
          .filter((f) => !f.isRelation)
          .map((field) => (
            <div
              key={field.name}
              style={{
                padding: '3px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {field.isId && (
                  <span style={{ color: 'var(--mantine-color-yellow-6)' }} title="Primary Key">
                    PK
                  </span>
                )}
                {field.isUnique && !field.isId && (
                  <span style={{ color: 'var(--mantine-color-teal-6)' }} title="Unique">
                    UQ
                  </span>
                )}
                {!field.isId && !field.isUnique && <span style={{ width: 16 }} />}
                <span>{field.name}</span>
              </span>
              <span style={{ opacity: 0.5 }}>
                {field.type}
                {field.isOptional ? '?' : ''}
              </span>
            </div>
          ))}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--mantine-color-blue-6)' }} />
    </div>
  )
}

export function EnumNode({ data }: { data: { label: string; values: string[] } }) {
  return (
    <div
      style={{
        background: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 8,
        minWidth: 160,
        fontSize: 12,
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontWeight: 700,
          fontSize: 13,
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-violet-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{data.label}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>enum</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {data.values.map((v) => (
          <div key={v} style={{ padding: '3px 12px' }}>
            {v}
          </div>
        ))}
      </div>
    </div>
  )
}

export const dbNodeTypes = { model: ModelNode, enum: EnumNode }

export const STORAGE_KEY = 'dev:schema:positions'
export const VIEWPORT_KEY = 'dev:schema:viewport'

export function savePositions(nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) positions[n.id] = n.position
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
}

export function loadPositions(): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveViewport(viewport: { x: number; y: number; zoom: number }) {
  localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport))
}

export function loadViewport(): { x: number; y: number; zoom: number } | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
