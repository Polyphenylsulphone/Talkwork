<script setup>
import { ref, onMounted, computed } from 'vue';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import html2pdf from 'html2pdf.js';
import { useRouter } from 'vue-router';
import { http, unwrap } from '../api/http';
import { toast } from '../stores/toast';

const router = useRouter();
const job = ref('');
const resume = ref('');
const importOpen = ref(false);
const drafts = ref([]);
const importingFile = ref(false);
const isOptimizing = ref(false);
const progress = ref(0);
const progressText = ref('');
const suggestions = ref([]);
const suggestionIndex = ref(0);
const optimizedResume = ref('');
const appliedCount = ref(0);
const templatePreset = ref('minimal-clean');
const DRAFT_KEY = 'tw_resume_drafts';

onMounted(async () => {
  loadDrafts();
});

function loadDrafts() {
  try {
    drafts.value = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
  } catch {
    drafts.value = [];
  }
}

function draftToResumeText(draft) {
  const f = draft?.form || {};
  const edu = Array.isArray(f.edu) ? f.edu : [];
  const exp = Array.isArray(f.exp) ? f.exp : [];
  const lines = [
    `姓名：${f.name || ''}`,
    `求职意向：${f.role || ''}`,
    `院校/专业：${[f.school, f.major].filter(Boolean).join(' / ')}`,
    '',
    '教育经历：',
    ...(edu.length ? edu : [{ time: '', school: '', detail: '' }]).map(
      (item, idx) => `${idx + 1}. ${item.school || ''} ${item.time || ''}\n${item.detail || ''}`.trim()
    ),
    '',
    '实习/项目经历：',
    ...(exp.length ? exp : [{ time: '', org: '', detail: '' }]).map(
      (item, idx) => `${idx + 1}. ${item.org || ''} ${item.time || ''}\n${item.detail || ''}`.trim()
    ),
    '',
    `技能：${f.skills || ''}`,
    '',
    `自我评价：${f.about || ''}`,
  ];
  return lines.join('\n').trim();
}

function onPickDraft(e) {
  const id = e.target.value;
  if (!id) return;
  const draft = drafts.value.find((x) => String(x.id) === String(id));
  if (!draft) return toast.error('草稿不存在或已删除');
  resume.value = draftToResumeText(draft);
  importOpen.value = false;
  toast.success('已从草稿箱导入');
  e.target.value = '';
}

async function onPickLocalFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const lowerName = String(file.name || '').toLowerCase();
  const okType = lowerName.endsWith('.docx') || lowerName.endsWith('.pdf');
  if (!okType) return toast.error('仅支持上传 .docx / .pdf');
  importingFile.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const data = unwrap(await http.post('/resumes/extract-text', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
    const text = String(data?.text || '').trim();
    if (!text) return toast.error('未提取到文本，请更换文件');
    resume.value = text;
    importOpen.value = false;
    toast.success('本地简历导入成功');
  } finally {
    importingFile.value = false;
  }
}

async function run() {
  if (!job.value.trim()) return toast.error('请填写目标岗位');
  if (!resume.value.trim()) return toast.error('请填写简历内容');
  isOptimizing.value = true;
  progress.value = 0;
  progressText.value = 'AI正在分析你的简历...';
  suggestions.value = [];
  suggestionIndex.value = 0;
  appliedCount.value = 0;
  optimizedResume.value = resume.value;
  const timers = [];
  timers.push(
    setTimeout(() => {
      progress.value = 30;
      progressText.value = 'AI正在分析你的简历...';
    }, 200)
  );
  try {
    const req = http.post('/resumes/ai-optimize', { job_title: job.value, resume_text: resume.value });
    timers.push(
      setTimeout(() => {
        progress.value = 60;
        progressText.value = 'AI正在生成优化建议...';
      }, 900)
    );
    const data = unwrap(await req);
    const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
    suggestions.value = list.map((item, idx) => ({
      id: `${Date.now()}_${idx}`,
      title: String(item?.title || `建议 ${idx + 1}`),
      question: String(item?.question || '是否应用这条优化建议？'),
      reason: String(item?.reason || ''),
      original_text: String(item?.original_text || ''),
      rewritten_text: String(item?.rewritten_text || ''),
      applied: null,
    }));
    if (!suggestions.value.length && String(data?.optimized_text || '').trim()) {
      optimizedResume.value = String(data.optimized_text).trim();
      resume.value = optimizedResume.value;
    }
    progress.value = 100;
    progressText.value = '优化建议已准备完成';
    toast.success('优化建议生成完成');
  } finally {
    timers.forEach((t) => clearTimeout(t));
    setTimeout(() => {
      isOptimizing.value = false;
    }, 250);
  }
}

