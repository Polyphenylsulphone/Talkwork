<script setup>
import { RouterView } from 'vue-router';
import ToastHost from './components/ToastHost.vue';
</script>

<template>
  <div class="app-root">
    <RouterView />
    <ToastHost />
  </div>
</template>
