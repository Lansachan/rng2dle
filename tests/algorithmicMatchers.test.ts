import { describe, expect, it } from 'vitest'
import { getMatcher } from '../src/game/rules/registry'

const constantGrid = (value: number) => Array.from({ length: 6 }, () => Array(6).fill(value))
const matcher = (key: string, grid: number[][], params: unknown = {}) =>
  getMatcher(key)(grid, params).coefficient

describe('algorithmic matchers', () => {
  it('checks exact determinant zero with integer arithmetic', () => {
    expect(matcher('determinant-zero', constantGrid(1))).toBe(1)
    const identity = Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => r === c ? 1 : 0))
    expect(matcher('determinant-zero', identity)).toBe(0)
  })

  it('finds a sequential orthogonal path', () => {
    const grid = constantGrid(9)
    grid[0] = [0, 1, 2, 3, 4, 5]
    grid[1] = [9, 8, 7, 6, 5, 9]
    expect(matcher('sequential-path', grid)).toBe(1)
  })

  it('checks sum comparison', () => {
    expect(matcher('sum-compare', constantGrid(4), { operator: 'eq', value: 144 })).toBe(1)
    expect(matcher('sum-compare', constantGrid(4), { operator: 'lt', value: 100 })).toBe(0)
  })

  it('checks board transforms in all and any modes', () => {
    const horizontal = [
      [1, 2, 3, 4, 5, 6],
      [2, 3, 4, 5, 6, 7],
      [3, 4, 5, 6, 7, 8],
      [3, 4, 5, 6, 7, 8],
      [2, 3, 4, 5, 6, 7],
      [1, 2, 3, 4, 5, 6],
    ]
    expect(matcher('board-symmetry', horizontal, { transforms: ['reflect-horizontal'] })).toBe(1)
    expect(matcher('board-symmetry', horizontal, {
      transforms: ['reflect-horizontal', 'reflect-vertical'], mode: 'any',
    })).toBe(1)
    expect(matcher('board-symmetry', horizontal, {
      transforms: ['reflect-horizontal', 'reflect-vertical'],
    })).toBe(0)
  })

  it('checks diagonal triangle orientation', () => {
    const grid = Array.from({ length: 6 }, (_, r) =>
      Array.from({ length: 6 }, (_, c) => c < r ? 0 : c === r ? 1 : 2),
    )
    expect(matcher('diagonal-triangle', grid)).toBe(1)
    grid[2]![2] = 0
    expect(matcher('diagonal-triangle', grid)).toBe(0)
  })

  it('checks Sudoku and uniqueness independently', () => {
    const sudoku = [
      [1, 2, 3, 4, 5, 6], [4, 5, 6, 1, 2, 3],
      [2, 3, 4, 5, 6, 1], [5, 6, 1, 2, 3, 4],
      [3, 4, 5, 6, 1, 2], [6, 1, 2, 3, 4, 5],
    ]
    expect(matcher('sudoku-6x6', sudoku)).toBe(1)
    sudoku[0]![0] = 2
    expect(matcher('sudoku-6x6', sudoku)).toBe(0)
  })

  it('requires a shared monotonic direction for all rows and all columns', () => {
    const gradient = Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 6 }, (_, column) => row + column),
    )
    expect(matcher('monotonic-lines', gradient, { maxDifference: 2 })).toBe(1)

    const oppositeRows = gradient.map((row, index) => index === 1 ? [...row].reverse() : row)
    expect(matcher('monotonic-lines', oppositeRows, { maxDifference: 2 })).toBe(0)

    const rowUpColumnDown = Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 6 }, (_, column) => 5 - row + column),
    )
    expect(matcher('monotonic-lines', rowUpColumnDown, { maxDifference: 2 })).toBe(1)
  })

  it('checks region and line properties', () => {
    expect(matcher('uniform-block', constantGrid(3), { width: 3, height: 3 })).toBe(1)
    expect(matcher('board-symmetry', constantGrid(3), {
      transforms: ['reflect-horizontal', 'reflect-vertical'],
    })).toBe(1)
    expect(matcher('equal-quadrant-sums', constantGrid(2))).toBe(1)
    expect(matcher('no-adjacent-equal', constantGrid(2))).toBe(0)
  })

  it('checks digit counts and missing digits', () => {
    const grid = Array.from({ length: 6 }, () => [1, 2, 3, 4, 5, 6])
    expect(matcher('digit-counts', grid, { counts: { 1: 6, 6: 6 } })).toBe(1)
    expect(matcher('missing-digit-count', grid, { count: 4 })).toBe(1)
  })

  it('checks specialized sequence and geometry rules', () => {
    expect(matcher('horizontal-sequence', Array.from({ length: 6 }, () => [7, 7, 3, 4, 0, 0]), {
      sequence: [7, 7, 3, 4], everyRow: true,
    })).toBe(1)
    expect(matcher('cyclic-row', [[1, 4, 2, 8, 5, 7]])).toBe(1)
    expect(matcher('block-comment', [[1, 8], [0, 0], [8, 1]])).toBe(1)
  })

  it('checks n queens', () => {
    const grid = constantGrid(0)
    const columns = [1, 3, 5, 0, 2, 4]
    columns.forEach((column, row) => { grid[row]![column] = 7 })
    expect(matcher('n-queens', grid, { size: 6 })).toBe(1)
  })

  it('requires cake and vertically reversed cake with shared bindings', () => {
    const grid = [
      [1, 1, 1, 2, 2, 2],
      [3, 4, 3, 5, 6, 5],
      [7, 7, 7, 8, 8, 8],
      [7, 7, 7, 8, 8, 8],
      [3, 4, 3, 5, 6, 5],
      [1, 1, 1, 2, 2, 2],
    ]
    expect(matcher('cake-pair', grid)).toBe(1)
    const invalid = grid.map((row) => [...row])
    invalid[3] = [0, 1, 2, 3, 4, 5]
    invalid[4] = [5, 4, 3, 2, 1, 0]
    invalid[5] = [0, 1, 2, 3, 4, 5]
    expect(matcher('cake-pair', invalid)).toBe(0)
  })

  it('recognizes exact tetromino components and exponentiates their count', () => {
    const grid = [
      [1, 1, 1, 9, 2, 9],
      [9, 1, 9, 9, 2, 9],
      [9, 9, 9, 9, 2, 2],
      [9, 9, 9, 9, 9, 9],
    ]
    expect(matcher('tetrominoes', grid, { shapes: 'tljsz', coefficient: 'exponential' })).toBe(2)
    grid[2]![1] = 1
    expect(matcher('tetrominoes', grid, { shapes: 'tljsz', coefficient: 'count' })).toBe(1)
  })

  it('counts full lines made entirely from detected tetrominoes', () => {
    const grid = [
      [1, 1, 2, 2, 3, 3],
      [1, 1, 2, 2, 3, 3],
    ]
    expect(matcher('narrow-field', grid)).toBe(2)
  })

  it('counts orthogonal groups completely surrounded by one other digit', () => {
    const grid = [
      [1, 1, 1, 1],
      [1, 2, 2, 1],
      [1, 2, 2, 1],
      [1, 1, 1, 1],
    ]
    expect(matcher('captured-stones', grid)).toBe(4)
    grid[1]![0] = 3
    expect(matcher('captured-stones', grid)).toBe(0)
  })

  it('recognizes E and mirrored E structures', () => {
    const e = [
      [1, 1, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ]
    const reversed = e.map((row) => [...row].reverse())
    expect(matcher('e-shape', e, { mirrored: false })).toBe(1)
    expect(matcher('e-shape', e, { mirrored: true })).toBe(0)
    expect(matcher('e-shape', reversed, { mirrored: true })).toBe(1)
  })

  it('counts printed digit loops and enclosed component holes', () => {
    expect(matcher('loop-count', constantGrid(8), { threshold: 36 })).toBe(1)
    const ring = [
      [1, 1, 1],
      [1, 2, 1],
      [1, 1, 1],
    ]
    expect(matcher('loop-count', ring, { threshold: 0 })).toBe(1)
  })

  it('compares row-major run-length encoding size with the original grid', () => {
    const compressible = [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2],
      [2, 2, 2, 2, 2, 2],
      [3, 3, 3, 3, 3, 3],
      [3, 3, 3, 3, 3, 3],
    ]
    expect(matcher('run-length-compression', compressible, { originalLength: 36 })).toBe(1)

    const eighteenRuns = Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 6 }, (_, column) => Math.floor((row * 6 + column) / 2) % 10),
    )
    expect(matcher('run-length-compression', eighteenRuns, { originalLength: 36 })).toBe(0)

    const crossRowRun = [
      [1, 2, 2, 2, 2, 7],
      [7, 3, 3, 3, 3, 3],
    ]
    expect(matcher('run-length-compression', crossRowRun, { originalLength: 12 })).toBe(1)
  })

  it('checks self-describing connected regions', () => {
    const grid = [
      [2, 2, 4, 4, 4, 4],
      [6, 6, 6, 6, 6, 6],
    ]
    expect(matcher('self-describing-regions', grid)).toBe(1)
    grid[0]![0] = 3
    expect(matcher('self-describing-regions', grid)).toBe(0)
  })
})
