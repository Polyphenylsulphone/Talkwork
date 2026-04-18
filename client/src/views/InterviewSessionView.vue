<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Mic, Volume2 } from 'lucide-vue-next';
import Recorder from 'js-audio-recorder';
import { http, unwrap } from '../api/http';
import { toast } from '../stores/toast';

const route = useRoute();
const router = useRouter();

const mode = ref('beginner');
const job = ref('');
const resume = ref('');
const sessionId = ref('');
const questions = ref([]);
const idx = ref(0);
const answer = ref('');
const transcript = ref([]);
const started = ref(false);
const seconds = ref(0);
const ending = ref(false);
const endingText = ref('');
const jobQuery = ref('');
const jobOpen = ref(false);
const jobErr = ref('');
const hoveredIdx = ref(0);
const ivhConfigured = ref(false);
const speechConfigured = ref(false);
const speechRecording = ref(false);
const speechBusy = ref(false);
const ttsBusy = ref(false);
const ttsAudioEl = ref(null);
let speechRecorder = null;
let timer = null;

const JOB_OPTIONS = [
  '前端开发工程师',
  '后端开发工程师',
  '全栈开发工程师',
  'Java 开发工程师',
  'Go 开发工程师',
  'Python 开发工程师',
  'C++ 开发工程师',
  'PHP 开发工程师',
  '.NET 开发工程师',
  'Node.js 开发工程师',
  '移动端开发工程师',
  'Android 开发工程师',
  'iOS 开发工程师',
  '小程序开发工程师',
  'Unity 开发工程师',
  '测试开发工程师',
  '软件测试工程师',
  '自动化测试工程师',
  '性能测试工程师',
  '安全测试工程师',
  '算法工程师',
  '机器学习工程师',
  '深度学习工程师',
  '大模型应用工程师',
  'NLP 算法工程师',
  '推荐算法工程师',
  '计算机视觉工程师',
  '数据分析师',
  '数据工程师',
  '数据科学家',
  '商业分析师',
  'BI 工程师',
  '数据产品经理',
  '产品经理',
  'B端产品经理',
  'C端产品经理',
  'AI 产品经理',
  '项目产品经理',
  '产品运营',
  '用户运营',
  '内容运营',
  '增长运营',
  '新媒体运营',
  '电商运营',
  '活动运营',
  '社区运营',
  '短视频运营',
  '直播运营',
  '私域运营',
  '平台运营',
  '市场营销专员',
  '品牌营销专员',
  '市场策划',
  '数字营销专员',
  '广告优化师',
  'SEO 专员',
  'SEM 专员',
  '公关专员',
  '媒介专员',
  '商务拓展专员',
  '渠道经理',
  '商务经理',
  '销售代表',
  '销售经理',
  '电话销售',
  '大客户销售',
  '售前工程师',
  '售后工程师',
  '客户成功经理',
  '客服专员',
  '项目经理',
  'PMO 专员',
  '交付经理',
  '实施项目经理',
  'UI 设计师',
  'UX 设计师',
  '视觉设计师',
  '交互设计师',
  '平面设计师',
  '插画设计师',
  '三维设计师',
  '动效设计师',
  '品牌设计师',
  '工业设计师',
  '游戏策划',
  '游戏客户端开发',
  '游戏服务端开发',
  '技术美术 TA',
  '关卡策划',
  '数值策划',
  '运维工程师',
  'SRE 工程师',
  'DevOps 工程师',
  '云计算工程师',
  '云原生工程师',
  '网络安全工程师',
  '信息安全工程师',
  '渗透测试工程师',
  '安全运营工程师',
  '数据库管理员',
  '中间件工程师',
  '系统架构师',
  '解决方案架构师',
  '技术支持工程师',
  '实施顾问',
  'ERP 实施顾问',
  'SAP 顾问',
  '咨询顾问',
  '人力资源专员',
  '招聘专员',
  '薪酬绩效专员',
  '培训专员',
  '组织发展专员',
  '财务专员',
  '会计',
  '审计专员',
  '税务专员',
  '出纳',
  '财务分析师',
  '投资分析师',
  '风控专员',
  '合规专员',
  '法务专员',
  '行政专员',
  '总助/CEO 助理',
  '供应链专员',
  '采购专员',
  '物流专员',
  '仓储专员',
  '计划专员',
  '机械工程师',
  '电气工程师',
  '嵌入式开发工程师',
  '硬件工程师',
  '电子工程师',
  '自动化工程师',
  'PLC 工程师',
  '工艺工程师',
  '制造工程师',
  '质量工程师',
  '生产管理',
  '能源工程师',
  '环保工程师',
  '建筑设计师',
  '结构工程师',
  '土木工程师',
  '工程造价师',
  '医药代表',
  '医学信息沟通专员',
  '临床协调员 CRC',
  '临床监察员 CRA',
  '药物警戒专员',
  '护士',
  '康复治疗师',
  '教师',
  '教务专员',
  '课程顾问',
  '班主任',
  '心理咨询师',
  '社会工作者',
  '政策研究员',
  '公共事务专员',
  '政府事务专员',
  '国际事务专员',
  '社会学研究助理',
  '人口研究员',
  '公共管理专员',
  '文化产业专员',
  '博物馆讲解员',
  '图书馆管理员',
  '档案管理员',
  '考古助理',
  '文物保护专员',
  '出版编辑',
  '出版发行专员',
  '校对',
  '内容审核专员',
  '文案策划',
  '活动策划',
  '会展策划',
  '旅游策划师',
  '导游',
  '酒店运营专员',
  '会务专员',
  '英语教师',
  '语文教师',
  '历史教师',
  '政治教师',
  '地理教师',
  '教研员',
  '升学规划师',
  '留学顾问',
  '职业规划师',
  '口译员',
  '笔译员',
  '本地化专员',
  '外贸业务员',
  '跨境电商运营',
  '国际物流专员',
  '关务专员',
  '证券研究员',
  '基金运营专员',
  '保险精算助理',
  '银行柜员',
  '信贷专员',
  '风险管理师',
  '统计专员',
  '精算分析师',
  '税务师助理',
  '知识产权专员',
  '律师助理',
  '科研助理',
  '实验员',
  '化学分析员',
  '生物实验员',
  '药物研发助理',
  '临床数据管理员',
  '生物信息分析师',
  '食品研发工程师',
  '食品检验员',
  '农艺师',
  '育种研究员',
  '动物营养专员',
  '兽医助理',
  '环境监测专员',
  '环保技术员',
  'EHS 专员',
  '地理信息工程师',
  '测绘工程师',
  '地质勘查工程师',
  '气象数据分析师',
  '海洋技术员',
  '材料工程师',
  '新能源工程师',
  '光学工程师',
  '物理实验工程师',
  '数学建模工程师',
  '统计建模工程师',
  '医学编辑',
  '医学统计师',
  '公共卫生专员',
  '流行病学研究员',
  '营养师',
  '养老服务管理专员',
  '社区健康管理师',
  '艺术策展人',
  '艺术教育教师',
  '音乐教师',
  '美术教师',
  '舞蹈教师',
  '体育教师',
  '翻译',
  '编辑',
  '记者',
  '编导',
  '摄影摄像',
  '主播',
];

