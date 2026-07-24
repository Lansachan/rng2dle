import { describe, expect, it } from 'vitest'
import fixtures from './fixtures/rules.json'
import rawRules from '../src/game/rules/rules.json'
import { loadRules } from '../src/game/rules/loadRules'
import { getMatcher } from '../src/game/rules/registry'

const rules = loadRules(rawRules)

describe('production rule fixtures', () => {
  for (const fixture of fixtures) {
    const rule = rules.find((candidate) => candidate.id === fixture.ruleId)

    it(`references existing rule ${fixture.ruleId}`, () => {
      expect(rule).toBeDefined()
    })

    for (const testCase of fixture.cases) {
      it(`${fixture.ruleId}: ${testCase.name}`, () => {
        expect(rule).toBeDefined()
        if (!rule) return

        const result = getMatcher(rule.matcherKey)(testCase.grid, rule.params)
        expect(result.coefficient).toBe(testCase.expectedCoefficient)
        expect(result.coefficient * rule.baseScore).toBe(testCase.expectedCoefficient * rule.baseScore)
      })
    }
  }

  it('provides fixtures for every production rule', () => {
    expect(new Set(fixtures.map((fixture) => fixture.ruleId))).toEqual(
      new Set(rules.map((rule) => rule.id)),
    )
  })
})
