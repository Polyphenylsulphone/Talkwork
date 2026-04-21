<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Ellipsis, EyeOff, PencilLine, Play, SquarePen, Trash2 } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import { useAuthStore } from '../stores/auth';
import { collegeLabel } from '../constants';
import PostCard from '../components/PostCard.vue';
import { toast } from '../stores/toast';

const router = useRouter();
const auth = useAuthStore();

const tab = ref('posts');
const q = ref('');
const list = ref([]);
const resumeDrafts = ref([]);
const menuPostId = ref(0);
const RESUME_DRAFT_KEY = 'tw_resume_drafts';

const visibleList = computed(() => {
  if (tab.value !== 'history') return list.value;
  const seen = new Set();
  return list.value.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
});

async function load() {
  if (tab.value === 'posts') list.value = unwrap(await http.get('/profile/posts', { params: { q: q.value || undefined } }));
  if (tab.value === 'collects') list.value = unwrap(await http.get('/profile/collects', { params: { q: q.value || undefined } }));
  if (tab.value === 'likes') list.value = unwrap(await http.get('/profile/likes', { params: { q: q.value || undefined } }));
  if (tab.value === 'history') list.value = unwrap(await http.get('/profile/history', { params: { q: q.value || undefined } }));
  if (tab.value === 'resumes') loadResumeDrafts();
}

watch(tab, load);

onMounted(async () => {
  const me = unwrap(await http.get('/auth/me'));
  auth.patchUser(me);
  document.addEventListener('click', onDocClick);
  await load();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
});

function onDocClick(e) {
  if (!menuPostId.value) return;
  if (!e.target.closest('.menu-box')) {
    menuPostId.value = 0;
  }
}

async function delPost(id) {
  if (!confirm('删除该帖子？')) return;
  await http.delete(`/posts/${id}`);
  toast.success('已删除');
  menuPostId.value = 0;
  await load();
}

async function togglePrivate(post) {
  const next = !post.is_private;
  await http.patch(`/profile/posts/${post.id}/privacy`, { is_private: next });
  toast.success(next ? '已设为私密' : '已设为公开');
  menuPostId.value = 0;
  await load();
}

async function uncollect(id) {
  await http.delete(`/profile/collects/${id}`);
  await load();
}

async function clearHist() {
  if (!confirm('清空浏览记录？')) return;
  await http.delete('/profile/history');
  await load();
}

function loadResumeDrafts() {
  try {
    const rows = JSON.parse(localStorage.getItem(RESUME_DRAFT_KEY) || '[]');
    resumeDrafts.value = Array.isArray(rows) ? rows : [];
  } catch {
    resumeDrafts.value = [];
  }
}

function editResumeDraft(draft) {
  router.push({ name: 'resume-create', query: { draftId: draft.id } });
}

function useDraftForInterview(draft) {
  sessionStorage.setItem('tw_resume_text', JSON.stringify(draft.form || {}, null, 2));
  router.push({ name: 'interview' });
}

function removeResumeDraft(id) {
  if (!confirm('删除该简历草稿？')) return;
  const next = resumeDrafts.value.filter((d) => d.id !== id);
  resumeDrafts.value = next;
  localStorage.setItem(RESUME_DRAFT_KEY, JSON.stringify(next));
  toast.success('草稿已删除');
}
</script>

