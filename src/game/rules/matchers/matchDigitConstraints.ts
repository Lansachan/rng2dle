import type { DigitConstraintsParams, Grid } from '../types'

export function matchDigitConstraints(grid: Grid, params: DigitConstraintsParams): number {
  if (grid.length === 0 || grid[0]?.length === 0) return 0

  const digits = new Set(grid.flat())

  const hasAllRequired = (params.requiredDigits ?? []).every((digit) => digits.has(digit))
  const hasForbidden = (params.forbiddenDigits ?? []).some((digit) => digits.has(digit))

  return hasAllRequired && !hasForbidden ? 1 : 0
}
