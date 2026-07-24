import { describe, expect, it } from 'vitest'
import { matchByPattern as runMatchByPattern } from '../src/game/rules/matchers/matchByPattern'

const matchByPattern = (...args: Parameters<typeof runMatchByPattern>) => runMatchByPattern(...args).coefficient

describe('matchByPattern', () => {
  it('matches repeated symbols and distinguishes different symbols', () => {
    const grid = [
      [1, 1, 1],
      [1, 2, 1],
      [1, 1, 1],
    ]

    expect(matchByPattern(grid, { pattern: ['###', '#*#', '###'] })).toBe(1)
    expect(matchByPattern(grid, { pattern: ['###', '###', '###'] })).toBe(0)
  })

  it('supports wildcards and literal digits', () => {
    const grid = [
      [1, 2, 3],
      [4, 5, 6],
    ]

    expect(matchByPattern(grid, { pattern: ['1 3', '4 6'] })).toBe(1)
    expect(matchByPattern(grid, { pattern: ['1 2', '4 9'] })).toBe(0)
  })

  it('applies symbolValues', () => {
    const grid = [[3, 3]]

    expect(matchByPattern(grid, { pattern: ['##'], symbolValues: { '#': [2, 3] } })).toBe(1)
    expect(matchByPattern(grid, { pattern: ['##'], symbolValues: { '#': [1, 2] } })).toBe(0)
    expect(matchByPattern(grid, { pattern: ['##'], symbolValues: { '#': [] } })).toBe(0)
  })

  it('treats allowSameWith as undirected and non-transitive', () => {
    const grid = [[1, 1, 1]]

    expect(matchByPattern(grid, { pattern: ['#*'], allowSameWith: { '#': ['*'] } })).toBe(1)
    expect(matchByPattern(grid, { pattern: ['#*'], allowSameWith: { '*': ['#'] } })).toBe(1)
    expect(
      matchByPattern(grid, {
        pattern: ['#*@'],
        allowSameWith: { '#': ['*'], '*': ['@'] },
      }),
    ).toBe(0)
  })

  it('counts all matches when multiple is true', () => {
    const grid = [
      [1, 1, 2],
      [1, 1, 2],
    ]

    expect(
      matchByPattern(grid, {
        pattern: ['#'],
        multiple: true,
        coefficient: { type: 'match-count' },
      }),
    ).toBe(6)
  })

  it('greedily excludes overlapping match regions', () => {
    const grid = [[1, 1, 1, 1]]
    const baseParams = {
      pattern: ['##'],
      multiple: true,
      coefficient: { type: 'match-count' } as const,
    }

    expect(matchByPattern(grid, baseParams)).toBe(3)
    expect(matchByPattern(grid, { ...baseParams, allowOverlap: false })).toBe(2)
  })

  it('applies a coefficient strategy to the match count', () => {
    expect(
      matchByPattern([[1, 2, 3]], {
        pattern: ['#'],
        multiple: true,
        coefficient: { type: 'power', exponent: 2 },
      }),
    ).toBe(9)
  })

  it('returns zero when the pattern cannot fit or does not match', () => {
    expect(matchByPattern([[1]], { pattern: ['##'] })).toBe(0)
    expect(matchByPattern([[1]], { pattern: ['2'] })).toBe(0)
  })
})