<template>
  <div>
    <section class="head tw-card">
      <div class="avatar">
        <div class="circle">
          <img v-if="auth.user?.avatar_url" :src="auth.user.avatar_url" alt="" />
          <span v-else>{{ auth.user?.username?.slice(0, 1) }}</span>
        </div>
      </div>
      <div class="info">
        <div class="name">{{ auth.user?.username }}</div>
        <div class="muted">ID：{{ auth.user?.id }} · {{ collegeLabel(auth.user?.college) }}</div>
        <div class="bio">{{ auth.user?.bio || '还没有填写简介，快去补充你的标签吧。' }}</div>
      </div>
      <div class="grow" />
      <button class="tw-btn tw-btn-ghost" type="button" @click="router.push({ name: 'profile-edit' })">
        <PencilLine :size="15" />
        编辑资料
      </button>
    </section>

    <div class="tabs">
      <button type="button" :class="{ on: tab === 'posts' }" @click="tab = 'posts'">帖子</button>
      <button type="button" :class="{ on: tab === 'collects' }" @click="tab = 'collects'">收藏</button>
      <button type="button" :class="{ on: tab === 'likes' }" @click="tab = 'likes'">点赞</button>
      <button type="button" :class="{ on: tab === 'history' }" @click="tab = 'history'">浏览记录</button>
      <button type="button" :class="{ on: tab === 'resumes' }" @click="tab = 'resumes'">我的简历</button>
    </div>

    <div class="toolbar tw-card">
      <input v-model="q" class="tw-input" placeholder="在当前 Tab 内搜索…" @keydown.enter="load" />
      <button class="tw-btn tw-btn-ghost" type="button" @click="load">搜索</button>
      <div class="grow" />
      <button v-if="tab === 'history'" class="tw-btn tw-btn-ghost" type="button" @click="clearHist">清空记录</button>
    </div>

    <div v-if="tab !== 'resumes'" class="feed">
      <div v-for="p in visibleList" :key="`${p.id}_${p.viewed_at || p.created_at || ''}`" class="wrap-p">
        <PostCard :post="p">
          <template #top-right-extra>
            <div v-if="tab === 'posts'" class="menu-box">
              <button class="dot-btn" type="button" @click.stop="menuPostId = menuPostId === p.id ? 0 : p.id">
                <Ellipsis :size="16" />
              </button>
              <div v-if="menuPostId === p.id" class="menu-drop">
                <button type="button" class="item" @click.stop="togglePrivate(p)">
                  <EyeOff :size="14" />
                  {{ p.is_private ? '设为公开' : '设为私密' }}
                </button>
                <button type="button" class="item danger" @click.stop="delPost(p.id)">
                  <Trash2 :size="14" />
                  删除
                </button>
              </div>
            </div>
            <button v-if="tab === 'collects'" class="op-mini" type="button" @click.stop="uncollect(p.id)">取消收藏</button>
          </template>
        </PostCard>
      </div>
    </div>

    <div v-else class="feed">
      <div v-for="r in resumeDrafts" :key="r.id" class="rc tw-card">
        <div>
          <div class="t">{{ r.title }}</div>
          <div class="muted sm">更新于 {{ new Date(r.updatedAt).toLocaleString() }}</div>
        </div>
        <div class="row">
          <button class="tw-btn tw-btn-ghost" type="button" @click="editResumeDraft(r)">
            <SquarePen :size="14" />
            继续编辑
          </button>
          <button class="tw-btn tw-btn-primary" type="button" @click="useDraftForInterview(r)">
            <Play :size="14" />
            用于模拟面试
          </button>
          <button class="tw-btn tw-btn-ghost danger-btn" type="button" @click="removeResumeDraft(r.id)">
            <Trash2 :size="14" />
            删除
          </button>
        </div>
      </div>
      <div v-if="!resumeDrafts.length" class="muted tw-card pad">还没有保存的简历草稿。</div>
    </div>
  </div>
</template>

<style scoped>
.head {
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.55);
  margin-bottom: 12px;
}
.avatar {
  text-align: center;
}
.circle {
  width: 86px;
  height: 86px;
  border-radius: 999px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.65);
  border: 3px solid rgba(255, 255, 255, 0.85);
  font-size: 34px;
  font-weight: 900;
}
.circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--tw-muted);
}
.name {
  font-size: 22px;
  font-weight: 900;
}
.muted {
  color: var(--tw-muted);
  margin-top: 6px;
}
.bio {
  margin-top: 8px;
  color: var(--tw-text);
  font-size: 13px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.tabs button {
  border-radius: 999px;
  border: 1px solid rgba(26, 86, 219, 0.12);
  padding: 8px 12px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.55);
  font-weight: 900;
}
.tabs button.on {
  border-color: rgba(26, 86, 219, 0.35);
  background: rgba(26, 86, 219, 0.1);
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.grow {
  flex: 1;
}
.feed {
  display: grid;
  gap: 12px;
}
.wrap-p {
  position: relative;
}
.op-mini {
  border: 1px solid rgba(26, 86, 219, 0.2);
  background: rgba(255, 255, 255, 0.7);
  color: var(--tw-muted);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  padding: 4px 8px;
  cursor: pointer;
}
:root[data-theme='dark'] .op-mini {
  background: rgba(30, 41, 59, 0.75);
  color: #e9f0f7;
  border-color: rgba(93, 156, 245, 0.25);
}
.menu-box {
  position: relative;
}
.dot-btn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(26, 86, 219, 0.2);
  background: rgba(255, 255, 255, 0.78);
  display: inline-grid;
  place-items: center;
  color: var(--tw-muted);
  cursor: pointer;
}
.menu-drop {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 118px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
  padding: 4px;
  z-index: 40;
}
.item {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 7px 8px;
  text-align: left;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.item:hover {
  background: rgba(26, 86, 219, 0.08);
}
.item.danger {
  color: #b91c1c;
}
.rc {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.t {
  font-weight: 900;
}
.sm {
  font-size: 12px;
  margin-top: 6px;
}
.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.danger-btn {
  color: #b91c1c;
}
.pad {
  padding: 14px;
}
</style>
