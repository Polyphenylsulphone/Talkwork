<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FileText, Sparkles, Mic } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';

const router = useRouter();
const history = ref([]);

onMounted(async () => {
  history.value = unwrap(await http.get('/interview/history'));
});

const cards = [
  { title: '简历生成', desc: '像拼贴手账一样，把你的经历整理成好看的简历。', to: '/assistant/resume/create', icon: FileText },
  { title: '简历优化', desc: '把旧简历交给温柔又严格的 AI，一点点变好。', to: '/assistant/resume/optimize', icon: Sparkles },
  { title: '模拟面试', desc: '三种模式 + 数字人占位（接入密钥后可替换为真实流）。', to: '/assistant/interview', icon: Mic },
];
</script>

<template>
  <div>
    <section class="hero tw-card">
      <h1 class="page-title">求职助手</h1>
      <p class="muted">不着急，我们一步一步来：简历、优化、面试练习都在这里。</p>
    </section>

    <div class="grid">
      <button v-for="c in cards" :key="c.title" type="button" class="card tw-card" @click="router.push(c.to)">
        <div class="emoji"><component :is="c.icon" :size="24" /></div>
        <div class="t">{{ c.title }}</div>
        <div class="d">{{ c.desc }}</div>
      </button>
    </div>

    <section class="tw-card hist">
      <div class="h">我的面试记录</div>
      <div v-if="!history.length" class="muted">还没有记录，去模拟面试里练一次吧。</div>
      <button v-for="h in history" :key="h.id" type="button" class="row" @click="router.push({ name: 'interview-report', params: { id: h.id } })">
        <div>
          <div class="t2">{{ h.job_title }}</div>
          <div class="muted sm">{{ new Date(h.created_at).toLocaleString() }} · {{ h.mode }}</div>
        </div>
        <div class="score" v-if="h.score != null">{{ h.score }} 分</div>
      </button>
    </section>
  </div>
</template>

<style scoped>
.hero {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  margin-bottom: 12px;
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 26px;
}
.muted {
  margin: 0;
  color: var(--tw-muted);
  line-height: 1.55;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.card {
  text-align: left;
  padding: 14px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.55);
  transition: transform 0.15s ease;
}
.card:hover {
  transform: translateY(-3px);
}
.emoji {
  font-size: 30px;
  color: var(--tw-primary);
}
.t {
  margin-top: 8px;
  font-weight: 900;
  font-size: 16px;
}
.d {
  margin-top: 8px;
  color: var(--tw-muted);
  line-height: 1.55;
  font-size: 13px;
}
.hist {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.h {
  font-weight: 900;
  margin-bottom: 10px;
}
.row {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.55);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  margin-bottom: 8px;
}
.t2 {
  font-weight: 900;
  text-align: left;
}
.sm {
  font-size: 12px;
  margin-top: 4px;
  text-align: left;
}
.score {
  font-weight: 900;
  color: #1a56db;
}
</style>
