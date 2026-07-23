<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useGame } from '../composables/useGame'
import { useDetection } from '../composables/useDetection'
import { EXPAND_MS, GRID_SIZE } from '../game/constants'

const { state, randomize, addAwards } = useGame()

const indicatorEl = ref<HTMLElement>()
const cellEls: HTMLElement[] = []
const triggered = reactive<boolean[]>(new Array(GRID_SIZE).fill(false))
const indicatorVisible = ref(false)

const editable = computed(() => state.mode === 'sandbox' && state.phase === 'idle')

function setCell(el: Element | null, index: number) {
  if (el) cellEls[index] = el as HTMLElement
}

function highlight(indices: number[]) {
  for (const idx of indices) {
    triggered[idx] = true
    window.setTimeout(() => {
      triggered[idx] = false
    }, 60)
  }
}

const detection = useDetection({
  getCell: (i) => cellEls[i],
  getIndicator: () => indicatorEl.value,
  setVisible: (v) => {
    indicatorVisible.value = v
  },
  highlight,
  onAward: addAwards,
})

let ambientTimer: number | null = null
let runTimer: number | null = null

function startAmbient() {
  stopAmbient()
  ambientTimer = window.setInterval(() => {
    if (state.phase === 'idle' && state.mode === 'hourly') randomize()
  }, 1000)
}

function stopAmbient() {
  if (ambientTimer !== null) {
    clearInterval(ambientTimer)
    ambientTimer = null
  }
}

function beginRun() {
  stopAmbient()
  const snapshot = state.values.slice()
  if (runTimer !== null) clearTimeout(runTimer)
  runTimer = window.setTimeout(() => detection.run(snapshot), EXPAND_MS)
}

function endRun() {
  if (runTimer !== null) {
    clearTimeout(runTimer)
    runTimer = null
  }
  detection.stop()
  indicatorVisible.value = false
  triggered.fill(false)
  startAmbient()
}

function onInput(event: Event, index: number) {
  const input = event.target as HTMLInputElement
  if (!/^[0-9]$/.test(input.value)) {
    input.value = '0'
    state.values[index] = 0
    return
  }
  state.values[index] = Number(input.value)
  if (index < GRID_SIZE - 1) {
    const next = cellEls[index + 1]?.querySelector('input')
    next?.focus()
  }
}

watch(
  () => state.phase,
  (phase) => (phase === 'running' ? beginRun() : endRun()),
)

onMounted(startAmbient)
onUnmounted(() => {
  stopAmbient()
  detection.stop()
  if (runTimer !== null) clearTimeout(runTimer)
})
</script>

<template>
  <div class="grid-panel" :class="{ expanded: state.phase === 'running' }">
    <div ref="indicatorEl" class="row-indicator" :class="{ visible: indicatorVisible }">
      <svg viewBox="0 0 100 100">
        <path
          d="M 25,15 L 78,43 C 85,47 85,53 78,57 L 25,85 C 18,89 12,85 12,77 L 12,23 C 12,15 18,11 25,15 Z"
          fill="#1e3a8a"
          stroke="#8b9bb4"
          stroke-width="8"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <div class="grid">
      <div
        v-for="(value, i) in state.values"
        :key="i"
        :ref="(el) => setCell(el as Element | null, i)"
        class="cell"
        :class="{ 'badge-trigger': triggered[i] }"
      >
        <input
          v-if="editable"
          type="text"
          maxlength="1"
          :value="value"
          @input="onInput($event, i)"
        />
        <template v-else>{{ value }}</template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-panel {
  --panel-padding: 18px;
  --grid-gap: 6px;
  --grid-size: 300px;
  --cell-font: clamp(24px, 6.5vw, 42px);
  --panel-radius: 20px;

  position: relative;
  width: calc(var(--grid-size) + var(--panel-padding) * 2);
  flex-shrink: 0;
  padding: var(--panel-padding);
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--panel-radius);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  transition: all 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.grid-panel.expanded {
  --panel-padding: 25px;
  --grid-gap: 8px;
  --grid-size: 420px;
  --cell-font: clamp(34px, 9.1vw, 58px);
  --panel-radius: 28px;
}

.row-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 32px;
  height: 32px;
  opacity: 0;
  transform: translate(0, 0) rotate(0deg);
  transition: opacity 0.4s ease, transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 10;
}

.row-indicator.visible {
  opacity: 1;
}

.row-indicator svg {
  display: block;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4));
}

.grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: var(--grid-gap);
  width: var(--grid-size);
  aspect-ratio: 1 / 1;
  transition: gap 0.55s cubic-bezier(0.22, 1, 0.36, 1), width 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 10px;
  color: var(--text-hi);
  font-family: 'AzeretGrid', 'Azeret Mono', monospace;
  font-weight: 800;
  font-size: var(--cell-font);
  line-height: 1;
  user-select: none;
  transition: font-size 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.cell input {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--cell-border);
  border-radius: inherit;
  color: var(--text-hi);
  font-family: inherit;
  font-weight: inherit;
  font-size: inherit;
  text-align: center;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.cell input:focus {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
}

.cell::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(30, 58, 138, 0.85);
  border: 2px solid rgba(59, 130, 246, 0.8);
  border-radius: inherit;
  opacity: 0;
  transform: scale(0.9);
  pointer-events: none;
  z-index: 2;
  transition: opacity 1.5s cubic-bezier(0.1, 0.9, 0.2, 1), transform 1.5s cubic-bezier(0.1, 0.9, 0.2, 1);
}

.cell.badge-trigger::before {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.05s ease-out, transform 0.05s ease-out;
}
</style>
