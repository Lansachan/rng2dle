import type { DigitConstraintsParams, Grid, RuleMatchResult } from '../types'
import { fail, succeed, toIndex, wholeBoardIndices } from './matchResult'

export function matchDigitConstraints(grid: Grid, params: DigitConstraintsParams): RuleMatchResult {
  if (grid.length === 0 || grid[0]?.length === 0) return fail()

  const digits = new Set(grid.flat())

  const hasAllRequired = (params.requiredDigits ?? []).every((digit) => digits.has(digit))
  const hasForbidden = (params.forbiddenDigits ?? []).some((digit) => digits.has(digit))

  if (!hasAllRequired || hasForbidden) return fail()

  if (params.requiredDigits) {
    const groups = params.requiredDigits.map((digit) => {
      const indices: number[] = []
      for (let row = 0; row < grid.length; row++) {
        for (let column = 0; column < grid[row]!.length; column++) {
          if (grid[row]![column] === digit) indices.push(toIndex(grid, row, column))
        }
      }
      return indices
    })
    return succeed(1, ...groups)
  }

  return succeed(1, wholeBoardIndices(grid))
}
