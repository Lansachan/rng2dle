import type { Grid, RuleMatchResult, RuleMatcher } from '../types'
import { fail, succeed, succeedMultiple, toIndex, wholeBoardIndices, activation } from './matchResult'

type Comparison = 'eq' | 'lt' | 'lte' | 'gt' | 'gte'
type Transform =
  | 'rotate-90'
  | 'rotate-180'
  | 'reflect-horizontal'
  | 'reflect-vertical'
  | 'reflect-main-diagonal'
  | 'reflect-anti-diagonal'

function flat(grid: Grid): number[] {
  return grid.flat()
}

function compare(left: number, operator: Comparison, right: number): boolean {
  switch (operator) {
    case 'eq': return left === right
    case 'lt': return left < right
    case 'lte': return left <= right
    case 'gt': return left > right
    case 'gte': return left >= right
  }
}

function lines(grid: Grid, diagonals = false): number[][] {
  const result = [...grid.map((row) => [...row])]
  const width = grid[0]?.length ?? 0
  for (let column = 0; column < width; column++) {
    result.push(grid.map((row) => row[column]!))
  }
  if (diagonals && grid.length === width) {
    result.push(grid.map((row, index) => row[index]!))
    result.push(grid.map((row, index) => row[width - 1 - index]!))
  }
  return result
}

function isPalindrome(values: number[]): boolean {
  return values.every((value, index) => value === values[values.length - 1 - index])
}

function checkTransform(grid: Grid, transform: Transform): boolean {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  if (height !== width && !['reflect-horizontal', 'reflect-vertical', 'rotate-180'].includes(transform)) {
    return false
  }

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      let targetRow: number
      let targetColumn: number
      switch (transform) {
        case 'rotate-90':
          targetRow = column
          targetColumn = height - 1 - row
          break
        case 'rotate-180':
          targetRow = height - 1 - row
          targetColumn = width - 1 - column
          break
        case 'reflect-horizontal':
          targetRow = height - 1 - row
          targetColumn = column
          break
        case 'reflect-vertical':
          targetRow = row
          targetColumn = width - 1 - column
          break
        case 'reflect-main-diagonal':
          targetRow = column
          targetColumn = row
          break
        case 'reflect-anti-diagonal':
          targetRow = width - 1 - column
          targetColumn = height - 1 - row
          break
      }
      if (grid[row]![column] !== grid[targetRow]?.[targetColumn]) return false
    }
  }
  return true
}

const ORTHOGONAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
const EIGHT_DIRECTIONS = [
  ...ORTHOGONAL_DIRECTIONS,
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const

type Cell = readonly [number, number]

function cellKey(row: number, column: number): string {
  return `${row},${column}`
}

function connectedComponents(
  grid: Grid,
  value: number,
  directions: ReadonlyArray<readonly [number, number]> = ORTHOGONAL_DIRECTIONS,
): Cell[][] {
  const visited = new Set<string>()
  const components: Cell[][] = []

  for (let startRow = 0; startRow < grid.length; startRow++) {
    for (let startColumn = 0; startColumn < grid[startRow]!.length; startColumn++) {
      if (grid[startRow]![startColumn] !== value || visited.has(cellKey(startRow, startColumn))) continue
      const component: Cell[] = []
      const queue: Cell[] = [[startRow, startColumn]]
      visited.add(cellKey(startRow, startColumn))
      while (queue.length > 0) {
        const [row, column] = queue.shift()!
        component.push([row, column])
        for (const [dr, dc] of directions) {
          const nextRow = row + dr
          const nextColumn = column + dc
          const key = cellKey(nextRow, nextColumn)
          if (grid[nextRow]?.[nextColumn] === value && !visited.has(key)) {
            visited.add(key)
            queue.push([nextRow, nextColumn])
          }
        }
      }
      components.push(component)
    }
  }
  return components
}

function normalizeShape(cells: Cell[]): string {
  const minimumRow = Math.min(...cells.map(([row]) => row))
  const minimumColumn = Math.min(...cells.map(([, column]) => column))
  return cells
    .map(([row, column]) => [row - minimumRow, column - minimumColumn] as const)
    .sort(([leftRow, leftColumn], [rightRow, rightColumn]) => leftRow - rightRow || leftColumn - rightColumn)
    .map(([row, column]) => `${row},${column}`)
    .join(';')
}

const TETROMINO_SHAPES = new Set([
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 1], [1, 0], [1, 1], [2, 1]],
  [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 0]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 0], [1, 1], [1, 2]],
  [[0, 1], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 1], [1, 0], [1, 1], [2, 0]],
].map((shape) => normalizeShape(shape.map(([row, column]) => [row!, column!] as const))))

const ALL_TETROMINO_SHAPES = new Set([
  ...TETROMINO_SHAPES,
  normalizeShape([[0, 0], [0, 1], [0, 2], [0, 3]]),
  normalizeShape([[0, 0], [1, 0], [2, 0], [3, 0]]),
  normalizeShape([[0, 0], [0, 1], [1, 0], [1, 1]]),
])

function asResultMatcher(
  matcher: (grid: Grid, params?: unknown) => number,
  evidence?: (grid: Grid, params?: unknown) => RuleMatchResult['matches'],
): RuleMatcher {
  return (grid, params) => {
    const coefficient = matcher(grid, params)
    if (coefficient === 0) return fail()
    return {
      coefficient,
      matches: evidence?.(grid, params) ?? [activation(wholeBoardIndices(grid))],
    }
  }
}

/* ── Individual matchers ── */

