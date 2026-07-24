export type Grid = number[][]

export type CellIndex = number
export type ActivationGroup = CellIndex[]

export interface MatchEvidence {
  groups: ActivationGroup[]
}

export interface RuleMatchResult {
  coefficient: number
  matches: MatchEvidence[]
}

export interface LocalizedText {
  zh: string
  en: string
}

export interface RuleDefinition {
  id: string
  label: string
  name: LocalizedText
  description: LocalizedText
  baseScore: number
  matcherKey: string
  params?: unknown
}

export type RuleMatcher = (grid: Grid, params?: unknown) => RuleMatchResult

export type CoefficientConfig =
  | { type: 'constant'; value: number }
  | { type: 'match-count' }
  | { type: 'match-count-table'; values: number[] }
  | { type: 'polynomial'; coefficients: number[] }
  | { type: 'exponential'; base: number; scale?: number; offset?: number }
  | { type: 'power'; exponent: number; scale?: number; offset?: number }

export interface PatternParams {
  pattern: string[]
  symbolValues?: Record<string, number[]>
  allowSameWith?: Record<string, string[]>
  groupOrder?: string[]
  multiple?: boolean
  allowOverlap?: boolean
  coefficient?: CoefficientConfig
}

export interface DigitConstraintsParams {
  requiredDigits?: number[]
  forbiddenDigits?: number[]
}
