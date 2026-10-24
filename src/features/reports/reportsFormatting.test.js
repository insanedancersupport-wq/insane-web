import { describe, expect, it } from 'vitest'

import { serializeCsv } from './csvExport'
import { formatAttendanceRatePercent } from './reportsFormatting'

describe('formatAttendanceRatePercent', () => {
  it('converts fractional RPC rates to two-decimal numeric percentages', () => {
    expect(formatAttendanceRatePercent(0.714285714285714)).toBe('71.43')
    expect(formatAttendanceRatePercent(0.855555555555556)).toBe('85.56')
    expect(formatAttendanceRatePercent(1)).toBe('100.00')
    expect(formatAttendanceRatePercent(0)).toBe('0.00')
  })

  it('keeps null rates empty and serializes numeric percentage cells without a percent symbol', () => {
    expect(formatAttendanceRatePercent(null)).toBe('')
    expect(serializeCsv(['Attendance Rate (%)'], [[formatAttendanceRatePercent(0.714285714285714)], [formatAttendanceRatePercent(null)]]))
      .toBe('\uFEFFAttendance Rate (%)\r\n71.43\r\n\r\n')
  })
})
