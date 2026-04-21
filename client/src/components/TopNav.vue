<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, Moon, Plus, Sun } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const q = ref('');
const histKey = 'tw_search_hist';
const history = ref([]);
const userMenuOpen = ref(false);
const msgOpen = ref(false);
const hasUnread = ref(true);
const unread = ref(3);

const msgCountText = computed(() => (unread.value > 99 ? '99+' : String(unread.value)));
const isDark = computed(() => ui.theme === 'dark');
const wallpaper = computed(() => ui.wallpaper);
const wallpaperOptions = computed(() => ui.wallpaperOptions);

onMounted(() => {
  try {
    history.value = JSON.parse(localStorage.getItem(histKey) || '[]');
  } catch {
    history.value = [];
  }
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function onKey(e) {
  if (e.key === 'Escape') {
    ui.postMenuOpen = false;
    userMenuOpen.value = false;
    msgOpen.value = false;
  }
}

function logout() {
  userMenuOpen.value = false;
  auth.logout();
  router.push({ name: 'login' });
}

function pushHist(term) {
  const t = term.trim();
  if (!t) return;
  const next = [t, ...history.value.filter((x) => x !== t)].slice(0, 10);
  history.value = next;
  localStorage.setItem(histKey, JSON.stringify(next));
}

function search() {
  pushHist(q.value);
  router.push({ name: 'home', query: { q: q.value.trim() || undefined } });
}

function goCreate(kind) {
  ui.postMenuOpen = false;
  if (kind === 'question' || kind === 'article') {
    router.push({ name: 'post-create', query: { type: kind === 'question' ? 'question' : 'article' } });
  }
  if (kind === 'answer') router.push({ name: 'qa' });
}

function toggleMsg() {
  msgOpen.value = !msgOpen.value;
  if (msgOpen.value) {
    hasUnread.value = false;
    unread.value = 0;
  }
}

function toggleTheme() {
  ui.toggleTheme();
}

function onWallpaperChange(e) {
  ui.applyWallpaper(e.target.value);
}
</script>

<template>
  <header class="top">
    <div class="left" @click="router.push({ name: 'home' })">
      <div class="logo">TW</div>
      <div class="brand">
        <div class="name">TalkWork</div>
        <div class="sub">温柔地，走向你想去的方向</div>
      </div>
    </div>

    <div class="center">
      <div class="search-wrap">
        <div class="search">
        <input
          v-model="q"
          class="tw-input"
          placeholder="搜索帖子标题与内容…"
          list="tw-hist"
          @keydown.enter.prevent="search"
        />
        <datalist id="tw-hist">
          <option v-for="h in history" :key="h" :value="h" />
        </datalist>
          <button class="search-go" type="button" @click="search">搜索</button>
        </div>
      </div>
    </div>

    <div class="right">
      <label class="wallpaper-picker" title="切换壁纸">
        <span class="wallpaper-label">壁纸</span>
        <select class="wallpaper-select" :value="wallpaper" @change="onWallpaperChange">
          <option v-for="item in wallpaperOptions" :key="item.id" :value="item.id">
            {{ item.label }}
          </option>
        </select>
      </label>
      <button class="theme-toggle" type="button" :title="isDark ? '切换到日间模式' : '切换到暗色模式'" @click="toggleTheme">
        <span class="theme-ico"><Moon v-if="isDark" :size="16" /><Sun v-else :size="16" /></span>
        <span class="theme-txt">{{ isDark ? '夜间' : '日间' }}</span>
      </button>
      <button v-if="!auth.isLoggedIn" class="tw-btn tw-btn-primary" type="button" @click="router.push({ name: 'login' })">
        登录
      </button>
      <div v-else class="user-wrap">
        <div class="plus-wrap">
          <button class="tw-btn tw-btn-primary plus" type="button" @mouseenter="ui.postMenuOpen = true">
            <Plus :size="16" />
            发帖
          </button>
          <div v-if="ui.postMenuOpen" class="menu tw-card" @mouseleave="ui.postMenuOpen = false">
            <button type="button" @click="goCreate('question')">提问题</button>
            <button type="button" @click="goCreate('answer')">写回答</button>
            <button type="button" @click="goCreate('article')">写文章</button>
          </div>
        </div>
        <div class="msg-wrap">
          <button class="msg-btn" type="button" title="消息通知" @click="toggleMsg"><Bell :size="18" /></button>
          <span v-if="hasUnread && unread" class="msg-dot">{{ msgCountText }}</span>
          <div v-if="msgOpen" class="msg-panel tw-card">
            <div class="msg-tabs">
              <span>@回复</span>
              <span>系统通知</span>
              <span>点赞提醒</span>
            </div>
            <div class="msg-empty">暂无新消息</div>
          </div>
        </div>
        <button class="avatar" type="button" @click="userMenuOpen = !userMenuOpen">
          <img v-if="auth.user?.avatar_url" :src="auth.user.avatar_url" alt="" />
          <span v-else>{{ auth.user?.username?.slice(0, 1) }}</span>
        </button>
        <div v-if="userMenuOpen" class="user-menu tw-card">
          <button type="button" class="um-item" @click="router.push({ name: 'profile' }); userMenuOpen = false">个人主页</button>
          <button type="button" class="um-item" @click="logout">退出登录</button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 52px;
  margin: 0;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-nav);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-bottom: 1px solid var(--border-secondary);
}
.left {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 170px;
}
.logo {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(135deg, #1a56db, #60a5fa);
  box-shadow: 0 10px 22px rgba(26, 86, 219, 0.25);
}
.brand .name {
  font-weight: 900;
  letter-spacing: 0.02em;
  color: var(--text-strong);
}
.brand .sub {
  font-size: 11px;
  color: var(--tw-muted);
  margin-top: 2px;
}
.center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
}
.search-wrap {
  display: flex;
  width: min(680px, 100%);
  align-items: center;
  justify-content: center;
}
.search {
  width: min(560px, 100%);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}