export const matchDeterminantZero: RuleMatcher = asResultMatcher((grid) => {
  if (grid.length === 0 || grid.some((row) => row.length !== grid.length)) return 0
  const matrix = grid.map((row) => row.map(BigInt))
  let sign = 1n
  let previousPivot = 1n

  for (let pivotIndex = 0; pivotIndex < matrix.length - 1; pivotIndex++) {
    let pivotRow = pivotIndex
    while (pivotRow < matrix.length && matrix[pivotRow]![pivotIndex] === 0n) pivotRow++
    if (pivotRow === matrix.length) return 1
    if (pivotRow !== pivotIndex) {
      ;[matrix[pivotIndex], matrix[pivotRow]] = [matrix[pivotRow]!, matrix[pivotIndex]!]
      sign = -sign
    }
    const pivot = matrix[pivotIndex]![pivotIndex]!
    for (let row = pivotIndex + 1; row < matrix.length; row++) {
      for (let column = pivotIndex + 1; column < matrix.length; column++) {
        matrix[row]![column] =
          (matrix[row]![column]! * pivot - matrix[row]![pivotIndex]! * matrix[pivotIndex]![column]!) /
          previousPivot
      }
    }
    previousPivot = pivot
  }
  return sign * matrix.at(-1)!.at(-1)! === 0n ? 1 : 0
})

export const matchSequentialPath: RuleMatcher = (grid) => {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

  function search(row: number, column: number, expected: number, path: number[][]): boolean {
    if (grid[row]?.[column] !== expected) return false
    path.push([row, column])
    if (expected === 9) return true
    for (const [dr, dc] of directions) {
      const nextRow = row + dr
      const nextColumn = column + dc
      if (search(nextRow, nextColumn, expected + 1, path)) return true
    }
    path.pop()
    return false
  }

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const path: number[][] = []
      if (search(row, column, 0, path)) {
        return succeed(1, ...path.map(([r, c]) => [toIndex(grid, r, c)]))
      }
    }
  }
  return fail()
}

export const matchDiagonalIncreasing: RuleMatcher = asResultMatcher((grid) => {
  const size = grid.length
  if (size === 0 || grid.some((row) => row.length !== size)) return 0
  const leftToRight = Array.from({ length: size }, (_, index) => grid[size - 1 - index]![index]!)
  const rightToLeft = Array.from({ length: size }, (_, index) => grid[size - 1 - index]![size - 1 - index]!)
  const increasing = (values: number[]) => values.slice(1).every((value, index) => value > values[index]!)
  return increasing(leftToRight) && increasing(rightToLeft) ? 1 : 0
}, (grid) => {
  const size = grid.length
  const ltr = Array.from({ length: size }, (_, i) => toIndex(grid, size - 1 - i, i))
  const rtl = Array.from({ length: size }, (_, i) => toIndex(grid, size - 1 - i, size - 1 - i))
  return [activation(ltr, rtl)]
})

export const matchSumCompare: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const params = rawParams as { operator: Comparison; value: number }
  return compare(flat(grid).reduce((sum, value) => sum + value, 0), params.operator, params.value) ? 1 : 0
})

export const matchDiagonalTriangle: RuleMatcher = (grid) => {
  const size = grid.length
  if (size === 0 || grid.some((row) => row.length !== size)) return fail()

  const candidates = [
    { diagonal: (r: number, c: number) => r === c, side: (r: number, c: number) => r < c },
    { diagonal: (r: number, c: number) => r === c, side: (r: number, c: number) => r > c },
    { diagonal: (r: number, c: number) => r + c === size - 1, side: (r: number, c: number) => r + c < size - 1 },
    { diagonal: (r: number, c: number) => r + c === size - 1, side: (r: number, c: number) => r + c > size - 1 },
  ]

  for (const { diagonal, side } of candidates) {
    let valid = true
    const diagIndices: number[] = []
    const sideIndices: number[] = []
    for (let row = 0; row < size && valid; row++) {
      for (let column = 0; column < size; column++) {
        const value = grid[row]![column]!
        if (diagonal(row, column)) {
          diagIndices.push(toIndex(grid, row, column))
          if (value === 0) { valid = false; break }
        } else if (side(row, column)) {
          sideIndices.push(toIndex(grid, row, column))
          if (value !== 0) { valid = false; break }
        }
      }
    }
    if (valid) return succeed(1, diagIndices, sideIndices)
  }
  return fail()
}

export const matchBoardSymmetry: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const params = rawParams as { transforms: Transform[]; mode?: 'all' | 'any' }
  const results = params.transforms.map((transform) => checkTransform(grid, transform))
  return (params.mode === 'any' ? results.some(Boolean) : results.every(Boolean)) ? 1 : 0
})

export const matchAll2x2Parity: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const { parity = 'even' } = (rawParams ?? {}) as { parity?: 'even' | 'odd' }
  const expected = parity === 'even' ? 0 : 1
  for (let row = 0; row < grid.length - 1; row++) {
    for (let column = 0; column < grid[row]!.length - 1; column++) {
      const sum = grid[row]![column]! + grid[row]![column + 1]! +
        grid[row + 1]![column]! + grid[row + 1]![column + 1]!
      if (Math.abs(sum % 2) !== expected) return 0
    }
  }
  return 1
})

export const matchDiagonalCorrespondence: RuleMatcher = (grid) => {
  const size = grid.length
  if (grid.some((row) => row.length !== size)) return fail()
  const pairs: number[][] = []
  for (let index = 0; index < size; index++) {
    pairs.push([toIndex(grid, index, index), toIndex(grid, index, size - 1 - index)])
  }
  return grid.every((row, index) => row[index] === row[size - 1 - index])
    ? succeed(1, ...pairs)
    : fail()
}

