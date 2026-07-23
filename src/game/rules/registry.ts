import { matchByPattern } from './matchers/matchByPattern'
import { matchDigitConstraints } from './matchers/matchDigitConstraints'
import { algorithmicMatchers } from './matchers/algorithmic'
import type { DigitConstraintsParams, PatternParams, RuleMatcher } from './types'

export const matchers: Readonly<Record<string, RuleMatcher>> = {
  'pattern-matcher': (grid, params) => matchByPattern(grid, params as PatternParams),
  'digit-constraints': (grid, params) =>
    matchDigitConstraints(grid, params as DigitConstraintsParams),
  ...algorithmicMatchers,
}

export function getMatcher(matcherKey: string): RuleMatcher {
  const matcher = matchers[matcherKey]
  if (!matcher) throw new Error(`Unknown matcher key: ${matcherKey}`)
  return matcher
}
