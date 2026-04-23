<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
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
  document.addEventListener('scroll', onScroll, true);
});
onBeforeUnmount(() => document.removeEventListener('scroll', onScroll, true));

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

function pickCollege(id) {
  router.push({ name: 'home', query: { ...route.query, college: id === 'all' ? undefined : id } });
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

// Compute stats for donut chart
const stats = computed(() => {
  const counts = { engineering: 0, science: 0, liberal: 0, other: 0 };
  let total = 0;
  list.value.forEach(p => {
    if (counts[p.college] !== undefined) {
      counts[p.college]++;
      total++;
    }
  });
  
  if (total === 0) {
    return {
      engineering: { offset: 0, dash: 0 },
      science: { offset: 0, dash: 0 },
      liberal: { offset: 0, dash: 0 },
      other: { offset: 0, dash: 0 },
      total: 0
    };
  }

  const circumference = 2 * Math.PI * 40; // r=40
  let currentOffset = 0;
  
  const result = {};
  for (const key in counts) {
    const percentage = counts[key] / total;
    const dash = percentage * circumference;
    result[key] = {
      dash: dash,
      offset: circumference - currentOffset
    };
    currentOffset += dash;
  }
  
  result.total = total;
  return result;
});

</script>

<template>
  <div class="home-layout">
    <div class="home-left">
      <div class="hero-text">
        <h1>今天，也想把求职这件事聊得温柔一点。</h1>
      </div>
<<<<<<< HEAD
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
          <div class="mini">看看同院同学都在聊些什么</div>
        </button>
        <button type="button" class="academy tw-card" :class="{ on: college === 'all' }" @click="pickCollege('all')">
          <div class="big"><Layers :size="24" /></div>
          <div class="name">全部</div>
          <div class="mini">不筛选，随便逛逛</div>
        </button>
=======
      
      <div class="stats-card tw-card">
        <div class="stats-title">选个圈子逛逛吧</div>
        <div class="donut-chart">
          <!-- SVG Donut Chart -->
          <svg viewBox="0 0 100 100" class="donut">
            <!-- Background ring -->
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F3F4F6" stroke-width="12"></circle>
            
            <!-- Dynamic segments based on actual data -->
            <template v-if="stats.total > 0">
              <!-- Engineering (Yellow) -->
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#FDE68A" stroke-width="12" 
                :stroke-dasharray="`${stats.engineering.dash} 251.2`" 
                :stroke-dashoffset="stats.engineering.offset" 
                transform="rotate(-90 50 50)"></circle>
              <!-- Science (Gray) -->
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E5E7EB" stroke-width="12" 
                :stroke-dasharray="`${stats.science.dash} 251.2`" 
                :stroke-dashoffset="stats.science.offset" 
                transform="rotate(-90 50 50)"></circle>
              <!-- Liberal (Blue) -->
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#BFDBFE" stroke-width="12" 
                :stroke-dasharray="`${stats.liberal.dash} 251.2`" 
                :stroke-dashoffset="stats.liberal.offset" 
                transform="rotate(-90 50 50)"></circle>
              <!-- Other (Pink) -->
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#FBCFE8" stroke-width="12" 
                :stroke-dasharray="`${stats.other.dash} 251.2`" 
                :stroke-dashoffset="stats.other.offset" 
                transform="rotate(-90 50 50)"></circle>
            </template>
            <!-- Fallback static segments if no data yet -->
            <template v-else>
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#FDE68A" stroke-width="12" stroke-dasharray="62.8 251.2" stroke-dashoffset="0" transform="rotate(-90 50 50)"></circle>
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E5E7EB" stroke-width="12" stroke-dasharray="62.8 251.2" stroke-dashoffset="-62.8" transform="rotate(-90 50 50)"></circle>
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#BFDBFE" stroke-width="12" stroke-dasharray="62.8 251.2" stroke-dashoffset="-125.6" transform="rotate(-90 50 50)"></circle>
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#FBCFE8" stroke-width="12" stroke-dasharray="62.8 251.2" stroke-dashoffset="-188.4" transform="rotate(-90 50 50)"></circle>
            </template>
            
            <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" class="donut-text">
              <tspan x="50" dy="-5" font-size="12" fill="#6B7280">总帖子</tspan>
              <tspan x="50" dy="20" font-size="20" font-weight="900" fill="#111827">{{ list.length > 0 ? list.length + '+' : '...' }}</tspan>
            </text>
          </svg>
>>>>>>> d6473da (前端样式改动，加入默认头像)
        </div>
      </div>

      <div class="categories-section">
        <div class="cat-header">
          <button type="button" class="btn-all" :class="{ on: college === 'all' }" @click="pickCollege('all')">
            全部
          </button>
        </div>
        
        <div class="cat-grid">
          <button
            v-for="c in COLLEGES"
            :key="c.id"
            type="button"
            class="academy tw-card"
            :class="[{ on: college === c.id }, `cat-${c.id}`]"
            @click="pickCollege(c.id)"
          >
            <div class="cat-content">
              <div class="name">{{ c.label }}</div>
              <div class="mini">看看同院同学都在聊些什么</div>
            </div>
            <div class="big"><component :is="getCollegeIcon(c.id)" :size="24" /></div>
          </button>
        </div>
      </div>
    </div>

    <div class="home-right">
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
    </div>
  </div>
</template>

<style scoped>
<<<<<<< HEAD
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
=======
.home-layout {
>>>>>>> d6473da (前端样式改动，加入默认头像)
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  align-items: start;
}
<<<<<<< HEAD
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
=======

@media (max-width: 900px) {
  .home-layout {
    grid-template-columns: 1fr;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  }
}

.home-left {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero-text h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
  color: #111827;
  line-height: 1.4;
  letter-spacing: -0.02em;
}

.stats-card {
  padding: 24px;
  border: none;
  border-radius: 24px;
  background: #FFFFFF;
  text-align: center;
}

.stats-title {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 20px;
}

.donut-chart {
  width: 160px;
  height: 160px;
  margin: 0 auto;
  position: relative;
}

.donut {
  width: 100%;
  height: 100%;
}

.donut circle {
  transition: stroke-dasharray 1s ease-out, stroke-dashoffset 1s ease-out;
}

.donut-text {
  font-family: inherit;
}

.categories-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cat-header {
  display: flex;
  justify-content: flex-end;
}

.btn-all {
  background: #111827;
  color: #FFFFFF;
  border: none;
  border-radius: 9999px;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-all:hover {
  background: #374151;
}

.btn-all.on {
  box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #111827;
}

.cat-grid {
  display: grid;
  gap: 12px;
}

.academy {
  text-align: left;
  padding: 20px;
  cursor: pointer;
  border: none;
  border-radius: 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cat-engineering { background: #FDE68A; }
.cat-science { background: #E5E7EB; }
.cat-liberal { background: #BFDBFE; }
.cat-other { background: #FBCFE8; }

.academy:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
}

.academy.on {
  outline: 3px solid var(--tw-primary);
  outline-offset: 2px;
}

.cat-content {
  flex: 1;
}

.name {
  font-weight: 800;
  font-size: 16px;
  color: #111827;
}

.mini {
  margin-top: 4px;
  font-size: 12px;
  color: #4B5563;
  line-height: 1.4;
}

.big {
  color: #111827;
  opacity: 0.8;
  margin-left: 12px;
}

.home-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feed {
  display: grid;
  gap: 16px;
}

.hint {
  padding: 16px 20px;
  margin-bottom: 0;
  border: none;
  background: #FFFFFF;
  border-radius: 20px;
}

.empty {
  padding: 32px;
  text-align: center;
  color: var(--tw-muted);
  border: none;
  background: #FFFFFF;
  border-radius: 20px;
}

.sk-grid {
  display: grid;
  gap: 16px;
}

.sk-card {
  padding: 24px;
  border: none;
  border-radius: 24px;
  background: #FFFFFF;
}

.sk-line {
  height: 12px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #F3F4F6, #E5E7EB, #F3F4F6);
  background-size: 220% 100%;
  animation: sk 1.2s linear infinite;
  margin-bottom: 12px;
}

.sk-line.w70 { width: 70%; }
.sk-line.w60 { width: 60%; margin-bottom: 0; }

@keyframes sk {
  to { background-position: -120% 0; }
}

.end {
  text-align: center;
  color: #9CA3AF;
  padding: 16px 0;
  font-size: 14px;
}

.more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
</style>
