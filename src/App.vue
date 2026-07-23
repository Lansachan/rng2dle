<script setup lang="ts">
import GridPanel from './components/GridPanel.vue'
import InfoPanel from './components/InfoPanel.vue'
import { useGame } from './composables/useGame'

const { state, setMode } = useGame()
</script>

<template>
  <header>
    <div class="logo">RNG²DLE</div>
    <div class="mode-switch">
      <button class="mode-btn" :class="{ active: state.mode === 'hourly' }" @click="setMode('hourly')">
        Hourly
      </button>
      <button class="mode-btn" :class="{ active: state.mode === 'sandbox' }" @click="setMode('sandbox')">
        Sandbox
      </button>
    </div>
  </header>

  <main>
    <GridPanel />
    <InfoPanel />
  </main>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 32px;
  border-bottom: 1px solid #262626;
}

.logo {
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 0.02em;
  color: var(--text-hi);
}

.mode-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #222;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
}

.mode-btn {
  padding: 6px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-dim);
  font-family: 'Azeret Mono', monospace;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn.active {
  background: var(--btn-bg);
  color: var(--text-hi);
}

main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 72px;
  flex-wrap: nowrap;
  min-height: calc(100vh - 64px);
  padding: 40px 24px;
}
</style>