export const matchSudoku6x6: RuleMatcher = asResultMatcher((grid) => {
  if (grid.length !== 6 || grid.some((row) => row.length !== 6)) return 0
  const validSet = (values: number[]) => values.length === 6 && new Set(values).size === 6 && values.every((v) => v >= 1 && v <= 6)
  if (!grid.every(validSet)) return 0
  if (!Array.from({ length: 6 }, (_, c) => grid.map((row) => row[c]!)).every(validSet)) return 0
  for (let startRow = 0; startRow < 6; startRow += 2) {
    for (let startColumn = 0; startColumn < 6; startColumn += 3) {
      const block = grid.slice(startRow, startRow + 2).flatMap((row) => row.slice(startColumn, startColumn + 3))
      if (!validSet(block)) return 0
    }
  }
  return 1
})

export const matchLineSumParity: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const params = rawParams as { rowParity: 'even' | 'odd'; columnParity: 'even' | 'odd' }
  const parity = (values: number[]) => Math.abs(values.reduce((sum, value) => sum + value, 0) % 2)
  const rowExpected = params.rowParity === 'even' ? 0 : 1
  const columnExpected = params.columnParity === 'even' ? 0 : 1
  return grid.every((row) => parity(row) === rowExpected) &&
    Array.from({ length: grid[0]?.length ?? 0 }, (_, c) => grid.map((row) => row[c]!))
      .every((column) => parity(column) === columnExpected) ? 1 : 0
})

export const matchLinePalindrome: RuleMatcher = asResultMatcher((grid) =>
  lines(grid, true).every(isPalindrome) ? 1 : 0,
)

export const matchLineUnique: RuleMatcher = asResultMatcher((grid) =>
  lines(grid, true).every((line) => new Set(line).size === line.length) ? 1 : 0,
)

export const matchCheckerboardParity: RuleMatcher = asResultMatcher((grid) => {
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      if (Math.abs(grid[row]![column]! % 2) !== (row + column) % 2) return 0
    }
  }
  return 1
})

export const matchEqualQuadrantSums: RuleMatcher = (grid) => {
  if (grid.length % 2 !== 0 || (grid[0]?.length ?? 0) % 2 !== 0) return fail()
  const halfRows = grid.length / 2
  const halfColumns = grid[0]!.length / 2
  const sums = [0, 0, 0, 0]
  const quadrants: number[][] = [[], [], [], []]
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      const quadrantIndex = (row < halfRows ? 0 : 2) + (column < halfColumns ? 0 : 1)
      sums[quadrantIndex]! += grid[row]![column]!
      quadrants[quadrantIndex]!.push(toIndex(grid, row, column))
    }
  }
  return new Set(sums).size === 1 ? succeed(1, ...quadrants) : fail()
}

export const matchMissingDigitCount: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const { count = 1 } = (rawParams ?? {}) as { count?: number }
  const present = new Set(flat(grid))
  const missing = Array.from({ length: 10 }, (_, digit) => digit).filter((digit) => !present.has(digit))
  return missing.length === count ? 1 : 0
})

function centerAndBorderSums(grid: Grid): [number, number] {
  let center = 0
  let border = 0
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      if (row > 0 && row < grid.length - 1 && column > 0 && column < grid[row]!.length - 1) {
        center += grid[row]![column]!
      } else {
        border += grid[row]![column]!
      }
    }
  }
  return [center, border]
}

export const matchCenterBorderSum: RuleMatcher = (grid, rawParams) => {
  const { operator } = rawParams as { operator: Comparison }
  const [center, border] = centerAndBorderSums(grid)
  if (!compare(center, operator, border)) return fail()
  const centerIndices: number[] = []
  const borderIndices: number[] = []
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      if (row > 0 && row < grid.length - 1 && column > 0 && column < grid[row]!.length - 1) {
        centerIndices.push(toIndex(grid, row, column))
      } else {
        borderIndices.push(toIndex(grid, row, column))
      }
    }
  }
  return succeed(1, centerIndices, borderIndices)
}

export const matchTopBottomSum: RuleMatcher = (grid) => {
  const top = grid.slice(0, 2).flat().reduce((sum, value) => sum + value, 0)
  const bottom = grid.slice(2).flat().reduce((sum, value) => sum + value, 0)
  if (top <= bottom) return fail()
  const topIndices: number[] = []
  const bottomIndices: number[] = []
  const width = grid[0]?.length ?? 0
  for (let column = 0; column < width; column++) {
    topIndices.push(toIndex(grid, 0, column), toIndex(grid, 1, column))
  }
  for (let row = 2; row < grid.length; row++) {
    for (let column = 0; column < width; column++) {
      bottomIndices.push(toIndex(grid, row, column))
    }
  }
  return succeed(1, topIndices, bottomIndices)
}

export const matchUniformBlock: RuleMatcher = (grid, rawParams) => {
  const { width, height } = rawParams as { width: number; height: number }
  for (let row = 0; row <= grid.length - height; row++) {
    for (let column = 0; column <= grid[row]!.length - width; column++) {
      const value = grid[row]![column]!
      let matches = true
      for (let dr = 0; dr < height && matches; dr++) {
        for (let dc = 0; dc < width; dc++) {
          if (grid[row + dr]![column + dc] !== value) { matches = false; break }
        }
      }
      if (matches) {
        const indices: number[] = []
        for (let dr = 0; dr < height; dr++) {
          for (let dc = 0; dc < width; dc++) {
            indices.push(toIndex(grid, row + dr, column + dc))
          }
        }
        return succeed(1, indices)
      }
    }
  }
  return fail()
}

