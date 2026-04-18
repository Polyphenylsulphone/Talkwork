<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http, unwrap } from '../api/http';
import { toast } from '../stores/toast';
import InterviewStartingOverlay from '../components/InterviewStartingOverlay.vue';

const router = useRouter();
const selectedMode = ref('');
const resumeWay = ref('saved');
const resumes = ref([]);
const selectedResumeId = ref('');
const manualResume = ref('');
const preparing = ref(false);

const prepareSubtitle = computed(() => {
  if (resumeWay.value === 'saved') return '正在读取你的简历…';
  if (resumeWay.value === 'manual') return '正在整理你的亮点…';
  return '正在进入面试间…';
});

const modes = [
  {
    id: 'beginner',
    title: '小白模式',
    desc: '循序渐进、温柔提示，适合第一次练面试的你。',
    tone: '像朋友陪练',
  },
  {
    id: 'pro',
    title: '大佬模式',
    desc: '标准流程 + 追问，更贴近真实面试节奏。',
    tone: '认真但不冰冷',
  },
  {
    id: 'pressure',
    title: '压力模式',
    desc: '更严格的反馈节奏（演示版以文案提示为主）。',
    tone: '帮你练习稳定感',
  },
];

const canStart = computed(() => {
  if (resumeWay.value === 'saved') return !!selectedResumeId.value;
  if (resumeWay.value === 'manual') return !!manualResume.value.trim();
  return true;
});

function ensureModeSelected() {
  if (selectedMode.value) return true;
  toast.info('请先选择面试模式');
  return false;
}

onMounted(async () => {
  try {
    resumes.value = unwrap(await http.get('/resumes'));
    if (resumes.value?.length) selectedResumeId.value = String(resumes.value[0].id);
  } catch {
    resumes.value = [];
  }
});

async function startInterview() {
  if (!selectedMode.value) return toast.error('请先选择面试模式');
  preparing.value = true;
  const t0 = Date.now();
  const minPrepareMs = 520;
  try {
    let resumeText = '';
    if (resumeWay.value === 'saved') {
      if (!selectedResumeId.value) {
        preparing.value = false;
        return toast.error('请选择一份已保存简历');
      }
      const detail = unwrap(await http.get(`/resumes/${selectedResumeId.value}`));
      resumeText = JSON.stringify(detail?.data_json || {}, null, 2);
    } else if (resumeWay.value === 'manual') {
      resumeText = manualResume.value.trim();
      if (!resumeText) {
        preparing.value = false;
        return toast.error('请粘贴简历内容，或选择跳过');
      }
    }
    const wait = minPrepareMs - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    sessionStorage.setItem('tw_iv_mode', selectedMode.value);
    sessionStorage.setItem('tw_resume_text', resumeText);
    router.push({ name: 'interview-session', query: { mode: selectedMode.value } });
  } catch {
    toast.error('加载失败，请重试');
  } finally {
    preparing.value = false;
  }
}
</script>

<template>
  <div>
    <InterviewStartingOverlay :show="preparing" title="马上就好啦" :subtitle="prepareSubtitle" />

    <section class="hero tw-card">
      <h1 class="page-title">模拟面试</h1>
      <p class="muted">数字人面试官将接入魔珐星云 API（当前为温馨占位界面 + 后端题库/复盘）。</p>
    </section>

    <div class="grid">
      <button
        v-for="m in modes"
        :key="m.id"
        type="button"
        class="card tw-card"
        :class="{ on: selectedMode === m.id }"
        @click="selectedMode = m.id"
      >
        <div class="tag">{{ m.tone }}</div>
        <div class="t">{{ m.title }}</div>
        <div class="d">{{ m.desc }}</div>
      </button>
    </div>

    <section class="bind tw-card">
      <h3>关联简历</h3>
      <div class="ways">
        <button type="button" :class="{ on: resumeWay === 'saved' }" @click="resumeWay = 'saved'">① 从已保存简历选择</button>
        <button
          type="button"
          :class="{ on: resumeWay === 'manual' }"
          @click="
            if (ensureModeSelected()) resumeWay = 'manual';
          "
        >
          ② 手动粘贴
        </button>
        <button
          type="button"
          :class="{ on: resumeWay === 'skip' }"
          @click="
            if (ensureModeSelected()) resumeWay = 'skip';
          "
        >
          ③ 跳过（不关联）
        </button>
      </div>

      <div v-if="resumeWay === 'saved'" class="pane">
        <select
          v-model="selectedResumeId"
          class="tw-input"
          @focus="
            if (!selectedMode) {
              ensureModeSelected();
              $event.target.blur();
            }
          "
        >
          <option disabled value="">请选择已保存简历</option>
          <option v-for="r in resumes" :key="r.id" :value="String(r.id)">{{ r.title }}（{{ new Date(r.updated_at).toLocaleDateString() }}）</option>
        </select>
        <p v-if="!resumes.length" class="muted">暂无已保存简历，可去简历模块先保存一份。</p>
      </div>

      <div v-if="resumeWay === 'manual'" class="pane">
        <textarea
          v-model="manualResume"
          class="tw-input"
          rows="8"
          placeholder="粘贴你的简历内容（教育/项目/实习/技能等）"
        />
      </div>

      <div v-if="resumeWay === 'skip'" class="pane muted">本次不关联简历，AI 将仅基于岗位生成通用追问。</div>

      <button class="tw-btn tw-btn-primary start-btn" type="button" :disabled="!canStart || preparing" @click="startInterview">
        开始面试
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
.card.on {
  border-color: rgba(26, 86, 219, 0.45);
  box-shadow: 0 10px 24px rgba(26, 86, 219, 0.12);
}
.tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(26, 86, 219, 0.1);
  color: #1a56db;
}
.t {
  margin-top: 10px;
  font-weight: 900;
  font-size: 16px;
}
.d {
  margin-top: 8px;
  color: var(--tw-muted);
  line-height: 1.55;
  font-size: 13px;
}
.bind {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.bind h3 {
  margin: 0 0 10px;
}
.ways {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ways button {
  border-radius: 999px;
  border: 1px solid rgba(26, 86, 219, 0.18);
  background: rgba(255, 255, 255, 0.6);
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}
.ways button.on {
  border-color: rgba(26, 86, 219, 0.38);
  background: rgba(26, 86, 219, 0.12);
  color: #1a56db;
}
.pane {
  margin-top: 10px;
}
.start-btn {
  margin-top: 12px;
}
</style>
