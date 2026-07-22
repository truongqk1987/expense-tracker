import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'

describe('toCsv', () => {
  it('joins headers and rows with commas and a trailing newline per line', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\n1,2\n')
  })

  it('ends the output with a trailing newline', () => {
    expect(toCsv(['a'], [['1'], ['2']])).toMatch(/\n$/)
  })

  it('quotes a field containing a comma', () => {
    expect(toCsv(['a'], [['1,2']])).toBe('a\n"1,2"\n')
  })

  it('quotes a field containing a double quote and doubles it', () => {
    expect(toCsv(['a'], [['say "hi"']])).toBe('a\n"say ""hi"""\n')
  })

  it('quotes a field containing a newline', () => {
    expect(toCsv(['a'], [['line1\nline2']])).toBe('a\n"line1\nline2"\n')
  })

  it('leaves plain fields unquoted', () => {
    expect(toCsv(['a'], [['plain']])).toBe('a\nplain\n')
  })
})

describe('parseCsv', () => {
  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('parses plain comma-separated rows', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('parses a quoted field containing a comma', () => {
    expect(parseCsv('a\n"1,2"\n')).toEqual([['a'], ['1,2']])
  })

  it('parses a quoted field with an escaped double quote', () => {
    expect(parseCsv('a\n"say ""hi"""\n')).toEqual([['a'], ['say "hi"']])
  })

  it('parses a quoted field containing an embedded newline', () => {
    expect(parseCsv('a\n"line1\nline2"\n')).toEqual([['a'], ['line1\nline2']])
  })

  it('handles input without a trailing newline', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('round-trips through toCsv', () => {
    const headers = ['date', 'category', 'amount', 'note']
    const rows = [
      ['2026-07-01', 'food', '12.5', 'Lunch, "the usual"'],
      ['2026-07-02', 'transport', '3', ''],
    ]
    expect(parseCsv(toCsv(headers, rows))).toEqual([headers, ...rows])
  })
})
