import type { ActivationGroup, CellIndex, Grid, MatchEvidence, RuleMatchResult } from '../types'

export function fail(): RuleMatchResult {
  return { coefficient: 0, matches: [] }
}

export function succeed(coefficient: number, ...groups: ActivationGroup[]): RuleMatchResult {
  return { coefficient, matches: [{ groups }] }
}

export function succeedMultiple(
  coefficient: number,
  matchGroups: ActivationGroup[][],
): RuleMatchResult {
  return { coefficient, matches: matchGroups.map((groups) => ({ groups })) }
}

export function wholeBoardIndices(grid: Grid): CellIndex[] {
  const width = grid[0]?.length ?? 0
  return Array.from({ length: grid.length * width }, (_, index) => index)
}

export function toIndex(grid: Grid, row: number, column: number): CellIndex {
  return row * (grid[0]?.length ?? 1) + column
}

export function cellGroup(...indices: CellIndex[]): ActivationGroup {
  return indices
}

export function activation(...groups: ActivationGroup[]): MatchEvidence {
  return { groups }
}

export function anonActivation(grid: Grid, cells: Array<{ row: number; column: number }>): MatchEvidence {
  return { groups: [cells.map(({ row, column }) => toIndex(grid, row, column))] }
}

export function mergeGroups(groups: ActivationGroup[]): ActivationGroup {
  return [...new Set(groups.flat())]
}