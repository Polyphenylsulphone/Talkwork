<script setup>
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '正在准备面试' },
  subtitle: { type: String, default: '' },
});
</script>

<template>
  <Teleport to="body">
    <Transition name="iv-overlay">
      <div v-if="show" class="iv-mask" role="status" aria-live="polite" aria-busy="true">
        <div class="iv-card">
          <div class="iv-sparks" aria-hidden="true">
            <span class="iv-spark">✨</span>
            <span class="iv-spark">💫</span>
            <span class="iv-spark">⭐</span>
          </div>
          <div class="iv-mascot-wrap">
            <div class="iv-glow" />
            <span class="iv-face">🎧</span>
          </div>
          <h3 class="iv-title">{{ title }}</h3>
          <p v-if="subtitle" class="iv-sub">{{ subtitle }}</p>
          <div class="iv-dots" aria-hidden="true">
            <span class="iv-dot" />
            <span class="iv-dot" />
            <span class="iv-dot" />
          </div>
          <p class="iv-foot">深呼吸一下，你超棒的</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.iv-mask {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(236, 72, 153, 0.12) 50%, rgba(59, 130, 246, 0.18) 100%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.iv-card {
  position: relative;
  width: 100%;
  max-width: 300px;
  padding: 28px 26px 24px;
  text-align: center;
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow:
    0 4px 6px -1px rgba(26, 86, 219, 0.06),
    0 22px 48px -12px rgba(26, 86, 219, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  overflow: hidden;
}

.iv-card::before {
  content: '';
  position: absolute;
  top: -40%;
  left: -30%;
  width: 80%;
  height: 60%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.iv-sparks {
  position: absolute;
  top: 10px;
  right: 12px;
  display: flex;
  gap: 2px;
  pointer-events: none;
}

.iv-spark {
  font-size: 13px;
  opacity: 0.75;
  animation: iv-twinkle 1.4s ease-in-out infinite;
}

.iv-spark:nth-child(2) {
  animation-delay: 0.25s;
  font-size: 11px;
}

.iv-spark:nth-child(3) {
  animation-delay: 0.5s;
  font-size: 12px;
}

@keyframes iv-twinkle {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.92) rotate(-6deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.08) rotate(6deg);
  }
}

.iv-mascot-wrap {
  position: relative;
  width: 88px;
  height: 88px;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.iv-glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, rgba(99, 102, 241, 0.12) 45%, transparent 70%);
  animation: iv-pulse 2s ease-in-out infinite;
}

@keyframes iv-pulse {
  0%,
  100% {
    transform: scale(0.92);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}

.iv-face {
  position: relative;
  font-size: 44px;
  line-height: 1;
  display: block;
  animation: iv-bounce 1.1s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px rgba(26, 86, 219, 0.15));
}

@keyframes iv-bounce {
  0%,
  100% {
    transform: translateY(0) rotate(-4deg);
  }
  50% {
    transform: translateY(-8px) rotate(4deg);
  }
}

.iv-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: 0.02em;
}

.iv-sub {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #64748b;
  font-weight: 600;
}

.iv-dots {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 12px;
}

.iv-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: linear-gradient(145deg, #6366f1, #3b82f6);
  animation: iv-dot 0.9s ease-in-out infinite;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.35);
}

.iv-dot:nth-child(2) {
  animation-delay: 0.15s;
  background: linear-gradient(145deg, #8b5cf6, #6366f1);
}

.iv-dot:nth-child(3) {
  animation-delay: 0.3s;
  background: linear-gradient(145deg, #ec4899, #8b5cf6);
}

@keyframes iv-dot {
  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.55;
  }
  50% {
    transform: translateY(-10px) scale(1.15);
    opacity: 1;
  }
}

.iv-foot {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
}

.iv-overlay-enter-active,
.iv-overlay-leave-active {
  transition: opacity 0.28s ease;
}

.iv-overlay-enter-active .iv-card,
.iv-overlay-leave-active .iv-card {
  transition: transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.28s ease;
}

.iv-overlay-enter-from,
.iv-overlay-leave-to {
  opacity: 0;
}

.iv-overlay-enter-from .iv-card,
.iv-overlay-leave-to .iv-card {
  transform: scale(0.92) translateY(12px);
  opacity: 0;
}
</style>
