import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { matchers } from '../src/game/rules/registry'

interface TextRule {
  id: string
  label: string
  matcherKey: string
  params: string
}

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replaceAll('""', '"')
    : value
}

function loadTextRules(): TextRule[] {
  const lines = readFileSync(new URL('../src/game/rules/rules.txt', import.meta.url), 'utf8')
    .trimEnd()
    .split(/\r?\n/)

  return lines.slice(1).map((line) => {
    const columns = line.split('\t').map(unquote)
    return {
      id: columns[0]!,
      label: columns[1]!,
      matcherKey: columns[7]!,
      params: columns[8]!,
    }
  })
}

const rules = loadTextRules()

describe('rules.txt', () => {
  it('contains every collected rule except intentionally empty rows', () => {
    const ids = new Set(rules.map((rule) => rule.id))
    expect(rules).toHaveLength(72)
    expect(ids).toHaveLength(72)
    expect(ids.has('rule-0036')).toBe(false)
    expect(ids.has('rule-0072')).toBe(false)
    for (let number = 1; number <= 73; number++) {
      if (number === 36 || number === 72) continue
      expect(ids.has(`rule-${String(number).padStart(4, '0')}`)).toBe(true)
    }
  })

  it('uses unique non-empty labels', () => {
    const labels = rules.map((rule) => rule.label)
    expect(labels.every(Boolean)).toBe(true)
    expect(new Set(labels)).toHaveLength(labels.length)
  })

  it('uses valid JSON params for implemented rules', () => {
    for (const rule of rules) {
      if (!rule.matcherKey) {
        expect(rule.params).toBe('')
        continue
      }
      expect(matchers[rule.matcherKey], rule.id).toBeDefined()
      expect(() => JSON.parse(rule.params), rule.id).not.toThrow()
    }
  })

  it('has an implementation for every rule', () => {
    expect(rules.filter((rule) => !rule.matcherKey)).toEqual([])
  })
})