const currentSuggestion = computed(() => suggestions.value[suggestionIndex.value] || null);
const optimizationDone = computed(() => suggestions.value.length > 0 && suggestionIndex.value >= suggestions.value.length);
const displayResumeText = computed(() => (optimizedResume.value || resume.value || '').trim());

const parsedResume = computed(() => {
  const text = displayResumeText.value;
  const lines = text.split('\n').map((line) => line.trim());
  const data = {
    name: '',
    role: '',
    school: '',
    major: '',
    skills: '',
    about: '',
    edu: [],
    exp: [],
  };
  let section = '';
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('姓名：') || line.startsWith('姓名:')) data.name = line.replace(/^姓名[：:]\s*/, '').trim();
    else if (line.startsWith('求职意向：') || line.startsWith('求职意向:')) data.role = line.replace(/^求职意向[：:]\s*/, '').trim();
    else if (line.startsWith('院校/专业：') || line.startsWith('院校/专业:')) {
      const txt = line.replace(/^院校\/专业[：:]\s*/, '').trim();
      const [school, major] = txt.split('/').map((x) => x.trim());
      data.school = school || '';
      data.major = major || '';
    } else if (line === '教育经历' || line === '教育经历：') section = 'edu';
    else if (line === '实习/项目经历' || line === '实习/项目经历：' || line === '经历' || line === '经历：') section = 'exp';
    else if (line.startsWith('技能：') || line.startsWith('技能:')) {
      section = '';
      data.skills = line.replace(/^技能[：:]\s*/, '').trim();
    } else if (line.startsWith('自我评价：') || line.startsWith('自我评价:')) {
      section = '';
      data.about = line.replace(/^自我评价[：:]\s*/, '').trim();
    } else if (section === 'edu') {
      data.edu.push({ school: line.replace(/^\d+\.\s*/, ''), time: '', detail: '' });
    } else if (section === 'exp') {
      data.exp.push({ org: line.replace(/^\d+\.\s*/, ''), time: '', detail: '' });
    }
  }
  if (!data.edu.length) data.edu = [{ school: '教育经历待补充', time: '', detail: '' }];
  if (!data.exp.length) data.exp = [{ org: '经历待补充', time: '', detail: '' }];
  if (!data.name) data.name = '你的名字';
  if (!data.role) data.role = '意向岗位';
  if (!data.school) data.school = '院校';
  if (!data.major) data.major = '专业';
  return data;
});

function applyCurrent() {
  const cur = currentSuggestion.value;
  if (!cur) return;
  let next = optimizedResume.value || resume.value;
  const src = cur.original_text.trim();
  const dst = cur.rewritten_text.trim();
  if (src && dst && next.includes(src)) next = next.replace(src, dst);
  else if (dst) next = `${next.trim()}\n\n${dst}`.trim();
  optimizedResume.value = next;
  resume.value = next;
  cur.applied = true;
  appliedCount.value += 1;
  suggestionIndex.value += 1;
}

function skipCurrent() {
  const cur = currentSuggestion.value;
  if (!cur) return;
  cur.applied = false;
  suggestionIndex.value += 1;
}