export const matchSplitHalves: RuleMatcher = (grid) => {
  const valid = (orientation: 'rows' | 'columns') => {
    const firstIndices: number[] = []
    const secondIndices: number[] = []
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid[row]!.length; column++) {
        const firstHalf = orientation === 'rows' ? row < grid.length / 2 : column < grid[row]!.length / 2
        const value = grid[row]![column]!
        if (firstHalf ? value > 4 : value < 5) return null
        ;(firstHalf ? firstIndices : secondIndices).push(toIndex(grid, row, column))
      }
    }
    return [firstIndices, secondIndices] as const
  }
  const rowResult = valid('rows')
  if (rowResult) return succeed(1, ...rowResult)
  const colResult = valid('columns')
  if (colResult) return succeed(1, ...colResult)
  return fail()
}

export const matchMonotonicLines: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const { maxDifference = 2 } = (rawParams ?? {}) as { maxDifference?: number }
  const width = grid[0]?.length ?? 0
  if (grid.length === 0 || width === 0 || grid.some((row) => row.length !== width)) return 0

  const direction = (values: number[]): 'increasing' | 'decreasing' | 'both' | null => {
    const differences = values.slice(1).map((value, index) => value - values[index]!)
    if (differences.some((difference) => Math.abs(difference) > maxDifference)) return null
    const increasing = differences.every((difference) => difference >= 0)
    const decreasing = differences.every((difference) => difference <= 0)
    if (increasing && decreasing) return 'both'
    if (increasing) return 'increasing'
    if (decreasing) return 'decreasing'
    return null
  }

  const shareDirection = (sequences: number[][]): boolean => {
    const directions = sequences.map(direction)
    if (directions.some((value) => value === null)) return false
    const fixed = directions.find((value) => value !== 'both')
    return fixed === undefined || directions.every((value) => value === 'both' || value === fixed)
  }

  const columns = Array.from({ length: width }, (_, column) => grid.map((row) => row[column]!))
  return shareDirection(grid) && shareDirection(columns) ? 1 : 0
})

export const matchCenterBorderDigits: RuleMatcher = (grid) => {
  const centerIndices: number[] = []
  const borderIndices: number[] = []
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      const center = row > 0 && row < grid.length - 1 && column > 0 && column < grid[row]!.length - 1
      if (center ? grid[row]![column] !== 0 : grid[row]![column] === 0) return fail()
      ;(center ? centerIndices : borderIndices).push(toIndex(grid, row, column))
    }
  }
  return succeed(1, centerIndices, borderIndices)
}

export const matchSevenSegmentRotation: RuleMatcher = asResultMatcher((grid) => {
  const rotated: Partial<Record<number, number>> = { 0: 0, 1: 1, 2: 5, 5: 2, 6: 9, 8: 8, 9: 6 }
  const height = grid.length
  const width = grid[0]?.length ?? 0
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (rotated[grid[row]![column]!] !== grid[height - 1 - row]![width - 1 - column]) return 0
    }
  }
  return 1
})

export const matchNoAdjacentEqual: RuleMatcher = asResultMatcher((grid) => {
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      if (grid[row]![column] === grid[row + 1]?.[column] ||
          grid[row]![column] === grid[row]![column + 1]) return 0
    }
  }
  return 1
})

export const matchUniformMandarinTone: RuleMatcher = asResultMatcher((grid) => {
  const tones = [2, 1, 4, 1, 4, 3, 4, 1, 1, 3]
  return new Set(flat(grid).map((digit) => tones[digit])).size === 1 ? 1 : 0
})

export const matchZeroCurl: RuleMatcher = asResultMatcher((grid) => {
  for (let row = 0; row < grid.length - 1; row++) {
    for (let column = 0; column < grid[row]!.length - 1; column++) {
      if (grid[row]![column]! + grid[row + 1]![column + 1]! !==
          grid[row]![column + 1]! + grid[row + 1]![column]!) return 0
    }
  }
  return 1
})

export const matchHorizontalSequence: RuleMatcher = (grid, rawParams) => {
  const { sequence, everyRow = false } = rawParams as { sequence: number[]; everyRow?: boolean }
  const contains = (row: number[]) => row.some((_, start) =>
    sequence.every((value, offset) => row[start + offset] === value),
  )
  const rowIndices: number[][] = []
  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    if (contains(grid[rowIndex]!)) {
      rowIndices.push(grid[rowIndex]!.map((_, col) => toIndex(grid, rowIndex, col)))
    }
  }
  if (everyRow && rowIndices.length === grid.length) return succeed(1, ...rowIndices)
  if (!everyRow && rowIndices.length > 0) return succeed(1, ...rowIndices)
  return fail()
}

function isChampion(values: number[]): boolean {
  const counts = new Map<number, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return (counts.get(4) ?? 0) >= 4 || [...counts.values()].some((count) => count >= 5)
}

function isGoldenFlower(values: number[]): boolean {
  return values.filter((value) => value === 4).length === 4 && values.filter((value) => value === 1).length === 2
}

function isNoPrize(values: number[]): boolean {
  const counts = new Map<number, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return !values.includes(4) && [...counts.values()].every((count) => count < 4)
}

export const matchBoBing: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const { category, scope = 'any-row-column' } = rawParams as {
    category: 'champion' | 'golden-flower' | 'no-prize'
    scope?: 'any-row-column' | 'all-lines'
  }
  const predicate = category === 'champion' ? isChampion : category === 'golden-flower' ? isGoldenFlower : isNoPrize
  const candidates = lines(grid, scope === 'all-lines')
  return (scope === 'all-lines' ? candidates.every(predicate) : candidates.some(predicate)) ? 1 : 0
})

