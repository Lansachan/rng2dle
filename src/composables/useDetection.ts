import { evaluateLine, type Badge } from '../game/badges'
import { GRID_COLS } from '../game/constants'

const START_DELAY_MS = 1000
const STEP_INTERVAL_MS = 1000
const INDICATOR_TRAVEL_MS = 450
const ARRIVAL_PAD_MS = 40
const INDICATOR_SIZE = 32

type OffsetDir = 'left' | 'top' | 'diag'

interface Step {
  move: () => void
  cells: number[]
}

export interface DetectionHooks {
  getCell: (index: number) => HTMLElement | null | undefined
  getIndicator: () => HTMLElement | null | undefined
  setVisible: (visible: boolean) => void
  highlight: (indices: number[]) => void
  onAward: (badges: Badge[]) => void
}

export function useDetection(hooks: DetectionHooks) {
  let startTimer: number | null = null
  let stepTimer: number | null = null

  function cellAt(row: number, col: number) {
    return hooks.getCell(row * GRID_COLS + col)
  }

  function moveIndicator(row: number, col: number, dir: OffsetDir, rotation: number) {
    const cell = cellAt(row, col)
    const indicator = hooks.getIndicator()
    if (!cell || !indicator) return

    let x = 0
    let y = 0
    if (dir === 'left') {
      x = cell.offsetLeft - INDICATOR_SIZE - 12
      y = cell.offsetTop + cell.offsetHeight / 2 - INDICATOR_SIZE / 2
    } else if (dir === 'top') {
      x = cell.offsetLeft + cell.offsetWidth / 2 - INDICATOR_SIZE / 2
      y = cell.offsetTop - INDICATOR_SIZE - 12
    } else {
      x = cell.offsetLeft - INDICATOR_SIZE - 6
      y = cell.offsetTop - INDICATOR_SIZE - 6
    }

    indicator.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`
  }

  function buildSteps(): Step[] {
    const cols = Array.from({ length: GRID_COLS }, (_, i) => i)
    const steps: Step[] = []

    for (let row = GRID_COLS - 1; row >= 0; row--) {
      steps.push({
        move: () => moveIndicator(row, 0, 'left', 0),
        cells: cols.map((c) => row * GRID_COLS + c),
      })
    }

    steps.push({
      move: () => moveIndicator(0, 0, 'diag', 45),
      cells: cols.map((i) => i * GRID_COLS + i),
    })

    for (let col = 0; col < GRID_COLS; col++) {
      steps.push({
        move: () => moveIndicator(0, col, 'top', 90),
        cells: cols.map((r) => r * GRID_COLS + col),
      })
    }

    return steps
  }

  function run(values: number[]) {
    stop()
    const steps = buildSteps()
    let index = 0
    moveIndicator(GRID_COLS - 1, 0, 'left', 0)

    startTimer = window.setTimeout(() => {
      hooks.setVisible(true)
      stepTimer = window.setInterval(() => {
        if (index >= steps.length) {
          stop()
          return
        }

        const step = steps[index]
        step.move()

        window.setTimeout(() => {
          const digits = step.cells.map((idx) => values[idx])
          const awarded = evaluateLine(digits)
          if (awarded.length > 0) {
            hooks.highlight(step.cells)
            hooks.onAward(awarded)
          }
        }, INDICATOR_TRAVEL_MS + ARRIVAL_PAD_MS)

        index++
      }, STEP_INTERVAL_MS)
    }, START_DELAY_MS)
  }

  function stop() {
    if (startTimer !== null) {
      clearTimeout(startTimer)
      startTimer = null
    }
    if (stepTimer !== null) {
      clearInterval(stepTimer)
      stepTimer = null
    }
  }

  return { run, stop }
}
