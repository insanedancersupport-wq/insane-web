export class CsvExportError extends Error {}

export class CsvExportCancelledError extends CsvExportError {}

export class CsvExportLimitError extends CsvExportError {}

function assertActive(signal) {
  if (signal?.aborted) {
    throw new CsvExportCancelledError('The export was cancelled.')
  }
}

function safeText(value) {
  const text = String(value)
  let index = 0
  while (index < text.length && text.charCodeAt(index) <= 32) index += 1
  return ['=', '+', '-', '@'].includes(text[index]) ? `'${text}` : text
}

function csvCell(value) {
  if (value == null) return ''
  const text = (typeof value === 'number' ? String(value) : safeText(value)).replace(/\r\n|\r|\n/g, '\r\n')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function serializeCsv(headers, rows) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export async function collectKeysetPages({ fetchPage, limit = 5000, signal }) {
  const rows = []
  const cursors = new Set()
  let cursor = null

  while (true) {
    assertActive(signal)
    const page = await fetchPage(cursor)
    assertActive(signal)

    if (!Array.isArray(page)) {
      throw new CsvExportError('The export response was invalid.')
    }
    if (page.length === 0) {
      return rows
    }

    rows.push(...page)
    if (rows.length > limit) {
      throw new CsvExportLimitError(`Exports support at most ${limit} data rows.`)
    }

    const finalRow = page.at(-1)
    if (!finalRow?.has_more) {
      return rows
    }

    cursor = finalRow.next_cursor
    if (typeof cursor !== 'string' || cursor.length === 0 || cursors.has(cursor)) {
      throw new CsvExportError('The export pagination cursor was invalid.')
    }
    cursors.add(cursor)
  }
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