export const matchMinesweeper: RuleMatcher = (grid) => {
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      let zeros = 0
      const zeroIndices: number[] = []
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if ((dr !== 0 || dc !== 0) && grid[row + dr]?.[column + dc] === 0) {
            zeros++
            zeroIndices.push(toIndex(grid, row + dr, column + dc))
          }
        }
      }
      if (grid[row]![column] === zeros) {
        return succeed(1, [toIndex(grid, row, column)], zeroIndices)
      }
    }
  }
  return fail()
}

export const matchDigitCounts: RuleMatcher = (grid, rawParams) => {
  const { counts } = rawParams as { counts: Record<string, number> }
  const actual = new Map<number, number>()
  flat(grid).forEach((digit) => actual.set(digit, (actual.get(digit) ?? 0) + 1))
  const groups = Object.entries(counts).map(([digitString, count]) => {
    const digit = Number(digitString)
    if (actual.get(digit) !== count) return null
    const indices: number[] = []
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid[row]!.length; column++) {
        if (grid[row]![column] === digit) indices.push(toIndex(grid, row, column))
      }
    }
    return indices
  })
  return groups.every((group) => group !== null) ? succeed(1, ...(groups as number[][])) : fail()
}

export const matchNetherPortal: RuleMatcher = (grid) => {
  for (let height = 5; height <= Math.min(6, grid.length); height++) {
    for (let width = 4; width <= Math.min(6, grid[0]?.length ?? 0); width++) {
      for (let startRow = 0; startRow <= grid.length - height; startRow++) {
        for (let startColumn = 0; startColumn <= grid[0]!.length - width; startColumn++) {
          let valid = true
          const frameIndices: number[] = []
          const interiorIndices: number[] = []
          for (let row = 0; row < height && valid; row++) {
            for (let column = 0; column < width; column++) {
              const border = row === 0 || row === height - 1 || column === 0 || column === width - 1
              const value = grid[startRow + row]![startColumn + column]!
              if (border ? value < 7 : value > 2) { valid = false; break }
              ;(border ? frameIndices : interiorIndices).push(toIndex(grid, startRow + row, startColumn + column))
            }
          }
          if (valid) return succeed(1, frameIndices, interiorIndices)
        }
      }
    }
  }
  return fail()
}

export const matchPareto: RuleMatcher = (grid, rawParams) => {
  const { cellPercent = 20, sumPercent = 80 } = (rawParams ?? {}) as { cellPercent?: number; sumPercent?: number }
  const values = flat(grid).sort((a, b) => b - a)
  const take = Math.floor(values.length * cellPercent / 100)
  const selected = values.slice(0, take).reduce((sum, value) => sum + value, 0)
  const total = values.reduce((sum, value) => sum + value, 0)
  if (selected * 100 < total * sumPercent) return fail()
  const selectedIndices: number[] = []
  const threshold = values[take - 1]!
  const remaining = new Map(values.slice(0, take).map((v) => [v, (v === threshold ? take - values.slice(0, take).filter((x) => x > v).length : values.slice(0, take).filter((x) => x === v).length)] as const))
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      const value = grid[row]![column]!
      if (value > threshold || (value === threshold && (remaining.get(value) ?? 0) > 0)) {
        selectedIndices.push(toIndex(grid, row, column))
        if (value === threshold) remaining.set(value, (remaining.get(value) ?? 1) - 1)
      }
    }
  }
  return succeed(1, selectedIndices)
}

export const matchDigitAbove: RuleMatcher = (grid, rawParams) => {
  const { upper, lower } = rawParams as { upper: number; lower: number }
  const upperIndices: number[] = []
  const lowerIndices: number[] = []
  const upperRows: number[] = []
  const lowerRows: number[] = []
  grid.forEach((row, index) => row.forEach((value, column) => {
    if (value === upper) {
      upperRows.push(index)
      upperIndices.push(toIndex(grid, index, column))
    }
    if (value === lower) {
      lowerRows.push(index)
      lowerIndices.push(toIndex(grid, index, column))
    }
  }))
  if (upperRows.length === 0 || lowerRows.length === 0) return fail()
  return Math.max(...upperRows) < Math.min(...lowerRows) ? succeed(1, upperIndices, lowerIndices) : fail()
}

export const matchRestrictedDigits: RuleMatcher = asResultMatcher((grid) => {
  for (let row = 0; row < grid.length; row++) {
    for (const value of grid[row]!) {
      if (value === 3 || (row < grid.length - 1 && value === 4)) return 0
    }
  }
  return 1
})

function spiral(grid: Grid): number[] {
  const result: number[] = []
  let top = 0
  let bottom = grid.length - 1
  let left = 0
  let right = (grid[0]?.length ?? 0) - 1
  while (top <= bottom && left <= right) {
    for (let column = left; column <= right; column++) result.push(grid[top]![column]!)
    top++
    for (let row = top; row <= bottom; row++) result.push(grid[row]![right]!)
    right--
    if (top <= bottom) {
      for (let column = right; column >= left; column--) result.push(grid[bottom]![column]!)
      bottom--
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row--) result.push(grid[row]![left]!)
      left++
    }
  }
  return result
}

export const matchSpiralPalindrome: RuleMatcher = asResultMatcher((grid) => isPalindrome(spiral(grid)) ? 1 : 0)

function isPrime(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 2) return false
  if (value % 2 === 0) return value === 2
  for (let divisor = 3; divisor * divisor <= value; divisor += 2) {
    if (value % divisor === 0) return false
  }
  return true
}

