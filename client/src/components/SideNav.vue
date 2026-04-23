<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  BriefcaseBusiness,
  CircleUserRound,
  House,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next';
import { useUiStore, TBOT_FACE_URLS } from '../stores/ui';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();
const auth = useAuthStore();

const collapsed = computed(() => ui.sidebarCollapsed);
const tips = [
  '慢一点也没关系，你在积累属于自己的节奏。',
  '面试不是审判，是一次互相了解的对谈。',
  '把紧张当作兴奋的信号，它会帮你更专注。',
  '你已经走了很远，别忘了给自己一个拥抱。',
  '温柔地准备，坚定地出发。',
];
const bubble = ref('');
let tipTimer = null;
let bubbleTimer = null;
const tbotFaceUrl = computed(() => {
  const match = ui.tbotMoodOptions.find((item) => item.id === ui.tbotMood) || ui.tbotMoodOptions[2];
  return match?.url || TBOT_FACE_URLS.calm;
});
const tbotFaceLabel = computed(() => {
  const match = ui.tbotMoodOptions.find((item) => item.id === ui.tbotMood) || ui.tbotMoodOptions[2];
  return `问问T宝（${match?.label || '平静'}）`;
});

function pickTip() {
  bubble.value = tips[Math.floor(Math.random() * tips.length)];
  bubbleTimer = window.setTimeout(() => {
    bubble.value = '';
  }, 4500);
}

onMounted(() => {
  tipTimer = window.setInterval(
    () => {
      if (Math.random() < 0.55) pickTip();
    },
    45000
  );
});
onBeforeUnmount(() => {
  if (tipTimer) clearInterval(tipTimer);
  if (bubbleTimer) clearTimeout(bubbleTimer);
});

const items = [
  { to: '/', label: '主页', icon: House },
  { to: '/qa', label: '问答圈', icon: MessageCircle },
  { to: '/assistant', label: '求职助手', icon: BriefcaseBusiness },
  { to: '/tbot', label: '问问T宝', icon: Sparkles },
  { to: '/profile', label: '我的', icon: CircleUserRound },
];
const navItems = computed(() =>
  auth.isAdmin ? [...items, { to: '/admin', label: '管理后台', icon: ShieldCheck }] : items
);

function isActive(path) {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
}

function goTbot() {
  router.push({ name: 'tbot' });
}

function randomizeTbotFace() {
  ui.randomizeTbotMood();
  pickTip();
}
</script>

