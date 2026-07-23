import { computed, reactive } from 'vue'
import type { Badge } from '../game/badges'
import { GRID_SIZE } from '../game/constants'

export type Mode = 'hourly' | 'sandbox'
export type Phase = 'idle' | 'running'

export interface Award {
  key: number
  badge: Badge
}

function randomDigits(): number[] {
  return Array.from({ length: GRID_SIZE }, () => Math.floor(Math.random() * 10))
}

const state = reactive({
  mode: 'hourly' as Mode,
  phase: 'idle' as Phase,
  values: randomDigits(),
  awards: [] as Award[],
})

let awardSeq = 0

const totalEP = computed(() => state.awards.reduce((acc, a) => acc + a.badge.score, 0))
const badgeCount = computed(() => state.awards.length)

function setMode(mode: Mode) {
  if (state.mode === mode) return
  state.mode = mode
  reset()
}

function randomize() {
  state.values = randomDigits()
}

function startRun() {
  state.awards = []
  awardSeq = 0
  if (state.mode === 'hourly') randomize()
  state.phase = 'running'
}

function addAwards(badges: Badge[]) {
  for (const badge of badges) state.awards.push({ key: awardSeq++, badge })
}

function reset() {
  state.phase = 'idle'
  state.awards = []
  randomize()
}

export function useGame() {
  return { state, totalEP, badgeCount, setMode, randomize, startRun, addAwards, reset }
}
