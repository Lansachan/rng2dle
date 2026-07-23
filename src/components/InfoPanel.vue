<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BadgeCard from './BadgeCard.vue'
import { useGame } from '../composables/useGame'
import { EXPAND_MS } from '../game/constants'

const { state, totalEP, badgeCount, startRun, randomize, reset } = useGame()

const title = computed(() => (state.mode === 'hourly' ? 'HOURLY' : 'SANDBOX'))
const taglineLines = computed(() =>
  state.mode === 'hourly'
    ? ['One roll per hour. One grid.', 'What will yours be?']
    : ['Craft your layout.', 'Test your highest potential score!'],
)
const reversedAwards = computed(() => [...state.awards].reverse())

const fading = ref(false)
const showResult = ref(false)
const displayedEP = ref(0)

let swapTimer: number | null = null
let raf = 0

function animateEP(target: number) {
  cancelAnimationFrame(raf)
  const start = displayedEP.value
  const startTime = performance.now()
  const duration = 1200

  const step = (now: number) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 4)
    displayedEP.value = Math.round(start + (target - start) * eased)
    if (progress < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

watch(
  () => state.phase,
  (phase) => {
    if (swapTimer !== null) clearTimeout(swapTimer)
    if (phase === 'running') {
      displayedEP.value = 0
      fading.value = true
      swapTimer = window.setTimeout(() => (showResult.value = true), EXPAND_MS)
    } else {
      fading.value = false
      showResult.value = false
    }
  },
)

watch(totalEP, (target) => animateEP(target))

onUnmounted(() => {
  if (swapTimer !== null) clearTimeout(swapTimer)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="info">
    <div class="default-state" :class="{ 'fade-out-right': fading, hidden: showResult }">
      <h1>{{ title }}</h1>
      <p class="tagline">
        <template v-for="(line, idx) in taglineLines" :key="idx">
          {{ line }}<br v-if="idx < taglineLines.length - 1" />
        </template>
      </p>

      <div v-if="state.mode === 'hourly'" class="btn-group">
        <button class="action-btn" @click="startRun()">GENERATE</button>
      </div>
      <div v-else class="btn-group">
        <button class="action-btn secondary" @click="randomize()">RANDOM</button>
        <button class="action-btn" @click="startRun()">CALCULATE</button>
      </div>
    </div>

    <div class="result" :class="{ visible: showResult }">
      <p class="ep-score">{{ displayedEP.toLocaleString() }}<span class="unit">EP</span></p>
      <p class="badge-count">{{ badgeCount }} Badge{{ badgeCount === 1 ? '' : 's' }} Earned</p>
      <div class="badge-cards">
        <BadgeCard v-for="award in reversedAwards" :key="award.key" :badge="award.badge" />
      </div>
      <div class="btn-group" style="margin-top: 16px">
        <button class="action-btn secondary" @click="reset()">EDIT GRID</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 420px;
  flex-shrink: 0;
}

.default-state {
  display: flex;
  flex-direction: column;
  gap: 14px;
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.default-state.fade-out-right {
  opacity: 0;
  transform: translateX(40px);
  pointer-events: none;
}

.default-state.hidden {
  display: none;
}

h1 {
  margin: 0;
  font-weight: 700;
  font-size: clamp(38px, 6vw, 64px);
  line-height: 1;
  letter-spacing: 0.01em;
}

.tagline {
  margin: 0;
  font-weight: 200;
  font-size: 17px;
  line-height: 1.5;
  color: var(--text-dim);
}

.btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.action-btn {
  padding: 14px 28px;
  background: var(--btn-bg);
  border: none;
  border-radius: 14px;
  color: var(--text-hi);
  font-family: 'Azeret Mono', monospace;
  font-weight: 200;
  font-size: 18px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.05s ease;
}

.action-btn:hover {
  background: var(--btn-bg-hover);
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn.secondary {
  background: transparent;
  border: 1px solid var(--panel-border);
  color: var(--text-dim);
}

.action-btn.secondary:hover {
  background: #222;
  color: var(--text-hi);
}

.result {
  display: none;
  flex-direction: column;
  gap: 6px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.result.visible {
  display: flex;
  opacity: 1;
  transform: translateY(0);
}

.ep-score {
  margin: 0;
  font-weight: 700;
  font-size: clamp(42px, 7vw, 80px);
  line-height: 1;
  color: var(--text-hi);
}

.ep-score .unit {
  margin-left: 6px;
  font-size: 0.4em;
  font-weight: 700;
}

.badge-count {
  margin: 0 0 8px;
  font-weight: 400;
  font-size: 18px;
  color: var(--text-dim);
}

.badge-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.badge-cards:empty {
  display: none;
}
</style>
