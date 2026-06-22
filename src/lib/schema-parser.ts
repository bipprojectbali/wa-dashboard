export interface SchemaField {
  name: string
  type: string
  isId: boolean
  isUnique: boolean
  isOptional: boolean
  isList: boolean
  isRelation: boolean
  default?: string
}

export interface SchemaRelation {
  from: string
  fromField: string
  to: string
  toField: string
  onDelete?: string
}

export interface SchemaModel {
  name: string
  tableName: string
  fields: SchemaField[]
}

export interface SchemaEnum {
  name: string
  values: string[]
}

export interface ParsedSchema {
  models: SchemaModel[]
  enums: SchemaEnum[]
  relations: SchemaRelation[]
}

export function parseSchema(raw: string): ParsedSchema {
  const models: SchemaModel[] = []
  const enums: SchemaEnum[] = []
  const relations: SchemaRelation[] = []

  const blocks = raw.match(/(model|enum)\s+(\w+)\s*\{([^}]*)}/gs) ?? []

  for (const block of blocks) {
    const match = block.match(/(model|enum)\s+(\w+)\s*\{([^}]*)}/s)
    if (!match) continue
    const [, type, name, body] = match
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'))

    if (type === 'enum') {
      enums.push({ name, values: lines })
      continue
    }

    let tableName = name
    const fields: SchemaField[] = []

    for (const line of lines) {
      const mapMatch = line.match(/@@map\("(\w+)"\)/)
      if (mapMatch) {
        tableName = mapMatch[1]
        continue
      }
      if (line.startsWith('@@')) continue

      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?)?(\[\])?\s*(.*)$/)
      if (!fieldMatch) continue
      const [, fName, fType, optional, list, attrs] = fieldMatch

      const isId = attrs.includes('@id')
      const isUnique = attrs.includes('@unique')
      const isRelation = attrs.includes('@relation')
      const defaultMatch = attrs.match(/@default\(([^)]+)\)/)

      const isModelRef =
        /^[A-Z]/.test(fType) &&
        !enums.some((e) => e.name === fType) &&
        !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'BigInt', 'Decimal', 'Bytes', 'Json'].includes(fType)

      if (isRelation) {
        const relMatch = attrs.match(
          /@relation\(fields:\s*\[(\w+)],\s*references:\s*\[(\w+)](?:,\s*onDelete:\s*(\w+))?\)/,
        )
        if (relMatch) {
          relations.push({
            from: name,
            fromField: relMatch[1],
            to: fType,
            toField: relMatch[2],
            onDelete: relMatch[3],
          })
        }
      }

      fields.push({
        name: fName,
        type: fType + (list ? '[]' : ''),
        isId,
        isUnique,
        isOptional: !!optional,
        isList: !!list,
        isRelation: isModelRef,
        default: defaultMatch?.[1],
      })
    }

    models.push({ name, tableName, fields })
  }

  return { models, enums, relations }
}
