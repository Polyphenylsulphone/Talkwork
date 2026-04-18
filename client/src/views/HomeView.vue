<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useRouter } from 'vue-router';
import { BookOpen, ChevronLeft, ChevronRight, FlaskConical, Layers, Settings } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import PostCard from '../components/PostCard.vue';
import { COLLEGES } from '../constants';

const route = useRoute();
const router = useRouter();

const college = ref('all');
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const done = ref(false);
const collegesWrap = ref(null);
let lastAutoLoadAt = 0;

function syncFromRoute() {
  college.value = (route.query.college || 'all') + '';
  q.value = (route.query.q || '') + '';
}

const q = ref('');

watch(
  () => route.fullPath,
  () => {
    syncFromRoute();
    reload();
  }
);

onMounted(() => {
  syncFromRoute();
  reload();
  window.addEventListener('scroll', onScroll);
});
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));

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
      await http.get('/posts', {
        params: {
          page: page.value,
          pageSize: page.value === 1 ? 20 : 15,
          college: college.value === 'all' ? undefined : college.value,
          q: q.value.trim() || undefined,
        },
      })
    );
    const chunk = data.list || [];
    list.value = list.value.concat(chunk);
    if (chunk.length < (page.value === 1 ? 20 : 15)) done.value = true;
    page.value += 1;
  } finally {
    loading.value = false;
  }
}

function onScroll() {
  const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 220;
  const now = Date.now();
  if (nearBottom && now - lastAutoLoadAt >= 500) {
    lastAutoLoadAt = now;
    loadMore();
  }
}

function pickCollege(id) {
  router.push({ name: 'home', query: { ...route.query, college: id === 'all' ? undefined : id } });
}

function slideColleges(dir) {
  const el = collegesWrap.value;
  if (!el) return;
  const amount = Math.max(220, Math.floor(el.clientWidth * 0.7));
  el.scrollBy({ left: dir * amount, behavior: 'smooth' });
}

const collegeIcons = {
  engineering: Settings,
  science: FlaskConical,
  liberal: BookOpen,
  other: Layers,
};

function getCollegeIcon(id) {
  return collegeIcons[id] || Layers;
}
</script>

<template>
  <div>
    <section class="hero tw-card">
      <div class="hero-text">
        <h1 class="page-title">今天，也想把求职这件事聊得温柔一点</h1>
        <p class="sub">看看大家的经验与问题，慢慢找到属于你的节奏。</p>
      </div>
    </section>

    <section class="block">
      <div class="block-title">选个圈子逛逛</div>
      <div class="carousel-shell">
        <button type="button" class="arr" @click="slideColleges(-1)"><ChevronLeft :size="20" /></button>
        <div ref="collegesWrap" class="hscroll">
        <button
          v-for="c in COLLEGES"
          :key="c.id"
          type="button"
          class="academy tw-card"
          :class="{ on: college === c.id }"
          @click="pickCollege(c.id)"
        >
          <div class="big"><component :is="getCollegeIcon(c.id)" :size="24" /></div>
          <div class="name">{{ c.label }}</div>
          <div class="mini">看看这个学院里正在聊什么</div>
        </button>
        <button type="button" class="academy tw-card" :class="{ on: college === 'all' }" @click="pickCollege('all')">
          <div class="big"><Layers :size="24" /></div>
          <div class="name">全部</div>
          <div class="mini">不筛选，随便逛逛</div>
        </button>
        </div>
        <button type="button" class="arr" @click="slideColleges(1)"><ChevronRight :size="20" /></button>
      </div>
    </section>

    <section class="block">
      <div class="block-title">帖子信息流</div>
      <div v-if="q" class="hint tw-card">关键词：<b>{{ q }}</b> · 试试换几个更具体的词吧</div>
      <div class="feed">
        <PostCard v-for="p in list" :key="p.id" :post="p" />
      </div>
      <div v-if="!list.length && !loading" class="empty tw-card">暂无相关内容，换个关键词试试吧</div>
      <div v-if="loading" class="sk-grid">
        <div v-for="i in 4" :key="i" class="sk-card tw-card">
          <div class="sk-line w70"></div>
          <div class="sk-line"></div>
          <div class="sk-line w60"></div>
        </div>
      </div>
      <div v-if="done && list.length" class="end">没有更多了</div>
      <div v-if="!done" class="more">
        <button class="tw-btn tw-btn-ghost" type="button" :disabled="loading" @click="loadMore">加载更多</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  padding: 18px 18px;
  margin-bottom: 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.hero-text h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.35;
}
.sub {
  margin: 10px 0 0;
  color: var(--tw-muted);
  line-height: 1.55;
}
.block {
  margin-top: 14px;
}
.block-title {
  font-weight: 900;
  margin: 0 0 10px 4px;
  color: rgba(43, 47, 58, 0.85);
}
.carousel-shell {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
}
.hscroll {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 1fr);
  gap: 12px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 2px;
}
.hscroll::-webkit-scrollbar {
  height: 8px;
}
.arr {
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 18px;
  font-weight: 900;
}
.academy {
  text-align: left;
  padding: 14px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.55);
  transition: transform 0.15s ease, background 0.15s ease;
}
.academy:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.92);
}
.academy.on {
  outline: 2px solid rgba(26, 86, 219, 0.35);
}
.big {
  font-size: 30px;
}
.name {
  margin-top: 8px;
  font-weight: 900;
}
.mini {
  margin-top: 6px;
  font-size: 12px;
  color: var(--tw-muted);
  line-height: 1.35;
}
.feed {
  display: grid;
  gap: 12px;
}
.hint {
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
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
.end {
  text-align: center;
  color: #94a3b8;
  padding: 10px 0 0;
  font-size: 13px;
}
.more {
  display: flex;
  justify-content: center;
  padding: 12px 0 0;
}
</style>
