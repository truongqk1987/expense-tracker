// Generic, zero-dependency RFC-4180 CSV helpers. No React, no domain
// knowledge — see features/expenses/csv.ts for expense-specific mapping.

function needsQuoting(field: string): boolean {
  return /[",\n\r]/.test(field)
}

function escapeField(field: string): string {
  if (!needsQuoting(field)) return field
  return `"${field.replace(/"/g, '""')}"`
}

/** Serialize headers + rows into an RFC-4180 CSV string (trailing newline). */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeField).join(','))
  return lines.map((line) => `${line}\n`).join('')
}

/**
 * Parse an RFC-4180 CSV string into rows of raw string fields. Quote-aware:
 * handles embedded commas/quotes/newlines inside quoted fields, and both
 * `\n` and `\r\n` line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (char === '\r' || char === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }

    field += char
    i += 1
  }

  // Flush a trailing field/row when the text doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
