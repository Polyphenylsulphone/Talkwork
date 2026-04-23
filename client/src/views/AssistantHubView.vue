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
<<<<<<< HEAD
  padding: 20px 24px;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  margin-bottom: 16px;
=======
  padding: 24px 32px;
  border: none;
  border-radius: 24px;
  margin-bottom: 24px;
  background: #FFFFFF;
>>>>>>> d6473da (前端样式改动，加入默认头像)
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.muted {
  margin: 0;
  color: var(--tw-muted);
  line-height: 1.55;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.card {
  text-align: left;
<<<<<<< HEAD
  padding: 20px;
  cursor: pointer;
  border: 1px solid var(--border-primary);
=======
  padding: 24px;
  cursor: pointer;
  border: none;
  border-radius: 24px;
  background: #FFFFFF;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}
.card:hover {
  transform: translateY(-4px);
<<<<<<< HEAD
  box-shadow: var(--shadow-hover);
  border-color: color-mix(in srgb, var(--tw-primary) 30%, transparent);
}
.emoji {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--tw-primary) 8%, transparent);
  color: var(--tw-primary);
  margin-bottom: 16px;
=======
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
}
.emoji {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F3F4F6;
  color: var(--tw-primary);
  margin-bottom: 20px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  transition: transform 0.3s ease;
}
.card:hover .emoji {
  transform: scale(1.1) rotate(-5deg);
}
.t {
<<<<<<< HEAD
  font-weight: 900;
  font-size: 18px;
  margin-bottom: 8px;
}
.d {
  color: var(--tw-muted);
=======
  font-weight: 800;
  font-size: 20px;
  margin-bottom: 8px;
  color: #111827;
}
.d {
  color: #6B7280;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  line-height: 1.6;
  font-size: 14px;
}
.hist {
<<<<<<< HEAD
  margin-top: 16px;
  padding: 20px;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
=======
  margin-top: 24px;
  padding: 24px 32px;
  border: none;
  border-radius: 24px;
  background: #FFFFFF;
>>>>>>> d6473da (前端样式改动，加入默认头像)
}
.h {
  font-weight: 800;
  font-size: 20px;
  margin-bottom: 16px;
}
.row {
  width: 100%;
<<<<<<< HEAD
  border: 1px solid var(--border-secondary);
  background: var(--bg-soft);
  border-radius: 14px;
  padding: 14px 16px;
=======
  border: none;
  background: #F9FAFB;
  border-radius: 16px;
  padding: 16px 20px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  cursor: pointer;
<<<<<<< HEAD
  margin-bottom: 10px;
=======
  margin-bottom: 12px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  transition: all 0.2s ease;
}
.row:hover {
  transform: translateX(4px);
<<<<<<< HEAD
  border-color: color-mix(in srgb, var(--tw-primary) 30%, transparent);
  background: color-mix(in srgb, var(--tw-primary) 4%, var(--bg-soft));
=======
  background: #F3F4F6;
>>>>>>> d6473da (前端样式改动，加入默认头像)
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
