<script setup>
import { useRouter, useRoute } from 'vue-router';
import { RefreshCw, ChevronUp } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();

function top() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refresh() {
  router.replace({ path: route.path, query: { ...route.query, _r: String(Date.now()) } });
}
</script>

<template>
  <div class="fab tw-card">
    <button type="button" title="回到顶部" @click="top"><ChevronUp :size="20" /></button>
    <button type="button" title="刷新列表" @click="refresh"><RefreshCw :size="20" /></button>
  </div>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 18px;
  bottom: 22px;
  z-index: 40;
  padding: 8px;
  display: grid;
  gap: 8px;
  border: 1px solid var(--border-primary);
}
.fab button {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 900;
  background: var(--bg-muted);
  color: var(--text-primary);
  display: inline-grid;
  place-items: center;
}
@media (max-width: 768px) {
  .fab {
    display: none;
  }
}
</style>