export const matchPairedRowPrimes: RuleMatcher = (grid) => {
  if (grid.length !== 6 || grid.some((row) => row.length !== 6)) return fail()
  const groups: number[][] = []
  for (let row = 0; row < 6; row += 2) {
    const value = Number([...grid[row]!, ...grid[row + 1]!].join(''))
    if (!isPrime(value)) return fail()
    const indices: number[] = []
    for (let offset = 0; offset < 2; offset++) {
      for (let column = 0; column < 6; column++) {
        indices.push(toIndex(grid, row + offset, column))
      }
    }
    groups.push(indices)
  }
  return succeed(1, ...groups)
}

export const matchBlockComment: RuleMatcher = (grid) => {
  const hasSequence = (row: number[], sequence: [number, number]) =>
    row.some((value, index) => value === sequence[0] && row[index + 1] === sequence[1])
  for (let startRow = 0; startRow < grid.length - 1; startRow++) {
    if (!hasSequence(grid[startRow]!, [1, 8])) continue
    for (let endRow = startRow + 1; endRow < grid.length; endRow++) {
      if (hasSequence(grid[endRow]!, [8, 1])) {
        const startIndices = grid[startRow]!.map((_, col) => toIndex(grid, startRow, col))
        const endIndices = grid[endRow]!.map((_, col) => toIndex(grid, endRow, col))
        return succeed(1, startIndices, endIndices)
      }
    }
  }
  return fail()
}

export const matchCyclicRow: RuleMatcher = (grid) => {
  const allowed = new Set(['142857', '285714', '428571', '571428', '714285', '857142'])
  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    if (allowed.has(grid[rowIndex]!.join(''))) {
      const indices = grid[rowIndex]!.map((_, col) => toIndex(grid, rowIndex, col))
      return succeed(1, indices)
    }
  }
  return fail()
}

export const matchNQueens: RuleMatcher = (grid, rawParams) => {
  const { size = grid.length } = (rawParams ?? {}) as { size?: number }
  if (grid.length !== size || grid.some((row) => row.length !== size)) return fail()
  for (let digit = 0; digit <= 9; digit++) {
    const positions: [number, number][] = []
    grid.forEach((row, r) => row.forEach((value, c) => { if (value === digit) positions.push([r, c]) }))
    if (positions.length !== size) continue
    if (new Set(positions.map(([r]) => r)).size !== size || new Set(positions.map(([, c]) => c)).size !== size) continue
    if (new Set(positions.map(([r, c]) => r - c)).size !== size) continue
    if (new Set(positions.map(([r, c]) => r + c)).size !== size) continue
    return succeed(1, positions.map(([r, c]) => toIndex(grid, r, c)))
  }
  return fail()
}

export const matchSelfDescribingRegions: RuleMatcher = (grid) => {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const visited = new Set<number>()

  const groups: number[][] = []
  for (let startRow = 0; startRow < height; startRow++) {
    for (let startColumn = 0; startColumn < width; startColumn++) {
      const startKey = startRow * width + startColumn
      if (visited.has(startKey)) continue
      const value = grid[startRow]![startColumn]!
      const queue: [number, number][] = [[startRow, startColumn]]
      visited.add(startKey)
      const indices: number[] = []
      while (queue.length > 0) {
        const [row, column] = queue.shift()!
        indices.push(toIndex(grid, row, column))
        for (const [dr, dc] of ORTHOGONAL_DIRECTIONS) {
          const nextRow = row + dr
          const nextColumn = column + dc
          const key = nextRow * width + nextColumn
          if (grid[nextRow]?.[nextColumn] === value && !visited.has(key)) {
            visited.add(key)
            queue.push([nextRow, nextColumn])
          }
        }
      }
      if (indices.length !== value) return fail()
      groups.push(indices)
    }
  }
  return succeed(1, ...groups)
}

export const matchRunLengthCompression: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const { originalLength = flat(grid).length } = (rawParams ?? {}) as { originalLength?: number }
  const values = flat(grid)
  if (values.length === 0) return 0

  let runCount = 1
  for (let index = 1; index < values.length; index++) {
    if (values[index] !== values[index - 1]) runCount++
  }

  return runCount * 2 < originalLength ? 1 : 0
})

export const matchCakePair: RuleMatcher = (grid) => {
  const cake = [
    ['m', 'm', 'm'],
    ['s', 'e', 's'],
    ['w', 'w', 'w'],
  ]
  const bindingsAt = (startRow: number, startColumn: number, flipped: boolean): Map<string, number> | null => {
    const bindings = new Map<string, number>()
    const reverse = new Map<number, string>()
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const symbol = cake[flipped ? 2 - row : row]![column]!
        const value = grid[startRow + row]?.[startColumn + column]
        if (value === undefined) return null
        const bound = bindings.get(symbol)
        if (bound !== undefined && bound !== value) return null
        if (bound === undefined && reverse.has(value)) return null
        bindings.set(symbol, value)
        reverse.set(value, symbol)
      }
    }
    return bindings
  }

  const positions: Array<{ row: number; column: number; bindings: Map<string, number> }> = []
  for (let row = 0; row <= grid.length - 3; row++) {
    for (let column = 0; column <= grid[row]!.length - 3; column++) {
      const bindings = bindingsAt(row, column, false)
      if (bindings) positions.push({ row, column, bindings })
    }
  }
  for (const first of positions) {
    for (let row = 0; row <= grid.length - 3; row++) {
      for (let column = 0; column <= grid[row]!.length - 3; column++) {
        if (row === first.row && column === first.column) continue
        const second = bindingsAt(row, column, true)
        if (second && [...first.bindings].every(([symbol, value]) => second.get(symbol) === value)) {
          const firstIndices: number[] = []
          const secondIndices: number[] = []
          for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 3; dc++) {
              firstIndices.push(toIndex(grid, first.row + dr, first.column + dc))
              secondIndices.push(toIndex(grid, row + dr, column + dc))
            }
          }
          return succeed(1, firstIndices, secondIndices)
        }
      }
    }
  }
  return fail()
}

