import { describe, expect, it } from 'vitest'
import { matchDigitConstraints as runMatchDigitConstraints } from '../src/game/rules/matchers/matchDigitConstraints'

const matchDigitConstraints = (...args: Parameters<typeof runMatchDigitConstraints>) => runMatchDigitConstraints(...args).coefficient

const grid = [
  [1, 2, 3],
  [4, 5, 6],
]

describe('matchDigitConstraints', () => {
  it('requires every configured digit', () => {
    expect(matchDigitConstraints(grid, { requiredDigits: [1, 4, 6] })).toBe(1)
    expect(matchDigitConstraints(grid, { requiredDigits: [1, 7] })).toBe(0)
  })

  it('rejects any forbidden digit', () => {
    expect(matchDigitConstraints(grid, { forbiddenDigits: [0, 9] })).toBe(1)
    expect(matchDigitConstraints(grid, { forbiddenDigits: [0, 5] })).toBe(0)
  })

  it('rejects empty grids', () => {
    expect(matchDigitConstraints([], { forbiddenDigits: [0] })).toBe(0)
    expect(matchDigitConstraints([[]], { forbiddenDigits: [0] })).toBe(0)
  })

  it('combines required and forbidden constraints', () => {
    expect(
      matchDigitConstraints(grid, { requiredDigits: [2, 5], forbiddenDigits: [0, 9] }),
    ).toBe(1)
    expect(
      matchDigitConstraints(grid, { requiredDigits: [2, 5], forbiddenDigits: [6, 9] }),
    ).toBe(0)
  })
})
