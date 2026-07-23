import { matchers } from './registry'
import type {
  CoefficientConfig,
  DigitConstraintsParams,
  PatternParams,
  RuleDefinition,
} from './types'
import { GRID_COLS, GRID_SIZE } from '../constants'

const GRID_ROWS = GRID_SIZE / GRID_COLS
const RULE_FIELDS = new Set([
  'id',
  'label',
  'name',
  'description',
  'baseScore',
  'matcherKey',
  'params',
])
const PATTERN_FIELDS = new Set([
  'pattern',
  'symbolValues',
  'allowSameWith',
  'multiple',
  'allowOverlap',
  'coefficient',
])
const DIGIT_CONSTRAINT_FIELDS = new Set(['requiredDigits', 'forbiddenDigits'])

function fail(path: string, message: string): never {
  throw new TypeError(`${path}: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) fail(path, 'must be an object')
  return value
}

function rejectUnknownFields(value: Record<string, unknown>, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'is not a supported field')
  }
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'must be a non-empty string')
  return value
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
  return value
}

function requireInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value)) fail(path, 'must be a safe integer')
  return value as number
}

function validateLocalizedText(value: unknown, path: string): { zh: string; en: string } {
  const text = requireRecord(value, path)
  rejectUnknownFields(text, new Set(['zh', 'en']), path)
  return {
    zh: requireNonEmptyString(text.zh, `${path}.zh`),
    en: requireNonEmptyString(text.en, `${path}.en`),
  }
}

function validateDigitArray(value: unknown, path: string, allowEmpty: boolean): number[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  if (!allowEmpty && value.length === 0) fail(path, 'must not be empty')

  const digits = value.map((digit, index) => {
    const result = requireInteger(digit, `${path}[${index}]`)
    if (result < 0 || result > 9) fail(`${path}[${index}]`, 'must be between 0 and 9')
    return result
  })

  if (new Set(digits).size !== digits.length) fail(path, 'must not contain duplicate digits')
  return digits
}

function coefficientFields(type: CoefficientConfig['type']): Set<string> {
  switch (type) {
    case 'constant':
      return new Set(['type', 'value'])
    case 'match-count':
      return new Set(['type'])
    case 'match-count-table':
      return new Set(['type', 'values'])
    case 'polynomial':
      return new Set(['type', 'coefficients'])
    case 'exponential':
      return new Set(['type', 'base', 'scale', 'offset'])
    case 'power':
      return new Set(['type', 'exponent', 'scale', 'offset'])
  }
}

export function validateCoefficientConfig(
  value: unknown,
  maximumMatchCount: number,
  path = 'coefficient',
): CoefficientConfig {
  const config = requireRecord(value, path)
  const type = requireNonEmptyString(config.type, `${path}.type`) as CoefficientConfig['type']
  const supportedTypes: CoefficientConfig['type'][] = [
    'constant',
    'match-count',
    'match-count-table',
    'polynomial',
    'exponential',
    'power',
  ]
  if (!supportedTypes.includes(type)) fail(`${path}.type`, `unknown strategy "${type}"`)
  rejectUnknownFields(config, coefficientFields(type), path)

  let result: CoefficientConfig
  switch (type) {
    case 'constant': {
      const constant = requireInteger(config.value, `${path}.value`)
      if (constant < 0) fail(`${path}.value`, 'must be non-negative')
      result = { type, value: constant }
      break
    }
    case 'match-count':
      result = { type }
      break
    case 'match-count-table': {
      if (!Array.isArray(config.values)) fail(`${path}.values`, 'must be an array')
      if (config.values.length !== maximumMatchCount + 1) {
        fail(`${path}.values`, `must contain ${maximumMatchCount + 1} entries for match counts 0–${maximumMatchCount}`)
      }
      const values = config.values.map((entry, index) => {
        const coefficient = requireInteger(entry, `${path}.values[${index}]`)
        if (coefficient < 0) fail(`${path}.values[${index}]`, 'must be non-negative')
        return coefficient
      })
      if (values[0] !== 0) fail(`${path}.values[0]`, 'must be 0')
      result = { type, values }
      break
    }
    case 'polynomial': {
      if (!Array.isArray(config.coefficients) || config.coefficients.length === 0) {
        fail(`${path}.coefficients`, 'must be a non-empty array')
      }
      result = {
        type,
        coefficients: config.coefficients.map((entry, index) =>
          requireInteger(entry, `${path}.coefficients[${index}]`),
        ),
      }
      break
    }
    case 'exponential': {
      const base = requireInteger(config.base, `${path}.base`)
      if (base < 0) fail(`${path}.base`, 'must be non-negative')
      result = {
        type,
        base,
        ...(config.scale === undefined ? {} : { scale: requireInteger(config.scale, `${path}.scale`) }),
        ...(config.offset === undefined ? {} : { offset: requireInteger(config.offset, `${path}.offset`) }),
      }
      break
    }
    case 'power': {
      const exponent = requireInteger(config.exponent, `${path}.exponent`)
      if (exponent < 0) fail(`${path}.exponent`, 'must be non-negative')
      result = {
        type,
        exponent,
        ...(config.scale === undefined ? {} : { scale: requireInteger(config.scale, `${path}.scale`) }),
        ...(config.offset === undefined ? {} : { offset: requireInteger(config.offset, `${path}.offset`) }),
      }
      break
    }
  }

  for (let count = 1; count <= maximumMatchCount; count++) {
    let coefficient: number
    switch (result.type) {
      case 'constant':
        coefficient = result.value
        break
      case 'match-count':
        coefficient = count
        break
      case 'match-count-table':
        coefficient = result.values[count]!
        break
      case 'polynomial':
        coefficient = result.coefficients.reduceRight(
          (sum, current) => sum * count + current,
          0,
        )
        break
      case 'exponential':
        coefficient = (result.scale ?? 1) * result.base ** count + (result.offset ?? 0)
        break
      case 'power':
        coefficient = (result.scale ?? 1) * count ** result.exponent + (result.offset ?? 0)
        break
    }
    if (!Number.isSafeInteger(coefficient) || coefficient < 0) {
      fail(path, `produces invalid coefficient ${coefficient} for match count ${count}`)
    }
  }

  return result
}

function patternSymbols(pattern: string[]): Set<string> {
  const symbols = new Set<string>()
  for (const row of pattern) {
    for (const token of Array.from(row)) {
      if (token !== ' ' && !/^[0-9]$/.test(token)) symbols.add(token)
    }
  }
  return symbols
}

export function validatePatternParams(value: unknown, path = 'params'): PatternParams {
  const params = requireRecord(value, path)
  rejectUnknownFields(params, PATTERN_FIELDS, path)

  if (!Array.isArray(params.pattern) || params.pattern.length === 0) {
    fail(`${path}.pattern`, 'must be a non-empty string array')
  }
  const pattern = params.pattern.map((row, index) => {
    if (typeof row !== 'string' || Array.from(row).length === 0) {
      fail(`${path}.pattern[${index}]`, 'must be a non-empty string')
    }
    return row
  })
  const width = Array.from(pattern[0]!).length
  if (pattern.some((row) => Array.from(row).length !== width)) {
    fail(`${path}.pattern`, 'must be rectangular')
  }
  if (pattern.length > GRID_ROWS || width > GRID_COLS) {
    fail(`${path}.pattern`, `must not exceed ${GRID_ROWS}×${GRID_COLS}`)
  }

  const symbols = patternSymbols(pattern)
  let symbolValues: Record<string, number[]> | undefined
  if (params.symbolValues !== undefined) {
    const source = requireRecord(params.symbolValues, `${path}.symbolValues`)
    symbolValues = {}
    for (const [symbol, allowedValues] of Object.entries(source)) {
      if (Array.from(symbol).length !== 1 || !symbols.has(symbol)) {
        fail(`${path}.symbolValues.${symbol}`, 'must refer to a symbol used by the pattern')
      }
      symbolValues[symbol] = validateDigitArray(
        allowedValues,
        `${path}.symbolValues.${symbol}`,
        true,
      )
    }
  }

  let allowSameWith: Record<string, string[]> | undefined
  if (params.allowSameWith !== undefined) {
    const source = requireRecord(params.allowSameWith, `${path}.allowSameWith`)
    allowSameWith = {}
    const seenPairs = new Set<string>()
    for (const [symbol, rawOthers] of Object.entries(source)) {
      if (!symbols.has(symbol)) {
        fail(`${path}.allowSameWith.${symbol}`, 'must refer to a symbol used by the pattern')
      }
      if (!Array.isArray(rawOthers)) fail(`${path}.allowSameWith.${symbol}`, 'must be an array')
      allowSameWith[symbol] = rawOthers.map((other, index) => {
        if (typeof other !== 'string' || !symbols.has(other)) {
          fail(`${path}.allowSameWith.${symbol}[${index}]`, 'must refer to a symbol used by the pattern')
        }
        if (other === symbol) fail(`${path}.allowSameWith.${symbol}[${index}]`, 'must not refer to itself')
        const pair = [symbol, other].sort().join('\0')
        if (seenPairs.has(pair)) {
          fail(`${path}.allowSameWith.${symbol}[${index}]`, 'duplicates an existing equality permission')
        }
        seenPairs.add(pair)
        return other
      })
    }
  }

  const multiple = params.multiple === undefined ? undefined : requireBoolean(params.multiple, `${path}.multiple`)
  const allowOverlap = params.allowOverlap === undefined
    ? undefined
    : requireBoolean(params.allowOverlap, `${path}.allowOverlap`)
  if (allowOverlap !== undefined && multiple !== true) {
    fail(`${path}.allowOverlap`, 'is only valid when multiple is true')
  }

  const maximumMatchCount = multiple ? (GRID_ROWS - pattern.length + 1) * (GRID_COLS - width + 1) : 1
  const coefficient = params.coefficient === undefined
    ? undefined
    : validateCoefficientConfig(params.coefficient, maximumMatchCount, `${path}.coefficient`)

  return {
    pattern,
    ...(symbolValues === undefined ? {} : { symbolValues }),
    ...(allowSameWith === undefined ? {} : { allowSameWith }),
    ...(multiple === undefined ? {} : { multiple }),
    ...(allowOverlap === undefined ? {} : { allowOverlap }),
    ...(coefficient === undefined ? {} : { coefficient }),
  }
}

export function validateDigitConstraintsParams(
  value: unknown,
  path = 'params',
): DigitConstraintsParams {
  const params = requireRecord(value, path)
  rejectUnknownFields(params, DIGIT_CONSTRAINT_FIELDS, path)

  const requiredDigits = params.requiredDigits === undefined
    ? undefined
    : validateDigitArray(params.requiredDigits, `${path}.requiredDigits`, false)
  const forbiddenDigits = params.forbiddenDigits === undefined
    ? undefined
    : validateDigitArray(params.forbiddenDigits, `${path}.forbiddenDigits`, false)

  if (requiredDigits === undefined && forbiddenDigits === undefined) {
    fail(path, 'must provide requiredDigits or forbiddenDigits')
  }

  const forbidden = new Set(forbiddenDigits ?? [])
  for (const digit of requiredDigits ?? []) {
    if (forbidden.has(digit)) fail(path, `digit ${digit} cannot be both required and forbidden`)
  }

  return {
    ...(requiredDigits === undefined ? {} : { requiredDigits }),
    ...(forbiddenDigits === undefined ? {} : { forbiddenDigits }),
  }
}

export function validateRules(input: unknown): RuleDefinition[] {
  if (!Array.isArray(input)) fail('rules', 'must be an array')

  const ids = new Set<string>()
  const labels = new Set<string>()

  return input.map((rawRule, index) => {
    const path = `rules[${index}]`
    const rule = requireRecord(rawRule, path)
    rejectUnknownFields(rule, RULE_FIELDS, path)

    const id = requireNonEmptyString(rule.id, `${path}.id`)
    const label = requireNonEmptyString(rule.label, `${path}.label`)
    if (ids.has(id)) fail(`${path}.id`, `duplicate id "${id}"`)
    if (labels.has(label)) fail(`${path}.label`, `duplicate label "${label}"`)
    ids.add(id)
    labels.add(label)

    const baseScore = requireInteger(rule.baseScore, `${path}.baseScore`)
    if (baseScore < 0) fail(`${path}.baseScore`, 'must be non-negative')

    const matcherKey = requireNonEmptyString(rule.matcherKey, `${path}.matcherKey`)
    let params: unknown
    if (matcherKey === 'pattern-matcher') {
      params = validatePatternParams(rule.params, `${path}.params`)
    } else if (matcherKey === 'digit-constraints') {
      params = validateDigitConstraintsParams(rule.params, `${path}.params`)
    } else if (matcherKey in matchers) {
      if (rule.params === undefined) {
        params = {}
      } else {
        params = requireRecord(rule.params, `${path}.params`)
      }
    } else {
      fail(`${path}.matcherKey`, `unknown matcher key "${matcherKey}"`)
    }

    return {
      id,
      label,
      name: validateLocalizedText(rule.name, `${path}.name`),
      description: validateLocalizedText(rule.description, `${path}.description`),
      baseScore,
      matcherKey,
      params,
    }
  })
}