const filteredJobs = computed(() => {
  const q = jobQuery.value.trim().toLowerCase();
  if (!q) return JOB_OPTIONS.slice(0, 12);
  return JOB_OPTIONS.filter((x) => x.toLowerCase().includes(q)).slice(0, 20);
});

const hint = computed(() => {
  if (mode.value === 'beginner') return '提示：可以先讲结论，再补 1 个例子，会更清楚。';
  if (mode.value === 'pro') return '提示：回答里尽量出现岗位关键词，并量化结果。';
  return '提示：慢一点也没关系，稳住节奏就是加分。';
});

onMounted(async () => {
  mode.value = (route.query.mode || sessionStorage.getItem('tw_iv_mode') || 'beginner') + '';
  try {
    const raw = sessionStorage.getItem('tw_resume_text');
    if (raw) {
      if (raw.trim().startsWith('{')) resume.value = JSON.stringify(JSON.parse(raw), null, 2);
      else resume.value = raw;
    }
  } catch {
    resume.value = '';
  }
  try {
    const cfg = unwrap(await http.get('/interview/ivh/config'));
    ivhConfigured.value = !!cfg?.configured;
  } catch {
    ivhConfigured.value = false;
  }
  try {
    const sp = unwrap(await http.get('/interview/speech/config'));
    speechConfigured.value = !!sp?.configured;
  } catch {
    speechConfigured.value = false;
  }
});