<template>
  <div class="side-nav-root">
    <div class="side-wrap" :class="{ collapsed }">
      <aside class="side" :class="{ collapsed }">
        <div class="side-inner tw-card">
          <div class="brand-wrap" v-if="!collapsed" @click="router.push({ name: 'home' })">
            <div class="logo">TW</div>
            <div class="brand">
              <div class="name">TalkWork</div>
              <div class="sub">温柔地，走向你想去的方向</div>
            </div>
          </div>
          <div class="brand-wrap collapsed-brand" v-else @click="router.push({ name: 'home' })">
            <div class="logo">TW</div>
          </div>

          <div class="side-head">
            <span v-if="!collapsed" class="side-title">工具栏</span>
            <button class="collapse" :class="{ open: collapsed }" type="button" :title="collapsed ? '展开' : '收起'" @click="ui.toggleSidebar()">
              <span class="px-menu" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>

          <nav class="nav">
            <RouterLink
              v-for="it in navItems"
              :key="it.to"
              :to="it.to"
              class="nav-item"
              :class="{ active: isActive(it.to) }"
              :title="collapsed ? it.label : ''"
              :data-tip="collapsed ? it.label : ''"
            >
              <span class="ico">
                <component :is="it.icon" :size="18" />
              </span>
              <span v-if="!collapsed" class="txt">{{ it.label }}</span>
            </RouterLink>
          </nav>

          <div class="fox" @click="goTbot" @mouseenter="pickTip">
            <div class="fox-face" :title="tbotFaceLabel">
              <img class="fox-face-img" :src="tbotFaceUrl" alt="T宝表情" @click.stop="randomizeTbotFace" />
            </div>
            <div v-if="bubble && !collapsed" class="bubble tw-card">{{ bubble }}</div>
          </div>
        </div>
      </aside>
    </div>

    <nav class="mobile-tab tw-card">
      <RouterLink v-for="it in navItems.slice(0, 4)" :key="it.to" :to="it.to" class="m-item" :class="{ active: isActive(it.to) }">
        <span class="m-ico"><component :is="it.icon" :size="18" /></span>
        <span class="m-txt">{{ it.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.side-wrap {
  width: 240px;
  flex-shrink: 0;
  transition: width 0.18s ease;
}
.side-wrap.collapsed {
  width: 84px;
}
.side {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 60;
  width: 240px;
  height: 100vh;
  padding: 0;
  transition: width 0.18s ease;
  box-sizing: border-box;
}
.side.collapsed {
  width: 84px;
}
.side-inner {
  height: calc(100vh - 32px);
  max-height: calc(100vh - 32px);
  padding: 24px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: none;
  border-radius: 24px;
  margin: 16px 0 16px 16px;
  overflow: hidden;
  background: var(--surface-nav);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}
.brand-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0 16px;
  cursor: pointer;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 4px;
}
.collapsed-brand {
  padding: 8px 0 16px;
}
.logo {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 18px;
  color: var(--surface-nav);
  background: #FFFFFF;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.brand .name {
  font-weight: 900;
  font-size: 22px;
  letter-spacing: -0.02em;
  color: #FFFFFF;
}
.brand .sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  line-height: 1.4;
}
.collapsed .side-inner {
  align-items: center;
}
.side-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 12px;
}
.side-title {
  font-size: 14px;
  font-weight: 700;
  color: #9CA3AF;
  letter-spacing: 0.02em;
}
.collapse {
  display: inline-grid;
  place-items: center;
  border: none;
  background: transparent;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  color: #9CA3AF;
  transition: color 0.15s ease, background-color 0.2s ease;
}
.collapse:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.1);
}
.px-menu {
  display: grid;
  gap: 4px;
}
.px-menu i {
  display: block;
  width: 14px;
  height: 2px;
  background: currentColor;
  border-radius: 2px;
  transition: transform 0.18s ease, opacity 0.18s ease, width 0.18s ease;
}
.collapse:hover .px-menu i:nth-child(1) {
  transform: translateX(1px);
}
.collapse:hover .px-menu i:nth-child(2) {
  transform: translateX(-1px);
}
.collapse:hover .px-menu i:nth-child(3) {
  transform: translateX(1px);
}
.collapse.open .px-menu i:nth-child(1) {
  width: 10px;
  transform: translateX(2px) rotate(45deg) translateY(3px);
}
.collapse.open .px-menu i:nth-child(2) {
  opacity: 0;
}
.collapse.open .px-menu i:nth-child(3) {
  width: 10px;
  transform: translateX(2px) rotate(-45deg) translateY(-3px);
}
.collapsed .side-head {
  justify-content: center;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  color: #D1D5DB;
  border: none;
  transition: all 0.2s ease;
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #FFFFFF;
}
.nav-item.active {
  background: rgba(255, 255, 255, 0.1);
  color: #FFFFFF;
  font-weight: 600;
}
.ico {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: inherit;
}
.nav-item:hover .ico,
.nav-item.active .ico {
  color: #FFFFFF;
}
.collapsed .nav-item[data-tip]:hover::after {
  content: attr(data-tip);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  background: var(--surface-tooltip);
  color: var(--surface-tooltip-text);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.15);
  z-index: 20;
  pointer-events: none;
}
.txt {
  font-weight: 800;
}
.fox {
  position: relative;
  width: 100%;
  padding: 8px 2px 4px;
  cursor: pointer;
}
.fox-face {
  width: 100%;
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.12));
  animation: floaty 4.2s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fox-face-img {
  width: 100%;
  max-width: 210px;
  aspect-ratio: 1 / 1;
  object-fit: contain;
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: var(--bg-soft);
}
.collapsed .fox {
  width: auto;
  padding: 8px 0 4px;
}
.collapsed .fox-face {
  width: auto;
}
.collapsed .fox-face-img {
  width: 56px;
  height: 56px;
}
@keyframes floaty {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}
.bubble {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: calc(100% + 8px);
  padding: 10px 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--tw-text);
  border: 1px solid var(--border-primary);
}
.collapsed .bubble {
  left: -160px;
  width: 200px;
  right: auto;
}
@media (max-width: 900px) {
  .side-wrap {
    display: none;
  }
}
.mobile-tab {
  display: none;
}
@media (max-width: 768px) {
  .mobile-tab {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 70;
    border: 1px solid rgba(255, 255, 255, 0.55);
    overflow: hidden;
  }
  .m-item {
    display: grid;
    place-items: center;
    gap: 2px;
    padding: 8px 4px;
    color: var(--tw-muted);
  }
  .m-item.active {
    color: var(--tw-primary);
    background: color-mix(in srgb, var(--tw-primary) 10%, transparent);
  }
  .m-ico {
    display: grid;
    place-items: center;
    line-height: 1;
  }
  .m-txt {
    font-size: 11px;
    font-weight: 800;
  }
}
</style>
