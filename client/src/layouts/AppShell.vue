<script setup>
import { RouterView, useRoute } from 'vue-router';
import TopNav from '../components/TopNav.vue';
import SideNav from '../components/SideNav.vue';
import FloatingActions from '../components/FloatingActions.vue';

const route = useRoute();
</script>

<template>
  <div class="shell">
    <TopNav />
    <div class="body">
      <SideNav />
      <main class="main" :class="{ 'editor-main': route.name === 'post-create' }">
        <div class="main-inner" :class="{ 'full-inner': route.name === 'post-create' }">
          <RouterView />
        </div>
      </main>
    </div>
    <FloatingActions />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.main {
  flex: 1;
  min-width: 0;
  padding: 74px 20px 28px;
}
.main-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.main.editor-main {
  padding: 52px 0 0;
}
.main-inner.full-inner {
  max-width: none;
  margin: 0;
}
@media (max-width: 900px) {
  .main {
    padding: 16px 12px;
  }
}
@media (max-width: 768px) {
  .main {
    padding: 60px 10px 86px;
  }
  .main.editor-main {
    padding: 52px 0 86px;
  }
}
</style>
