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
  padding: 24px;
  display: flex;
  gap: 20px;
  align-items: center;
  border: none;
  border-radius: 24px;
  background: #FFFFFF;
  margin-bottom: 24px;
}
.avatar {
  text-align: center;
}
.circle {
  width: 96px;
  height: 96px;
  border-radius: 9999px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #F3F4F6;
  border: 4px solid #FFFFFF;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  font-size: 36px;
  font-weight: 800;
}
.circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hint {
  margin-top: 6px;
  font-size: 13px;
  color: var(--tw-muted);
}
.name {
  font-size: 24px;
  font-weight: 800;
  color: #111827;
}
.muted {
  color: #6B7280;
  margin-top: 6px;
  font-size: 14px;
}
.bio {
  margin-top: 12px;
  color: #4B5563;
  font-size: 14px;
  line-height: 1.5;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.tabs button {
  border-radius: 9999px;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  background: #FFFFFF;
  font-weight: 600;
  color: #4B5563;
  transition: all 0.2s ease;
}
.tabs button:hover {
  background: #F9FAFB;
}
.tabs button.on {
  background: var(--tw-primary);
  color: #FFFFFF;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  margin-bottom: 20px;
  border: none;
  border-radius: 20px;
  background: #FFFFFF;
}
.grow {
  flex: 1;
}
.feed {
  display: grid;
  gap: 16px;
}
.wrap-p {
  position: relative;
}
.op-mini {
  border: none;
  background: #F3F4F6;
  color: #4B5563;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.op-mini:hover {
  background: #E5E7EB;
}
:root[data-theme='dark'] .op-mini {
  background: rgba(30, 41, 59, 0.75);
  color: #e9f0f7;
}
.menu-box {
  position: relative;
}
.dot-btn {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: none;
  background: #F3F4F6;
  display: inline-grid;
  place-items: center;
  color: #4B5563;
  cursor: pointer;
  transition: background 0.2s ease;
}
.dot-btn:hover {
  background: #E5E7EB;
}
.menu-drop {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 140px;
  border-radius: 12px;
  border: 1px solid #E5E7EB;
  background: #fff;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  padding: 8px;
  z-index: 40;
}
.item {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #4B5563;
}
.item:hover {
  background: #F3F4F6;
  color: #111827;
}
.item.danger {
  color: #EF4444;
}
.item.danger:hover {
  background: #FEF2F2;
  color: #DC2626;
}
.rc {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  border: none;
  border-radius: 20px;
  background: #FFFFFF;
}
.t {
  font-weight: 800;
  font-size: 16px;
  color: #111827;
}
.sm {
  font-size: 13px;
  margin-top: 6px;
}
.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.danger-btn {
  color: #EF4444;
}
.pad {
  padding: 20px;
  border: none;
  border-radius: 20px;
  background: #FFFFFF;
}
</style>
