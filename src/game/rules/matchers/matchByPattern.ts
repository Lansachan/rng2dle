import { evaluateCoefficient } from '../coefficient'
import type { ActivationGroup, Grid, PatternParams, RuleMatchResult } from '../types'
import { fail, succeedMultiple, toIndex } from './matchResult'

function symbolPair(left: string, right: string): string {
  return left < right ? `${left}\0${right}` : `${right}\0${left}`
}

function getEqualityPermissions(params: PatternParams): Set<string> {
  const permissions = new Set<string>()
  for (const [symbol, others] of Object.entries(params.allowSameWith ?? {})) {
    for (const other of others) permissions.add(symbolPair(symbol, other))
  }
  return permissions
}

function matchesAt(
  grid: Grid,
  pattern: string[][],
  startRow: number,
  startColumn: number,
  params: PatternParams,
  equalityPermissions: Set<string>,
): Map<string, ActivationGroup> | null {
  const bindings = new Map<string, number>()
  const groups = new Map<string, ActivationGroup>()

  for (let row = 0; row < pattern.length; row++) {
    for (let column = 0; column < pattern[row]!.length; column++) {
      const token = pattern[row]![column]!
      const value = grid[startRow + row]![startColumn + column]!

      if (token === ' ') continue

      if (!groups.has(token)) groups.set(token, [])
      groups.get(token)!.push(toIndex(grid, startRow + row, startColumn + column))

      if (/^[0-9]$/.test(token)) {
        if (value !== Number(token)) return null
        continue
      }

      const boundValue = bindings.get(token)
      if (boundValue !== undefined) {
        if (boundValue !== value) return null
        continue
      }

      const allowedValues = params.symbolValues?.[token]
      if (allowedValues && !allowedValues.includes(value)) return null

      for (const [otherSymbol, otherValue] of bindings) {
        if (otherValue === value && !equalityPermissions.has(symbolPair(token, otherSymbol))) {
          return null
        }
      }

      bindings.set(token, value)
    }
  }

  return groups
}

function overlapsUsedCells(
  usedCells: Set<number>,
  startRow: number,
  startColumn: number,
  height: number,
  width: number,
  gridWidth: number,
): boolean {
  for (let row = startRow; row < startRow + height; row++) {
    for (let column = startColumn; column < startColumn + width; column++) {
      if (usedCells.has(row * gridWidth + column)) return true
    }
  }
  return false
}

function markUsedCells(
  usedCells: Set<number>,
  startRow: number,
  startColumn: number,
  height: number,
  width: number,
  gridWidth: number,
): void {
  for (let row = startRow; row < startRow + height; row++) {
    for (let column = startColumn; column < startColumn + width; column++) {
      usedCells.add(row * gridWidth + column)
    }
  }
}

function orderedGroups(groups: Map<string, ActivationGroup>, params: PatternParams): ActivationGroup[] {
  const order = params.groupOrder ?? Array.from(groups.keys())
  return order.map((token) => groups.get(token)!)
}

export function matchByPattern(grid: Grid, params: PatternParams): RuleMatchResult {
  if (grid.length === 0 || grid[0]!.length === 0) return fail()

  const gridWidth = grid[0]!.length
  const pattern = params.pattern.map((row) => Array.from(row))
  const patternHeight = pattern.length
  const patternWidth = pattern[0]?.length ?? 0

  if (patternHeight === 0 || patternWidth === 0) return fail()
  if (patternHeight > grid.length || patternWidth > gridWidth) return fail()

  const equalityPermissions = getEqualityPermissions(params)
  const usedCells = new Set<number>()
  const matches: ActivationGroup[][] = []

  for (let row = 0; row <= grid.length - patternHeight; row++) {
    for (let column = 0; column <= gridWidth - patternWidth; column++) {
      if (
        params.multiple &&
        params.allowOverlap === false &&
        overlapsUsedCells(usedCells, row, column, patternHeight, patternWidth, gridWidth)
      ) {
        continue
      }

      const groups = matchesAt(grid, pattern, row, column, params, equalityPermissions)
      if (!groups) continue

      matches.push(orderedGroups(groups, params))
      if (!params.multiple) {
        return succeedMultiple(evaluateCoefficient(params.coefficient, 1), matches)
      }

      if (params.allowOverlap === false) {
        markUsedCells(usedCells, row, column, patternHeight, patternWidth, gridWidth)
      }
    }
  }

  const coefficient = evaluateCoefficient(params.coefficient, matches.length)
  return coefficient === 0 ? fail() : succeedMultiple(coefficient, matches)
}