async function startSpeechRecording() {
  if (!speechConfigured.value || ending.value) return;
  try {
    speechRecorder = new Recorder({ sampleBits: 16, sampleRate: 16000, numChannels: 1 });
    await speechRecorder.start();
    speechRecording.value = true;
  } catch (e) {
    toast.error(e?.message || '无法使用麦克风，请检查权限');
  }
}

async function stopSpeechRecording() {
  if (!speechRecorder || !speechRecording.value) return;
  speechBusy.value = true;
  speechRecording.value = false;
  try {
    speechRecorder.stop();
    const blob = speechRecorder.getWAVBlob();
    speechRecorder.destroy();
    speechRecorder = null;
    const fd = new FormData();
    fd.append('audio', blob, 'answer.wav');
    const out = unwrap(await http.post('/interview/speech/asr', fd));
    const t = out?.text || '';
    if (t) {
      answer.value = answer.value ? `${answer.value}\n${t}` : t;
    } else {
      toast.info('未识别到有效语音，请重试');
    }
  } catch (e) {
    console.error(e);
  } finally {
    speechBusy.value = false;
  }
}

async function speakQuestionText(text) {
  const q = String(text || '').trim();
  if (!q || !speechConfigured.value || ttsBusy.value) return;
  ttsBusy.value = true;
  try {
    const res = await http.post(
      '/interview/speech/tts',
      { text: q },
      {
        responseType: 'arraybuffer',
      }
    );
    const blob = new Blob([res.data], { type: res.headers['content-type'] || 'audio/wav' });
    const url = URL.createObjectURL(blob);
    if (ttsAudioEl.value) {
      ttsAudioEl.value.pause();
      if (ttsAudioEl.value.src?.startsWith('blob:')) URL.revokeObjectURL(ttsAudioEl.value.src);
      ttsAudioEl.value.src = url;
      await ttsAudioEl.value.play();
    } else {
      const audio = new Audio(url);
      ttsAudioEl.value = audio;
      await audio.play();
    }
  } catch {
    toast.info('题目朗读失败，可继续文字面试');
  } finally {
    ttsBusy.value = false;
  }
}

function tick() {
  seconds.value += 1;
}

async function start() {
  const selected = JOB_OPTIONS.find((x) => x === jobQuery.value.trim());
  if (!selected) {
    jobErr.value = '请选择已有岗位';
    return toast.error('请选择已有岗位');
  }
  job.value = selected;
  jobErr.value = '';
  jobOpen.value = false;
  const r = unwrap(
    await http.post('/interview/start', {
      mode: mode.value,
      job_title: job.value,
      resume_text: resume.value,
    })
  );
  sessionId.value = r.id;
  questions.value = r.questions || [];
  idx.value = 0;
  started.value = true;
  transcript.value = [];
  seconds.value = 0;
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 1000);
  await speakQuestionText(questions.value[idx.value]);
}

async function next() {
  if (ending.value) return;
  const q = questions.value[idx.value];
  transcript.value.push({ q, a: answer.value });
  answer.value = '';
  const sync = unwrap(
    await http.put(`/interview/${sessionId.value}/transcript`, {
      transcript: transcript.value,
    })
  );
  if (sync?.done || idx.value + 1 >= questions.value.length) {
    await autoFinish();
    return;
  }
  idx.value += 1;
  await speakQuestionText(questions.value[idx.value]);
  if (mode.value === 'pressure' && Math.random() < 0.25) {
    toast.info('面试官插话：等一下，我想再确认一个细节…（演示）');
  }
}

async function finish() {
  if (timer) clearInterval(timer);
  if (!sessionId.value) return;
  const r = unwrap(
    await http.post(`/interview/${sessionId.value}/finish`, {
      transcript: transcript.value,
    })
  );
  toast.success('复盘已生成');
  router.push({ name: 'interview-report', params: { id: sessionId.value }, query: { score: r.score } });
}

