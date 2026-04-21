<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="admin-wrap">
    <header class="admin-head tw-card">
      <div>
        <div class="title">管理后台</div>
        <div class="sub">用户管理 / 审核 / 举报 / 数据看板</div>
      </div>
      <div class="act">
        <button class="tw-btn tw-btn-ghost" type="button" @click="router.push({ name: 'home' })">返回前台</button>
        <button class="tw-btn tw-btn-primary" type="button" @click="logout">退出登录</button>
      </div>
    </header>
    <main class="admin-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin-wrap { padding: 14px; max-width: 1200px; margin: 0 auto; }
.admin-head { padding: 12px; border: 1px solid rgba(255,255,255,.55); display:flex; justify-content:space-between; gap:12px; align-items:center; }
.title { font-size: 20px; font-weight: 900; }
.sub { color: var(--tw-muted); font-size: 12px; margin-top: 2px; }
.act { display:flex; gap:8px; }
.admin-main { margin-top: 12px; }
</style>
