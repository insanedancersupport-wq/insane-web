import { describe, expect, it, vi } from 'vitest'

import { collectKeysetPages, CsvExportCancelledError, CsvExportError, CsvExportLimitError, serializeCsv } from './csvExport'

describe('CSV export', () => {
  it('serializes Excel-compatible CSV with stable columns and safe text cells', () => {
    expect(serializeCsv(['Name', 'Rate', 'Note'], [['Ana, "Ștefan"', 75, '=SUM(1,1)'], [null, '', ' line\nnext']]))
      .toBe('\uFEFFName,Rate,Note\r\n"Ana, ""Ștefan""",75,"\'=SUM(1,1)"\r\n,," line\r\nnext"\r\n')
  })

  it('protects leading whitespace and control-character formula prefixes without changing numbers', () => {
    expect(serializeCsv(['Value'], [[' \t-1'], ['\u0001@cmd'], [-1], [0.75]])).toBe('\uFEFFValue\r\n\' \t-1\r\n\'\u0001@cmd\r\n-1\r\n0.75\r\n')
  })

  it('collects sequential keyset pages from the first cursor through the final row', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce([{ id: 1, has_more: true, next_cursor: 'next' }])
      .mockResolvedValueOnce([{ id: 2, has_more: false, next_cursor: null }])

    await expect(collectKeysetPages({ fetchPage })).resolves.toHaveLength(2)
    expect(fetchPage).toHaveBeenNthCalledWith(1, null)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'next')
  })

  it('rejects overflow and malformed or repeated cursors without partial export data', async () => {
    await expect(collectKeysetPages({
      limit: 2,
      fetchPage: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
    })).rejects.toBeInstanceOf(CsvExportLimitError)

    await expect(collectKeysetPages({
      fetchPage: vi.fn().mockResolvedValue([{ has_more: true, next_cursor: '' }]),
    })).rejects.toBeInstanceOf(CsvExportError)

    await expect(collectKeysetPages({
      fetchPage: vi.fn().mockResolvedValue([{ has_more: true, next_cursor: 'same' }]),
    })).rejects.toBeInstanceOf(CsvExportError)
  })

  it('cancels after a pending page resolves without requesting another page', async () => {
    const controller = new AbortController()
    let resolvePage
    const fetchPage = vi.fn(() => new Promise((resolve) => { resolvePage = resolve }))
    const result = collectKeysetPages({ fetchPage, signal: controller.signal })
    controller.abort()
    resolvePage([{ has_more: true, next_cursor: 'next' }])

    await expect(result).rejects.toBeInstanceOf(CsvExportCancelledError)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