async function downloadDocx() {
  const text = displayResumeText.value;
  if (!text) return toast.error('暂无可下载内容');
  const f = parsedResume.value;
  const children = [
    new Paragraph({ children: [new TextRun({ text: f.name, bold: true, size: 36 })] }),
    new Paragraph({ children: [new TextRun(`${f.role} · ${f.school} · ${f.major}`)] }),
    new Paragraph({ text: '' }),
    new Paragraph({ children: [new TextRun({ text: '教育背景', bold: true, size: 28 })] }),
    ...f.edu.map((e) => new Paragraph({ children: [new TextRun(e.school || '')] })),
    new Paragraph({ text: '' }),
    new Paragraph({ children: [new TextRun({ text: '经历', bold: true, size: 28 })] }),
    ...f.exp.map((e) => new Paragraph({ children: [new TextRun(e.org || '')] })),
    new Paragraph({ text: '' }),
    new Paragraph({ children: [new TextRun({ text: '技能', bold: true, size: 28 })] }),
    new Paragraph({ children: [new TextRun(f.skills || '')] }),
    new Paragraph({ text: '' }),
    new Paragraph({ children: [new TextRun({ text: '自我评价', bold: true, size: 28 })] }),
    new Paragraph({ children: [new TextRun(f.about || '')] }),
  ];
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'talkwork-optimized-resume.docx';
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf() {
  const el = document.getElementById('optimized-resume-preview');
  if (!el) return toast.error('未找到简历预览区域');
  html2pdf()
    .set({ margin: 10, filename: 'talkwork-optimized-resume.pdf', image: { type: 'jpeg', quality: 0.98 } })
    .from(el)
    .save();
}

function goInterview() {
  sessionStorage.setItem('tw_resume_text', optimizedResume.value || resume.value);
  router.push({ name: 'interview' });
}
</script>

<template>
  <div class="wrap tw-card">
    <div class="bar">
      <button class="tw-btn tw-btn-ghost" type="button" @click="router.push({ name: 'assistant' })">返回</button>
      <button class="tw-btn tw-btn-ghost" type="button" @click="importOpen = !importOpen">导入简历</button>
    </div>

    <div v-if="importOpen" class="import-box tw-card">
      <div class="import-title">导入来源</div>
      <div class="import-row">
        <span class="import-label">① 从草稿箱选择</span>
        <select class="tw-input sm" @change="onPickDraft">
          <option value="">选择草稿…</option>
          <option v-for="d in drafts" :key="d.id" :value="String(d.id)">
            {{ d.title }}
          </option>
        </select>
      </div>
      <div class="import-row">
        <span class="import-label">② 从本地上传（.docx / .pdf）</span>
        <label class="tw-btn tw-btn-ghost up-btn">
          {{ importingFile ? '提取中...' : '选择文件' }}
          <input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden :disabled="importingFile" @change="onPickLocalFile" />
        </label>
      </div>
      <div class="tip">本地上传后将由后端提取文字并自动填入原始简历。</div>
    </div>

    <label class="lbl">目标岗位</label>
    <input v-model="job" class="tw-input" placeholder="例如：前端开发实习" />

    <label class="lbl">原始简历</label>
    <textarea v-model="resume" class="tw-input" rows="12" placeholder="粘贴文字，或从上方导入" />

    <button class="tw-btn tw-btn-primary full" type="button" :disabled="isOptimizing" @click="run">
      {{ isOptimizing ? '优化中...' : '开始优化' }}
    </button>

    <div v-if="isOptimizing" class="loading-box tw-card">
      <div class="loading-text">{{ progressText || 'AI正在分析你的简历...' }}</div>
      <div class="pg-wrap">
        <div class="pg-inner" :style="{ width: `${progress}%` }" />
      </div>
      <div class="pg-num">{{ progress }}%</div>
    </div>

    <div v-if="currentSuggestion" class="out tw-card">
      <div class="h">逐条优化建议（{{ suggestionIndex + 1 }}/{{ suggestions.length }}）</div>
      <div class="q">{{ currentSuggestion.question }}</div>
      <div class="kv"><b>建议：</b>{{ currentSuggestion.title }}</div>
      <div class="kv"><b>原因：</b>{{ currentSuggestion.reason || '提升岗位匹配度与表达清晰度。' }}</div>
      <div class="cmp">
        <div>
          <div class="cap">原文片段</div>
          <pre class="pre">{{ currentSuggestion.original_text || '（AI 未定位到可替换原文，将在应用时追加建议文案）' }}</pre>
        </div>
        <div>
          <div class="cap">建议改写</div>
          <pre class="pre">{{ currentSuggestion.rewritten_text }}</pre>
        </div>
      </div>
      <div class="act">
        <button class="tw-btn tw-btn-primary" type="button" @click="applyCurrent">应用</button>
        <button class="tw-btn tw-btn-ghost" type="button" @click="skipCurrent">跳过</button>
      </div>
    </div>

    <div v-if="optimizationDone || optimizedResume" class="out tw-card">
      <div class="h">优化结果</div>
      <div class="kv">已应用 {{ appliedCount }} 条建议，共 {{ suggestions.length }} 条。</div>
      <div class="tpl">
        <button type="button" :class="{ on: templatePreset === 'minimal-clean' }" @click="templatePreset = 'minimal-clean'">
          简约清晰版
        </button>
        <button type="button" :class="{ on: templatePreset === 'business-pro' }" @click="templatePreset = 'business-pro'">
          商务专业版
        </button>
      </div>
      <div class="preview" :class="[templatePreset === 'business-pro' ? 'business' : 'simple', templatePreset]">
        <div id="optimized-resume-preview" class="paper">
          <div class="hero">
            <div class="hero-main">
              <div class="name">{{ parsedResume.name }}</div>
              <div class="sub">{{ parsedResume.role }} · {{ parsedResume.school }} · {{ parsedResume.major }}</div>
            </div>
            <div class="hero-photo">
              <div class="avatar ph">{{ parsedResume.name.slice(0, 1) }}</div>
            </div>
          </div>
          <div v-if="templatePreset === 'business-pro'" class="biz-top">
            <div class="biz-title">{{ parsedResume.name }}</div>
            <div class="biz-sub">{{ parsedResume.role }}</div>
          </div>
          <div class="sec">教育背景</div>
          <div v-for="(e, i) in parsedResume.edu" :key="`edu_${i}`" class="item">
            <b>{{ e.school }}</b>
          </div>
          <div class="sec">经历</div>
          <div v-for="(e, i) in parsedResume.exp" :key="`exp_${i}`" class="item">
            <b>{{ e.org }}</b>
          </div>
          <div class="sec">技能</div>
          <div class="small">{{ parsedResume.skills }}</div>
          <div class="sec">自我评价</div>
          <div class="small">{{ parsedResume.about }}</div>
        </div>
      </div>
      <div class="act">
        <button class="tw-btn tw-btn-ghost" type="button" @click="downloadDocx">导出 Word</button>
        <button class="tw-btn tw-btn-ghost" type="button" @click="exportPdf">导出 PDF</button>
      </div>
      <button class="tw-btn tw-btn-ghost full" type="button" @click="goInterview">使用优化后简历开始模拟面试</button>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.import-box {
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  display: grid;
  gap: 10px;
}
.import-title {
  font-size: 13px;
  font-weight: 900;
}
.import-row {
  display: grid;
  gap: 8px;
}
.import-label {
  font-size: 12px;
  color: var(--tw-muted);
  font-weight: 800;
}
.lbl {
  display: block;
  margin: 10px 0 8px;
  font-weight: 900;
  font-size: 12px;
  color: var(--tw-muted);
}
:root[data-theme='dark'] .lbl,
:root[data-theme='dark'] .import-label,
:root[data-theme='dark'] .tip {
  color: #b9cadf;
}
:root[data-theme='dark'] .out,
:root[data-theme='dark'] .import-box,
:root[data-theme='dark'] .loading-box {
  background: rgba(30, 41, 59, 0.75);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sm {
  max-width: 420px;
  padding: 10px;
}
.up-btn {
  width: fit-content;
}
.tip {
  color: var(--tw-muted);
  font-size: 12px;
}
.full {
  width: 100%;
  margin-top: 10px;
}
.loading-box {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.loading-text {
  font-weight: 800;
  margin-bottom: 8px;
}
.pg-wrap {
  height: 8px;
  background: rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  overflow: hidden;
}
.pg-inner {
  height: 100%;
  background: linear-gradient(90deg, #1a56db, #3b82f6);
  transition: width 0.3s ease;
}
.pg-num {
  margin-top: 6px;
  font-size: 12px;
  color: var(--tw-muted);
}
.out {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.h {
  font-weight: 900;
  margin-bottom: 8px;
}
.pre {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.65;
  color: #0f172a;
}
.preview {
  margin-top: 10px;
}
.paper {
  background: #fff;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 16px;
  color: #0f172a;
}
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 10px;
}
.hero-main {
  flex: 1;
}
.hero-photo {
  flex: 0 0 auto;
}
.name {
  font-size: 22px;
  font-weight: 900;
}
.sub {
  margin-top: 6px;
  color: var(--tw-muted);
  font-size: 13px;
}
.avatar {
  width: 96px;
  height: 134px;
  border-radius: 6px;
  object-fit: cover;
  border: 2px solid rgba(30, 58, 138, 0.14);
}
.avatar.ph {
  display: grid;
  place-items: center;
  background: #e2e8f0;
  color: #1e293b;
  font-weight: 900;
  font-size: 28px;
}
.minimal-clean .paper {
  background: #fff;
  box-shadow: none;
}
.business .paper {
  background:
    linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px) 0 0 / 100% 24px,
    #f8fafc;
  border: 1px solid rgba(30, 58, 138, 0.18);
  overflow: hidden;
}
.biz-top {
  margin: -16px -16px 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #0f2c73, #1d4ed8);
  color: #fff;
}
.biz-title {
  font-size: 24px;
  font-weight: 900;
}
.biz-sub {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.92;
}
.item {
  margin-top: 10px;
}
.sec {
  margin-top: 8px;
  font-weight: 900;
  border-bottom: 1px solid rgba(15, 23, 42, 0.14);
  padding-bottom: 6px;
}
.item { border-bottom: 1px solid rgba(15, 23, 42, 0.06); padding-bottom: 8px; }
.small { margin-top: 6px; color: #334155; line-height: 1.55; white-space: pre-wrap; }
.q {
  font-weight: 800;
  color: #1e3a8a;
  margin-bottom: 8px;
}
.kv {
  font-size: 13px;
  margin-bottom: 8px;
  color: #334155;
}
.cmp {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.cap {
  font-size: 12px;
  color: var(--tw-muted);
  font-weight: 800;
  margin-bottom: 4px;
}
.act {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