export const matchTetrominoes: RuleMatcher = (grid, rawParams) => {
  const { shapes = 'tljsz', coefficient = 'exponential' } = (rawParams ?? {}) as {
    shapes?: 'tljsz' | 'all'
    coefficient?: 'count' | 'exponential'
  }
  const allowed = shapes === 'all' ? ALL_TETROMINO_SHAPES : TETROMINO_SHAPES
  const matchGroups: number[][] = []
  for (let digit = 0; digit <= 9; digit++) {
    for (const component of connectedComponents(grid, digit)) {
      if (component.length === 4 && allowed.has(normalizeShape(component))) {
        matchGroups.push(component.map(([r, c]) => toIndex(grid, r, c)))
      }
    }
  }
  if (matchGroups.length === 0) return fail()
  const coeff = coefficient === 'count' ? matchGroups.length : 2 ** (matchGroups.length - 1)
  return succeedMultiple(coeff, matchGroups.map((g) => [g]))
}

export const matchNarrowField: RuleMatcher = (grid) => {
  const tetrominoCells = new Set<string>()
  for (let digit = 0; digit <= 9; digit++) {
    for (const component of connectedComponents(grid, digit)) {
      if (component.length === 4 && ALL_TETROMINO_SHAPES.has(normalizeShape(component))) {
        component.forEach(([row, column]) => tetrominoCells.add(cellKey(row, column)))
      }
    }
  }
  if (tetrominoCells.size === 0) return fail()
  const cleared = grid.filter((row, rowIndex) =>
    row.every((_, columnIndex) => tetrominoCells.has(cellKey(rowIndex, columnIndex))),
  ).length
  if (cleared === 0) return fail()
  return succeed(cleared, wholeBoardIndices(grid))
}

export const matchCapturedStones: RuleMatcher = (grid) => {
  const candidates: Array<{ cells: Cell[]; surroundedBy: number }> = []

  for (let digit = 0; digit <= 9; digit++) {
    for (const component of connectedComponents(grid, digit)) {
      const surroundingDigits = new Set<number>()
      for (const [row, column] of component) {
        for (const [dr, dc] of ORTHOGONAL_DIRECTIONS) {
          const neighbor = grid[row + dr]?.[column + dc]
          if (neighbor !== undefined && neighbor !== digit) surroundingDigits.add(neighbor)
        }
      }
      if (surroundingDigits.size === 1) {
        candidates.push({ cells: component, surroundedBy: [...surroundingDigits][0]! })
      }
    }
  }

  const captured = candidates.reduce((total, candidate) => {
    const ownDigit = grid[candidate.cells[0]![0]]![candidate.cells[0]![1]]!
    const reverse = candidates.find((other) =>
      grid[other.cells[0]![0]]![other.cells[0]![1]] === candidate.surroundedBy &&
      other.surroundedBy === ownDigit,
    )
    if (reverse && candidate.cells.length >= reverse.cells.length) return total
    return total + candidate.cells.length
  }, 0)

  if (captured === 0) return fail()
  const matchGroups = candidates
    .filter((c) => {
      const ownDigit = grid[c.cells[0]![0]]![c.cells[0]![1]]!
      const reverse = candidates.find((other) =>
        grid[other.cells[0]![0]]![other.cells[0]![1]] === c.surroundedBy &&
        other.surroundedBy === ownDigit,
      )
      return !reverse || c.cells.length < reverse.cells.length
    })
    .map((c) => c.cells.map(([r, col]) => toIndex(grid, r, col)))
  return succeedMultiple(captured, matchGroups.map((g) => [g]))
}

function matchEShapeDirection(grid: Grid, mirrored: boolean): RuleMatchResult {
  const width = grid[0]?.length ?? 0
  const matchGroups: number[][] = []
  for (let digit = 0; digit <= 9; digit++) {
    for (let spineColumn = 0; spineColumn < width; spineColumn++) {
      const direction = mirrored ? -1 : 1
      for (let top = 0; top <= grid.length - 5; top++) {
        for (let bottom = top + 4; bottom < grid.length; bottom++) {
          for (let middle = top + 2; middle <= bottom - 2; middle++) {
            const spineValid = Array.from({ length: bottom - top + 1 }, (_, offset) => top + offset)
              .every((row) => grid[row]?.[spineColumn] === digit)
            if (!spineValid) continue
            const armLength = (row: number) => {
              let length = 0
              for (let column = spineColumn + direction; column >= 0 && column < width; column += direction) {
                if (grid[row]?.[column] !== digit) break
                length++
              }
              return length
            }
            const topLength = armLength(top)
            const middleLength = armLength(middle)
            const bottomLength = armLength(bottom)
            if (topLength < 1 || middleLength < 1 || bottomLength < 1 ||
                topLength < middleLength || bottomLength < middleLength) continue
            let clearBetween = true
            for (let row = top + 1; row < bottom && clearBetween; row++) {
              if (row === middle) continue
              const limit = Math.max(topLength, middleLength, bottomLength)
              for (let step = 1; step <= limit; step++) {
                if (grid[row]?.[spineColumn + direction * step] === digit) { clearBetween = false; break }
              }
            }
            if (clearBetween) {
              const indices: number[] = []
              for (let row = top; row <= bottom; row++) {
                const limit = row === top ? topLength : row === middle ? middleLength : row === bottom ? bottomLength : 0
                for (let step = 0; step <= limit; step++) {
                  indices.push(toIndex(grid, row, spineColumn + direction * step))
                }
              }
              matchGroups.push(indices)
            }
          }
        }
      }
    }
  }
  if (matchGroups.length === 0) return fail()
  return succeedMultiple(1, matchGroups.map((g) => [g]))
}

