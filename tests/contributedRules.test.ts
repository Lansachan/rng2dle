import { describe, expect, it } from 'vitest'
import { getMatcher } from '../src/game/rules/registry'

describe('contributed novelty rules', () => {
  it('matches an upside-down creeper using independent allowed values', () => {
    const grid = [
      [0, 7, 1, 2, 8, 0],
      [2, 7, 8, 9, 7, 1],
      [0, 9, 7, 8, 9, 2],
      [1, 2, 7, 9, 0, 1],
      [7, 8, 0, 2, 9, 7],
      [9, 7, 1, 0, 8, 9],
    ]
    const result = getMatcher('value-mask')(grid, {
      pattern: ['.#..#.', '.####.', '.####.', '..##..', '##..##', '##..##'],
      values: { '#': [7, 8, 9], '.': [0, 1, 2] },
    })
    expect(result.coefficient).toBe(1)
    expect(result.matches[0]?.groups).toHaveLength(2)
    expect(result.matches[0]?.groups[0]).toHaveLength(16)
    expect(result.matches[0]?.groups[1]).toHaveLength(20)
  })

  it('rejects an invalid face or background value', () => {
    const grid = Array.from({ length: 6 }, () => Array(6).fill(0))
    const result = getMatcher('value-mask')(grid, {
      pattern: ['.#..#.', '.####.', '.####.', '..##..', '##..##', '##..##'],
      values: { '#': [7, 8, 9], '.': [0, 1, 2] },
    })
    expect(result).toEqual({ coefficient: 0, matches: [] })
  })

  it('counts overlapping 5x5 diamonds', () => {
    const grid = Array.from({ length: 6 }, () => Array(6).fill(7))
    const result = getMatcher('pattern-matcher')(grid, {
      pattern: ['  D  ', ' DDD ', 'DDDDD', ' DDD ', '  D  '],
      multiple: true,
      coefficient: { type: 'match-count' },
    })
    expect(result.coefficient).toBe(4)
    expect(result.matches).toHaveLength(4)
  })

  it('matches a pickaxe with a five-cell head and different handle', () => {
    const grid = [
      [9, 9, 9, 0, 0, 0],
      [9, 0, 9, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]
    const result = getMatcher('pattern-matcher')(grid, {
      pattern: ['HHH', 'H H', ' X ', ' X '],
      coefficient: { type: 'match-count' },
    })
    expect(result.coefficient).toBe(1)
    expect(result.matches[0]?.groups.map((group) => group.length)).toEqual([5, 2])
  })

  it('uses the lower loop threshold without changing the loop matcher', () => {
    const grid = Array.from({ length: 6 }, () => Array(6).fill(8))
    expect(getMatcher('loop-count')(grid, { threshold: 17 }).coefficient).toBe(1)
  })
})