async function autoFinish() {
  ending.value = true;
  endingText.value = '面试已结束，正在生成报告...';
  if (timer) clearInterval(timer);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await finish();
}

function abort() {
  if (ending.value) return;
  if (!confirm('确定结束面试吗？将直接进入复盘。')) return;
  finish();
}

function pickJob(v) {
  jobQuery.value = v;
  job.value = v;
  jobOpen.value = false;
  jobErr.value = '';
}

function onJobInput() {
  jobOpen.value = true;
  jobErr.value = '';
  hoveredIdx.value = 0;
}

function onJobBlur() {
  window.setTimeout(() => {
    jobOpen.value = false;
    if (jobQuery.value && !JOB_OPTIONS.includes(jobQuery.value.trim())) {
      jobErr.value = '请选择已有岗位';
    }
  }, 120);
}

function onJobKeydown(e) {
  if (!jobOpen.value && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    jobOpen.value = true;
    return;
  }
  if (!filteredJobs.value.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    hoveredIdx.value = Math.min(hoveredIdx.value + 1, filteredJobs.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    hoveredIdx.value = Math.max(hoveredIdx.value - 1, 0);
  } else if (e.key === 'Enter' && jobOpen.value) {
    e.preventDefault();
    pickJob(filteredJobs.value[hoveredIdx.value]);
  } else if (e.key === 'Escape') {
    jobOpen.value = false;
  }
}
</script>

<template>
  <div>
    <div v-if="!started" class="prep tw-card">
      <h2 class="page-title">面试前准备</h2>
      <p class="muted">模式：<b>{{ mode }}</b></p>

      <label class="lbl">目标岗位</label>
      <div class="combo">
        <input
          v-model="jobQuery"
          class="tw-input"
          :class="{ err: !!jobErr }"
          placeholder="搜索并选择目标岗位"
          @input="onJobInput"
          @focus="jobOpen = true"
          @blur="onJobBlur"
          @keydown="onJobKeydown"
        />
        <div v-if="jobOpen" class="opts">
          <button
            v-for="(j, i) in filteredJobs"
            :key="j"
            type="button"
            class="opt"
            :class="{ on: i === hoveredIdx }"
            @mousedown.prevent="pickJob(j)"
            @mouseenter="hoveredIdx = i"
          >
            {{ j }}
          </button>
          <div v-if="!filteredJobs.length" class="empty">未找到匹配岗位，请调整关键词</div>
        </div>
      </div>
      <div v-if="jobErr" class="err-tip">{{ jobErr }}</div>

      <label class="lbl">关联简历（可粘贴文字）</label>
      <textarea v-model="resume" class="tw-input" rows="10" placeholder="从简历生成页一键带来的内容会出现在这里（可选）" />

      <div class="avatar tw-card">
        <div class="bubble">数字人预览占位</div>
        <div class="face">🧑‍🏫</div>
        <div class="muted sm">接入魔珐星云后，这里会显示面试官形象与口型同步视频流。</div>
      </div>

      <button class="tw-btn tw-btn-primary full" type="button" @click="start">开始面试</button>
    </div>

    <div v-else class="live">
      <div class="top tw-card">
        <div class="muted">计时：{{ Math.floor(seconds / 60) }}分{{ seconds % 60 }}秒</div>
        <div class="grow" />
        <span class="pill">{{ mode }}</span>
        <button class="tw-btn tw-btn-ghost" type="button" :disabled="ending" @click="abort">结束面试</button>
      </div>

      <div class="grid">
        <div class="left tw-card">
          <div class="stage">
            <template v-if="!ivhConfigured">
              <video class="fallback-video" src="/digital-human-fallback.mp4" autoplay loop muted playsinline controls />
              <div class="muted sm">未接入数字人会话时，循环播放本地数字人视频。</div>
            </template>
            <template v-else>
              <div class="big">🎥</div>
              <div class="muted">数字人渲染区（WebSocket/SSE 推流占位）</div>
            </template>
          </div>
          <div class="hint tw-card">{{ hint }}</div>
        </div>

        <div class="right tw-card">
          <div class="q">第 {{ idx + 1 }} / {{ questions.length }} 题</div>
          <div class="qt">{{ questions[idx] }}</div>
          <button
            v-if="speechConfigured"
            class="tw-btn tw-btn-ghost read-btn"
            type="button"
            :disabled="ttsBusy || ending"
            @click="speakQuestionText(questions[idx])"
          >
            <Volume2 :size="16" />
            {{ ttsBusy ? '朗读中…' : '朗读题目' }}
          </button>

          <div class="log">
            <div v-for="(t, i) in transcript" :key="i" class="item">
              <div class="b">问</div>
              <div>{{ t.q }}</div>
              <div class="b me">我</div>
              <div>{{ t.a }}</div>
            </div>
          </div>

          <div v-if="ending" class="ending">{{ endingText }}</div>
          <div v-if="speechConfigured" class="speech-row">
            <button
              v-if="!speechRecording"
              class="tw-btn tw-btn-ghost speech-btn"
              type="button"
              :disabled="ending || speechBusy"
              @click="startSpeechRecording"
            >
              <Mic class="speech-ic" :size="18" />
              语音回答（阿里云识别）
            </button>
            <button
              v-else
              class="tw-btn tw-btn-primary speech-btn"
              type="button"
              :disabled="speechBusy"
              @click="stopSpeechRecording"
            >
              停止并转为文字
            </button>
            <span v-if="speechBusy" class="muted sm">识别中…</span>
            <span v-else-if="speechRecording" class="muted sm">录音中，说完后点击停止</span>
          </div>
          <textarea
            v-model="answer"
            class="tw-input"
            rows="5"
            :disabled="ending"
            :placeholder="speechConfigured ? '可打字或点击上方语音回答' : '用文字回答'"
          />
          <button class="tw-btn tw-btn-primary full" type="button" :disabled="ending" @click="next">
            {{ ending ? '报告生成中…' : '发送并下一题' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prep {
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.prep h2 {
  margin: 0 0 8px;
}
.muted {
  color: var(--tw-muted);
  line-height: 1.55;
}
.lbl {
  display: block;
  margin: 12px 0 8px;
  font-weight: 900;
  font-size: 12px;
  color: var(--tw-muted);
}
.combo {
  position: relative;
}
.opts {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  max-height: 260px;
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  z-index: 20;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
  padding: 4px;
}
.opt {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
}
.opt:hover,
.opt.on {
  background: rgba(26, 86, 219, 0.08);
}
.empty {
  padding: 8px 10px;
  color: var(--tw-muted);
  font-size: 12px;
}
.err-tip {
  margin-top: 6px;
  color: #b91c1c;
  font-size: 12px;
}
:deep(.tw-input.err) {
  border-color: rgba(185, 28, 28, 0.6);
}
.avatar {
  margin-top: 12px;
  padding: 12px;
  display: grid;
  gap: 8px;
  justify-items: center;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.face {
  font-size: 54px;
}
.bubble {
  font-weight: 900;
}
.sm {
  font-size: 12px;
  text-align: center;
}
.full {
  width: 100%;
  margin-top: 12px;
}
.live .top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.grow {
  flex: 1;
}
.pill {
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(26, 86, 219, 0.1);
  color: #1a56db;
}
.grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 12px;
  align-items: start;
}
@media (max-width: 980px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.left,
.right {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.stage {
  border-radius: 16px;
  padding: 18px;
  background: rgba(26, 86, 219, 0.06);
  text-align: center;
}
.fallback-video {
  width: 100%;
  max-height: 360px;
  border-radius: 12px;
  background: #0f172a;
  object-fit: cover;
}
.big {
  font-size: 44px;
}
.hint {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.q {
  font-weight: 900;
  color: var(--tw-muted);
}
.qt {
  margin-top: 8px;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.45;
}
.read-btn {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.log {
  margin: 12px 0;
  display: grid;
  gap: 10px;
  max-height: 220px;
  overflow: auto;
}
.item {
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.55);
}
.b {
  font-size: 12px;
  font-weight: 900;
  color: #1a56db;
  margin-bottom: 4px;
}
.b.me {
  margin-top: 8px;
  color: #ea580c;
}
.ending {
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(26, 86, 219, 0.1);
  color: #1a56db;
  font-weight: 800;
  font-size: 13px;
}
.speech-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.speech-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.speech-ic {
  flex-shrink: 0;
}
</style>