export const matchEShape: RuleMatcher = (grid, rawParams) => {
  const { mirrored = false } = (rawParams ?? {}) as { mirrored?: boolean }
  return matchEShapeDirection(grid, mirrored)
}

function componentHoleCount(grid: Grid, component: Cell[]): number {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const wall = new Set(component.map(([row, column]) => cellKey(row, column)))
  const visited = new Set<string>()
  let holes = 0

  for (let startRow = 0; startRow < height; startRow++) {
    for (let startColumn = 0; startColumn < width; startColumn++) {
      const start = cellKey(startRow, startColumn)
      if (wall.has(start) || visited.has(start)) continue
      const queue: Cell[] = [[startRow, startColumn]]
      visited.add(start)
      let touchesBoundary = false
      while (queue.length > 0) {
        const [row, column] = queue.shift()!
        if (row === 0 || column === 0 || row === height - 1 || column === width - 1) touchesBoundary = true
        for (const [dr, dc] of ORTHOGONAL_DIRECTIONS) {
          const nextRow = row + dr
          const nextColumn = column + dc
          if (nextRow < 0 || nextRow >= height || nextColumn < 0 || nextColumn >= width) continue
          const key = cellKey(nextRow, nextColumn)
          if (!wall.has(key) && !visited.has(key)) {
            visited.add(key)
            queue.push([nextRow, nextColumn])
          }
        }
      }
      if (!touchesBoundary) holes++
    }
  }
  return holes
}

export const matchValueMask: RuleMatcher = (grid, rawParams) => {
  const { pattern, values } = rawParams as {
    pattern: string[]
    values: Record<string, number[]>
  }
  if (pattern.length !== grid.length || pattern.some((row, index) => Array.from(row).length !== grid[index]?.length)) {
    return fail()
  }

  const groups = new Map<string, number[]>()
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row]!.length; column++) {
      const token = Array.from(pattern[row]!)[column]!
      if (token === ' ') continue
      const allowed = values[token]
      if (!allowed?.includes(grid[row]![column]!)) return fail()
      if (!groups.has(token)) groups.set(token, [])
      groups.get(token)!.push(toIndex(grid, row, column))
    }
  }
  return succeed(1, ...groups.values())
}

export const matchLoopCount: RuleMatcher = asResultMatcher((grid, rawParams) => {
  const { threshold = 36 } = (rawParams ?? {}) as { threshold?: number }
  const digitLoops: Record<number, number> = { 0: 1, 6: 1, 8: 2, 9: 1 }
  const printed = flat(grid).reduce((sum, digit) => sum + (digitLoops[digit] ?? 0), 0)
  let enclosed = 0
  for (let digit = 0; digit <= 9; digit++) {
    for (const component of connectedComponents(grid, digit, EIGHT_DIRECTIONS)) {
      enclosed += componentHoleCount(grid, component)
    }
  }
  return printed + enclosed > threshold ? 1 : 0
})

export const algorithmicMatchers: Readonly<Record<string, RuleMatcher>> = {
  'cake-pair': matchCakePair,
  tetrominoes: matchTetrominoes,
  'narrow-field': matchNarrowField,
  'captured-stones': matchCapturedStones,
  'e-shape': matchEShape,
  'value-mask': matchValueMask,
  'loop-count': matchLoopCount,
  'determinant-zero': matchDeterminantZero,
  'sequential-path': matchSequentialPath,
  'diagonal-increasing': matchDiagonalIncreasing,
  'sum-compare': matchSumCompare,
  'diagonal-triangle': matchDiagonalTriangle,
  'board-symmetry': matchBoardSymmetry,
  'all-2x2-parity': matchAll2x2Parity,
  'diagonal-correspondence': matchDiagonalCorrespondence,
  'sudoku-6x6': matchSudoku6x6,
  'line-sum-parity': matchLineSumParity,
  'line-palindrome': matchLinePalindrome,
  'line-unique': matchLineUnique,
  'checkerboard-parity': matchCheckerboardParity,
  'equal-quadrant-sums': matchEqualQuadrantSums,
  'missing-digit-count': matchMissingDigitCount,
  'center-border-sum': matchCenterBorderSum,
  'top-bottom-sum': matchTopBottomSum,
  'uniform-block': matchUniformBlock,
  'split-halves': matchSplitHalves,
  'monotonic-lines': matchMonotonicLines,
  'center-border-digits': matchCenterBorderDigits,
  'seven-segment-rotation': matchSevenSegmentRotation,
  'no-adjacent-equal': matchNoAdjacentEqual,
  'uniform-mandarin-tone': matchUniformMandarinTone,
  'zero-curl': matchZeroCurl,
  'horizontal-sequence': matchHorizontalSequence,
  'bo-bing': matchBoBing,
  minesweeper: matchMinesweeper,
  'digit-counts': matchDigitCounts,
  'nether-portal': matchNetherPortal,
  pareto: matchPareto,
  'digit-above': matchDigitAbove,
  'restricted-digits': matchRestrictedDigits,
  'spiral-palindrome': matchSpiralPalindrome,
  'paired-row-primes': matchPairedRowPrimes,
  'block-comment': matchBlockComment,
  'cyclic-row': matchCyclicRow,
  'n-queens': matchNQueens,
  'self-describing-regions': matchSelfDescribingRegions,
  'run-length-compression': matchRunLengthCompression,
}