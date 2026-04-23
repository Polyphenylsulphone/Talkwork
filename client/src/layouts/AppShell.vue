<script setup>
import { RouterView, useRoute } from 'vue-router';
import TopNav from '../components/TopNav.vue';
import SideNav from '../components/SideNav.vue';
import FloatingActions from '../components/FloatingActions.vue';
import { useUiStore } from '../stores/ui';

const route = useRoute();
const ui = useUiStore();
</script>

<template>
  <div class="shell">
    <SideNav />
    <div class="right-area" :class="{ collapsed: ui.sidebarCollapsed }">
      <TopNav />
      <main class="main" :class="{ 'editor-main': route.name === 'post-create' }">
        <div class="main-inner" :class="{ 'full-inner': route.name === 'post-create' }">
          <RouterView />
        </div>
      </main>
    </div>
    <FloatingActions v-if="route.name !== 'tbot'" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
  overflow: hidden;
}
.right-area {
  flex: 1;
  height: calc(100vh - 32px);
  margin: 16px 16px 16px 6px;
  border: 1px solid #111827;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
  transition: margin-left 0.18s ease;
}
.right-area.collapsed {
  margin-left: 6px;
}
.main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  min-width: 0;
}
.main-inner {
  max-width: 100%;
  margin: 0 auto;
}
.main.editor-main {
  padding: 0;
}
.main-inner.full-inner {
  max-width: none;
  margin: 0;
}
@media (max-width: 900px) {
  .right-area {
    margin: 16px 16px 16px 100px;
  }
  .main {
    padding: 24px 16px;
  }
}
@media (max-width: 768px) {
  .right-area {
    margin: 16px;
    height: calc(100vh - 32px - 60px);
  }
}
</style>
