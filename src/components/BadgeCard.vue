<script setup lang="ts">
import { computed } from 'vue'
import { RARITY_COLOR, type Badge } from '../game/badges'

const props = defineProps<{ badge: Badge }>()

const cardStyle = computed(() => {
  const color = RARITY_COLOR[props.badge.rarity] ?? RARITY_COLOR.common
  return { '--card-color': color, '--card-glow': `${color}80` }
})
</script>

<template>
  <div class="badge-card" :style="cardStyle">
    <span class="badge-emoji">{{ badge.emoji }}</span>
    <span class="badge-info">
      <span class="badge-label">{{ badge.label }}</span>
      <span class="badge-meta">{{ badge.rarity }}</span>
    </span>
    <span class="badge-ep">+{{ badge.score.toLocaleString() }} EP</span>
  </div>
</template>

<style scoped>
.badge-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--panel);
  border: 1px solid var(--card-color, var(--panel-border));
  border-radius: 12px;
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
  animation: badgeCardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes badgeCardIn {
  0% {
    opacity: 0;
    transform: translateY(-10px) scale(0.96);
  }
  55% {
    opacity: 1;
    transform: translateY(1px) scale(1.02);
    box-shadow: 0 0 18px var(--card-glow, transparent);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }
}

.badge-emoji {
  flex-shrink: 0;
  font-size: 24px;
  line-height: 1;
}

.badge-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.badge-label {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-hi);
}

.badge-meta {
  font-weight: 300;
  font-size: 11px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--card-color, var(--text-dim));
}

.badge-ep {
  margin-left: auto;
  flex-shrink: 0;
  font-weight: 700;
  font-size: 13px;
  color: var(--text-hi);
}
</style>
