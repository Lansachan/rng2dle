import { isPrime, maxRun } from './scoring'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'mythic' | 'anomaly'

export interface Badge {
  id: string
  label: string
  emoji: string
  family: string | null
  score: number
  rarity: Rarity
  test: (digits: number[], str: string, num: number) => boolean
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8a8a8a',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  epic: '#a855f7',
  mythic: '#f59e0b',
  anomaly: '#ef4444',
}

const sum = (digits: number[]) => digits.reduce((a, b) => a + b, 0)

export const BADGES: Badge[] = [
  { id: 'PRIME', label: 'Prime Number', emoji: '💎', family: null, score: 1274, rarity: 'uncommon', test: (_d, _s, n) => isPrime(n) },
  { id: 'PALINDROME', label: 'Palindrome', emoji: '🪞', family: null, score: 50025, rarity: 'rare', test: (_d, s) => s === s.split('').reverse().join('') },
  { id: 'HEAVY', label: 'Heavy', emoji: '🧱', family: null, score: 33300, rarity: 'rare', test: (d) => sum(d) > 45 },
  { id: 'FEATHER', label: 'Feather', emoji: '🪶', family: null, score: 2667, rarity: 'uncommon', test: (d) => sum(d) < 15 },
  { id: 'VOID', label: 'Void', emoji: '🕳️', family: null, score: 167, rarity: 'common', test: (d) => !d.includes(0) },
  { id: 'NICE', label: 'Nice', emoji: '😏', family: 'NICE', score: 2024, rarity: 'uncommon', test: (_d, s) => s.includes('69') },
  { id: 'NICE_EXACT', label: 'Exact Nice', emoji: '😏', family: 'NICE', score: 100000100, rarity: 'mythic', test: (_d, _s, n) => n === 69 },
  { id: 'EVEN', label: 'Even', emoji: '⚖️', family: null, score: 200, rarity: 'common', test: (_d, _s, n) => n % 2 === 0 },
  { id: 'ODD', label: 'Odd', emoji: '🦄', family: null, score: 200, rarity: 'common', test: (_d, _s, n) => n % 2 !== 0 },
  { id: 'CLEAN', label: 'Clean', emoji: '🧼', family: null, score: 1000, rarity: 'uncommon', test: (d) => d[5] === 0 },
  { id: 'SEMI_CLEAN', label: 'Semi-Clean', emoji: '🧹', family: null, score: 1000, rarity: 'uncommon', test: (d) => d[5] === 5 },
  { id: 'CENTURY', label: 'Century', emoji: '💯', family: null, score: 10000, rarity: 'rare', test: (d) => d[4] === 0 && d[5] === 0 },
  { id: 'MILLENNIUM', label: 'Millennium', emoji: '🗓️', family: null, score: 100000, rarity: 'epic', test: (d) => d[3] === 0 && d[4] === 0 && d[5] === 0 },
  { id: 'DOZEN', label: 'Dozen', emoji: '🍩', family: null, score: 1200, rarity: 'uncommon', test: (_d, _s, n) => n % 12 === 0 },
  { id: 'LUCKY_SEVEN_DIV', label: 'Lucky Seven', emoji: '🎰', family: null, score: 700, rarity: 'common', test: (_d, _s, n) => n % 7 === 0 },
  { id: 'ELEVEN', label: 'Eleven', emoji: '🕚', family: null, score: 1100, rarity: 'uncommon', test: (_d, _s, n) => n % 11 === 0 },
  { id: 'GROUNDED', label: 'Grounded', emoji: '⚓', family: null, score: 250, rarity: 'common', test: (d) => d[0] < d[5] },
  { id: 'LIFTOFF', label: 'Liftoff', emoji: '🚀', family: null, score: 200, rarity: 'common', test: (d) => d[0] > d[5] },
  { id: 'SANDWICH', label: 'Sandwich', emoji: '🥪', family: 'EQUILIBRIUM', score: 1000, rarity: 'uncommon', test: (d) => d[0] === d[5] && d.slice(1, 5).some((x) => x !== d[0]) },
  { id: 'EQUILIBRIUM', label: 'Equilibrium', emoji: '🧘', family: 'EQUILIBRIUM', score: 1000, rarity: 'uncommon', test: (d) => d[0] === d[5] },
  { id: 'TURTLE', label: 'Turtle', emoji: '🐢', family: 'PROGRESSION', score: 36049, rarity: 'rare', test: (d) => d.every((v, i) => i === 0 || Math.abs(v - d[i - 1]) <= 1) },
  { id: 'CASCADE', label: 'Cascade', emoji: '🌊', family: 'PROGRESSION', score: 3333337, rarity: 'anomaly', test: (d) => d.every((v, i) => i === 0 || v === d[i - 1] + 1) },
  { id: 'WATERFALL', label: 'Waterfall', emoji: '🚿', family: 'PROGRESSION', score: 2857146, rarity: 'anomaly', test: (d) => d.every((v, i) => i === 0 || v === d[i - 1] - 1) },
  { id: 'ECHO', label: 'Echo', emoji: '📣', family: null, score: 100100, rarity: 'epic', test: (_d, s) => s.slice(0, 3) === s.slice(3, 6) },
  { id: 'CONTIGUOUS_SIXES', label: 'Contiguous Sixes', emoji: '➖➖➖➖', family: 'CONTIGUOUS_RUN', score: 10000010, rarity: 'mythic', test: (d) => d.every((v) => v === d[0]) },
  { id: 'CONTIGUOUS_FIVES', label: 'Contiguous Fives', emoji: '➖➖➖', family: 'CONTIGUOUS_RUN', score: 552487, rarity: 'epic', test: (d) => maxRun(d) >= 5 },
  { id: 'CONTIGUOUS_QUADS', label: 'Contiguous Quads', emoji: '➖➖', family: 'CONTIGUOUS_RUN', score: 37023, rarity: 'rare', test: (d) => maxRun(d) >= 4 },
  { id: 'CONTIGUOUS_TRIPS', label: 'Contiguous Trips', emoji: '➖', family: 'CONTIGUOUS_RUN', score: 2784, rarity: 'uncommon', test: (d) => maxRun(d) >= 3 },
]

export function evaluateLine(digits: number[]): Badge[] {
  const str = digits.join('')
  const num = parseInt(str, 10)
  const matched = BADGES.filter((b) => b.test(digits, str, num))

  const byFamily: Record<string, Badge> = {}
  const standalone: Badge[] = []
  for (const badge of matched) {
    if (!badge.family) {
      standalone.push(badge)
    } else if (!byFamily[badge.family] || badge.score > byFamily[badge.family].score) {
      byFamily[badge.family] = badge
    }
  }

  return [...standalone, ...Object.values(byFamily)].sort((a, b) => b.score - a.score)
}