.search-go {
  border: none;
  background: var(--bg-muted);
  color: var(--tw-primary);
  border-radius: 10px;
  padding: 0 10px;
  cursor: pointer;
  font-weight: 700;
}
.wallpaper-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--bg-soft);
  color: var(--text-primary);
}
.wallpaper-label {
  font-size: 12px;
  font-weight: 800;
}
.wallpaper-select {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
  outline: none;
  cursor: pointer;
}
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--bg-soft);
  color: var(--text-primary);
  cursor: pointer;
}
.theme-ico {
  line-height: 1;
  display: inline-flex;
  align-items: center;
}
.theme-txt {
  font-size: 12px;
  font-weight: 800;
}
.plus-wrap {
  position: relative;
}
.plus {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.menu {
  position: absolute;
  right: 0;
  top: 46px;
  padding: 8px;
  display: grid;
  gap: 6px;
  min-width: 160px;
  border: 1px solid var(--border-primary);
}
.menu button {
  border: none;
  background: var(--bg-muted);
  color: var(--text-primary);
  padding: 10px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  min-width: 240px;
}
.msg-wrap {
  position: relative;
}
.msg-btn {
  border: none;
  background: var(--bg-soft);
  color: var(--text-primary);
  width: 36px;
  height: 36px;
  border-radius: 999px;
  cursor: pointer;
}
.msg-dot {
  position: absolute;
  right: -4px;
  top: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  font-weight: 800;
}
.msg-panel {
  position: absolute;
  right: -30px;
  top: 44px;
  width: 280px;
  padding: 10px;
  border: 1px solid var(--border-primary);
  z-index: 60;
}
.msg-tabs {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--tw-muted);
  margin-bottom: 10px;
}
.msg-empty {
  font-size: 13px;
  color: var(--tw-muted);
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 2px solid var(--border-primary);
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-soft);
  font-weight: 900;
  color: var(--text-primary);
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.user-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-menu {
  position: absolute;
  right: 0;
  top: 48px;
  min-width: 160px;
  padding: 8px;
  display: grid;
  gap: 4px;
  border: 1px solid var(--border-primary);
  z-index: 60;
}
.um-item {
  border: none;
  background: var(--bg-muted);
  color: var(--text-primary);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  text-align: left;
}
.um-item:hover {
  background: color-mix(in srgb, var(--tw-primary) 18%, transparent);
}
@media (max-width: 900px) {
  .wallpaper-label {
    display: none;
  }
  .wallpaper-picker {
    padding: 0 8px;
  }
  .brand .sub {
    display: none;
  }
  .search {
    width: min(360px, 100%);
  }
  .theme-txt {
    display: none;
  }
  .theme-toggle {
    padding: 0 10px;
  }
}
</style>
