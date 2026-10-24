export function formatAttendanceRatePercent(value) {
  return value == null ? '' : (Number(value) * 100).toFixed(2)
}
