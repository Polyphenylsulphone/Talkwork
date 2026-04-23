<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http, unwrap } from '../api/http';
import PostCard from '../components/PostCard.vue';

const route = useRoute();
const router = useRouter();

const tab = ref('all');
const college = ref('all');
const sort = ref('time');
const q = ref('');
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const done = ref(false);
let lastAutoLoadAt = 0;

watch(
  () => route.fullPath,
  () => {
    tab.value = (route.query.tab || 'all') + '';
    college.value = (route.query.college || 'all') + '';
    sort.value = (route.query.sort || 'time') + '';
    q.value = (route.query.q || '') + '';
    reload();
  }
);

onMounted(() => {
  tab.value = (route.query.tab || 'all') + '';
  college.value = (route.query.college || 'all') + '';
  sort.value = (route.query.sort || 'time') + '';
  q.value = (route.query.q || '') + '';
  reload();
  document.addEventListener('scroll', onScroll, true);
});
onBeforeUnmount(() => document.removeEventListener('scroll', onScroll, true));

function onScroll(e) {
  const target = e.target;
  if (!target || !target.clientHeight) return;
  const nearBottom = target.clientHeight + target.scrollTop > target.scrollHeight - 220;
  const now = Date.now();
  if (nearBottom && now - lastAutoLoadAt >= 500) {
    lastAutoLoadAt = now;
    loadMore();
  }
}

async function reload() {
  page.value = 1;
  done.value = false;
  list.value = [];
  await loadMore();
}

async function loadMore() {
  if (loading.value || done.value) return;
  loading.value = true;
  try {
    const data = unwrap(
      await http.get('/qa', {
        params: {
          tab: tab.value,
          college: college.value === 'all' ? undefined : college.value,
          sort: sort.value,
          q: q.value.trim() || undefined,
          page: page.value,
        },
      })
    );
    const chunk = data.list || [];
    list.value = list.value.concat(chunk);
    if (chunk.length < data.pageSize) done.value = true;
    page.value += 1;
  } finally {
    loading.value = false;
  }
}

function setTab(t) {
  router.push({ name: 'qa', query: { ...route.query, tab: t === 'all' ? undefined : t } });
}

function setCollege(c) {
  router.push({ name: 'qa', query: { ...route.query, college: c === 'all' ? undefined : c } });
}

function setSort(s) {
  router.push({ name: 'qa', query: { ...route.query, sort: s === 'time' ? undefined : s } });
}

function search() {
  router.push({ name: 'qa', query: { ...route.query, q: q.value.trim() || undefined } });
}
</script>

<template>
  <div>
    <div class="head tw-card">
      <div class="page-title big">问答圈</div>
      <p class="muted">选一个问题，用你的经验给别人一点光亮。</p>

      <div class="tabs">
        <button type="button" :class="{ on: tab === 'all' }" @click="setTab('all')">全部</button>
        <button type="button" :class="{ on: tab === 'unanswered' }" @click="setTab('unanswered')">未回答</button>
        <button type="button" :class="{ on: tab === 'answered' }" @click="setTab('answered')">已回答</button>
      </div>

      <div class="qrow">
        <input v-model="q" class="tw-input" placeholder="搜索问答圈内容…" @keydown.enter.prevent="search" />
        <button type="button" class="tw-btn tw-btn-ghost" @click="search">搜索</button>
      </div>

      <div class="cols">
        <button type="button" :class="[{ on: college === 'all' }, 'btn-all']" @click="setCollege('all')">全部学院</button>
        <button type="button" :class="[{ on: college === 'engineering' }, 'cat-engineering']" @click="setCollege('engineering')">工科</button>
        <button type="button" :class="[{ on: college === 'science' }, 'cat-science']" @click="setCollege('science')">理科</button>
        <button type="button" :class="[{ on: college === 'liberal' }, 'cat-liberal']" @click="setCollege('liberal')">文科</button>
        <button type="button" :class="[{ on: college === 'other' }, 'cat-other']" @click="setCollege('other')">其他</button>
      </div>

      <div class="sorts">
        <button type="button" :class="{ on: sort === 'time' }" @click="setSort('time')">按时间</button>
        <button type="button" :class="{ on: sort === 'hot' }" @click="setSort('hot')">按热度</button>
      </div>
    </div>

    <div class="feed">
      <PostCard v-for="p in list" :key="p.id" :post="p" />
    </div>
    <div v-if="!list.length && !loading" class="empty tw-card">这里还空空的，去提个问题吧</div>
    <div v-if="loading" class="sk-grid">
      <div v-for="i in 4" :key="i" class="sk-card tw-card">
        <div class="sk-line w70"></div>
        <div class="sk-line"></div>
        <div class="sk-line w60"></div>
      </div>
    </div>
    <div v-if="!done" class="more">
      <button class="tw-btn tw-btn-ghost" type="button" @click="loadMore">加载更多</button>
    </div>
  </div>
</template>

<style scoped>
.head {
  padding: 24px;
  border: none;
  border-radius: 24px;
  background: #FFFFFF;
  margin-bottom: 24px;
}
.big {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
}
.muted {
  margin: 8px 0 16px;
  color: var(--tw-muted);
  line-height: 1.5;
}
.tabs,
.cols,
.sorts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.sorts {
  margin-top: 10px;
}
.tabs button,
.cols button,
.sorts button {
  border: none;
  background: #F3F4F6;
  padding: 8px 16px;
  border-radius: 9999px;
  cursor: pointer;
  font-weight: 600;
  color: #4B5563;
  transition: all 0.2s ease;
}
.tabs button:hover,
.cols button.btn-all:hover,
.sorts button:hover {
  background: #E5E7EB;
}
.tabs button.on,
.cols button.btn-all.on,
.sorts button.on {
  background: var(--tw-primary);
  color: #FFFFFF;
}

.cols button.cat-engineering { background: #FDE68A; color: #111827; }
.cols button.cat-science { background: #E5E7EB; color: #111827; }
.cols button.cat-liberal { background: #BFDBFE; color: #111827; }
.cols button.cat-other { background: #FBCFE8; color: #111827; }

.cols button.cat-engineering.on,
.cols button.cat-science.on,
.cols button.cat-liberal.on,
.cols button.cat-other.on {
  outline: 3px solid var(--tw-primary);
  outline-offset: 2px;
}
.qrow {
  margin: 16px 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
}
.feed {
  display: grid;
  gap: 12px;
}
.empty {
  padding: 16px;
  text-align: center;
  color: var(--tw-muted);
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.sk-grid {
  display: grid;
  gap: 12px;
}
.sk-card {
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.sk-line {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.14), rgba(148, 163, 184, 0.28), rgba(148, 163, 184, 0.14));
  background-size: 220% 100%;
  animation: sk 1.2s linear infinite;
  margin-bottom: 10px;
}
.sk-line.w70 {
  width: 70%;
}
.sk-line.w60 {
  width: 60%;
  margin-bottom: 0;
}
@keyframes sk {
  to {
    background-position: -120% 0;
  }
}
.more {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
</style>
