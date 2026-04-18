<script setup>
import { AlertCircle, AlertTriangle, Check, Info } from 'lucide-vue-next';
import { useToastState } from '../stores/toast';

const state = useToastState();
</script>

<template>
  <div class="toasts">
    <transition-group name="tw">
      <div v-for="t in state.items" :key="t.id" class="toast" :class="t.type">
        <span class="ico">
          <Check v-if="t.type === 'success'" :size="14" />
          <AlertCircle v-else-if="t.type === 'error'" :size="14" />
          <AlertTriangle v-else-if="t.type === 'warn'" :size="14" />
          <Info v-else :size="14" />
        </span>
        <span class="txt">{{ t.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  min-width: 220px;
  max-width: 360px;
  padding: 12px 14px;
  border-radius: 10px;
  color: #fff;
  font-weight: 700;
  box-shadow: var(--tw-shadow);
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 8px;
  align-items: start;
}
.toast.success {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}
.toast.error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}
.toast.info {
  background: linear-gradient(135deg, #3b82f6, #1a56db);
}
.toast.warn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}
.ico {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 12px;
  line-height: 1;
}
.txt {
  line-height: 1.4;
  word-break: break-word;
}
.tw-enter-active,
.tw-leave-active {
  transition: all 0.22s ease;
}
.tw-enter-from,
.tw-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
