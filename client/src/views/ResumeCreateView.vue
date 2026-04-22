<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import html2pdf from 'html2pdf.js';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { ArrowLeft, BookTemplate, Download, File, FileText, FolderArchive, Save, Sparkles } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import { toast } from '../stores/toast';

const router = useRouter();
const route = useRoute();

const tpl = ref('simple');
const stylePreset = ref('minimal-clean');
const aiFilling = ref(false);
const exportOpen = ref(false);
const draftOpen = ref(false);
const templateModalOpen = ref(false);
const templateKeyword = ref('');
const drafts = ref([]);
const DRAFT_KEY = 'tw_resume_drafts';
const DEFAULT_WPS_TEMPLATES = [
  {
    id: 'wps-minimal-clean',
    name: 'WPS-简约清晰版',
    desc: '白底黑字，细线分割，适合校招投递',
    tpl: 'simple',
    preset: 'minimal-clean',
  },
  {
    id: 'wps-minimal-sidebar',
    name: 'WPS-简约侧栏版',
    desc: '左侧信息栏，内容层级更清楚',
    tpl: 'simple',
    preset: 'minimal-sidebar',
  },
  {
    id: 'wps-business-pro',
    name: 'WPS-商务专业版',
    desc: '深蓝顶部信息带，正式稳重',
    tpl: 'business',
    preset: 'business-pro',
  },
  {
    id: 'wps-business-modern',
    name: 'WPS-商务现代版',
    desc: '灰蓝底纹 + 高对比标题，适合社招',
    tpl: 'business',
    preset: 'business-modern',
  },
];
const wpsTemplates = ref(DEFAULT_WPS_TEMPLATES);
const avatarUploading = ref(false);
const form = reactive({
  name: '',
  school: '',
  major: '',
  role: '',
  avatar_url: '',
  edu: [{ time: '', school: '', detail: '' }],
  exp: [{ time: '', org: '', detail: '' }],
  skills: '',
  about: '',
});

onMounted(() => {
  try {
    drafts.value = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
  } catch {
    drafts.value = [];
  }
  const draftId = String(route.query.draftId || '').trim();
  if (draftId) {
    const target = drafts.value.find((d) => String(d.id) === draftId);
    if (target) openDraft(target);
  }
  loadTemplateLibrary();
});

async function loadTemplateLibrary() {
  try {
    const list = unwrap(await http.get('/resumes/templates'));
    if (!Array.isArray(list) || !list.length) return;
    wpsTemplates.value = list.map((item, idx) => ({
      id: String(item?.id || `tpl-${idx + 1}`),
      name: String(item?.name || `模板${idx + 1}`),
      desc: String(item?.desc || ''),
      tpl: item?.tpl === 'business' ? 'business' : 'simple',
      preset: String(item?.preset || ''),
    }));
  } catch {
    wpsTemplates.value = DEFAULT_WPS_TEMPLATES;
  }
}

const filteredTemplates = computed(() => {
  const kw = templateKeyword.value.trim().toLowerCase();
  if (!kw) return wpsTemplates.value;
  return wpsTemplates.value.filter((item) => {
    const txt = `${item.name} ${item.desc} ${item.tpl}`.toLowerCase();
    return txt.includes(kw);
  });
});

async function aiFill() {
  if (aiFilling.value) return;
  aiFilling.value = true;
  try {
    const r = unwrap(await http.post('/resumes/ai-fill', { data_json: form }));
    if (r.data_json) Object.assign(form, r.data_json);
    else toast.info('AI 返回未能解析为 JSON，已保留原文提示');
  } finally {
    aiFilling.value = false;
  }
}

async function saveResume() {
  unwrap(await http.post('/resumes', { title: `${form.name || '我'}的简历`, data_json: form, template: tpl.value }));
  toast.success('保存成功');
}

function saveDraft() {
  const name = prompt('请输入草稿名称（例如：字节实习版）', `${form.name || '未命名'}简历草稿`);
  if (name == null) return;
  const title = name.trim().slice(0, 40);
  if (!title) return toast.error('草稿名称不能为空');
  const match = drafts.value.find((d) => d.title.trim().toLowerCase() === title.toLowerCase());
  const id = match?.id || `d_${Date.now()}`;
  const item = {
    id,
    title,
    tpl: tpl.value,
    stylePreset: stylePreset.value,
    form: JSON.parse(JSON.stringify(form)),
    updatedAt: Date.now(),
  };
  const next = [item, ...drafts.value.filter((x) => x.id !== id)].slice(0, 10);
  drafts.value = next;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  toast.success(match ? '草稿已覆盖更新' : '草稿已保存');
}

function openDraft(d) {
  tpl.value = d.tpl === 'business' ? 'business' : 'simple';
  stylePreset.value = String(d.stylePreset || (tpl.value === 'business' ? 'business-pro' : 'minimal-clean'));
  Object.assign(form, JSON.parse(JSON.stringify(d.form || {})));
  draftOpen.value = false;
  toast.success('已加载草稿');
}

function removeDraft(id) {
  drafts.value = drafts.value.filter((d) => d.id !== id);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.value));
}

function applyLibraryTemplate(item) {
  tpl.value = item.tpl;
  stylePreset.value = item.preset;
  templateModalOpen.value = false;
  templateKeyword.value = '';
  toast.success(`已导入：${item.name}`);
}

function closeTemplateModal() {
  templateModalOpen.value = false;
  templateKeyword.value = '';
}

async function uploadImageFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = unwrap(await http.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
  return String(r?.url || '');
}

async function onPickAvatar(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) return toast.error('请选择图片文件');
  avatarUploading.value = true;
  try {
    const url = await uploadImageFile(file);
    if (!url) return toast.error('头像上传失败');
    form.avatar_url = url;
    toast.success('头像已插入');
  } finally {
    avatarUploading.value = false;
  }
}

function exportPdf() {
  const el = document.getElementById('resume-preview');
  if (!el) return;
  exportOpen.value = false;
  html2pdf()
    .set({ margin: 10, filename: 'talkwork-resume.pdf', image: { type: 'jpeg', quality: 0.98 } })
    .from(el)
    .save();
}

async function exportWord() {
  exportOpen.value = false;
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(form.name || '简历')],
          }),
          new Paragraph({
            children: [new TextRun(`${form.role || '意向岗位'}  ·  ${form.school || '院校'}  ·  ${form.major || '专业'}`)],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '教育背景' }),
          ...form.edu.flatMap((e) => [
            new Paragraph({ children: [new TextRun({ text: `${e.school || ''}  ${e.time || ''}`, bold: true })] }),
            new Paragraph({ text: e.detail || '' }),
          ]),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '经历' }),
          ...form.exp.flatMap((e) => [
            new Paragraph({ children: [new TextRun({ text: `${e.org || ''}  ${e.time || ''}`, bold: true })] }),
            new Paragraph({ text: e.detail || '' }),
          ]),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '技能' }),
          new Paragraph({ text: form.skills || '' }),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '自我评价' }),
          new Paragraph({ text: form.about || '' }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'talkwork-resume.docx';
  a.click();
  URL.revokeObjectURL(url);
}

function goInterview() {
  sessionStorage.setItem('tw_resume_text', JSON.stringify(form));
  router.push({ name: 'interview' });
}
</script>

<template>
  <div class="layout">
    <div class="form tw-card">
      <div class="bar">
        <div class="bar-group">
          <button class="tw-btn tw-btn-ghost btn-lite" type="button" @click="router.push({ name: 'assistant' })">
            <ArrowLeft :size="14" />
            返回
          </button>
          <button class="tw-btn tw-btn-ghost btn-lite" type="button" @click="templateModalOpen = true">
            <BookTemplate :size="14" />
            模板库
          </button>
          <button class="tw-btn tw-btn-ghost btn-lite" type="button" @click="draftOpen = !draftOpen">
            <FolderArchive :size="14" />
            草稿箱（{{ drafts.length }}）
          </button>
        </div>
        <div class="grow" />
        <div class="bar-group bar-group-main">
          <button class="tw-btn tw-btn-primary gen-btn btn-strong" type="button" :disabled="aiFilling" @click="aiFill">
            <Sparkles v-if="!aiFilling" :size="14" />
            <span v-if="aiFilling" class="btn-spinner" />
            {{ aiFilling ? '生成中...' : '一键生成' }}
          </button>
          <button class="tw-btn tw-btn-ghost btn-lite" type="button" @click="saveDraft">
            <Save :size="14" />
            保存草稿
          </button>
          <button class="tw-btn tw-btn-primary btn-strong" type="button" @click="saveResume">
            <Save :size="14" />
            保存简历
          </button>
          <div class="export-wrap">
            <button class="tw-btn tw-btn-ghost btn-lite" type="button" @click="exportOpen = !exportOpen">
              <Download :size="14" />
              导出
            </button>
            <div v-if="exportOpen" class="export-menu tw-card">
              <button type="button" @click="exportPdf"><FileText :size="14" /> 导出PDF</button>
              <button type="button" @click="exportWord"><File :size="14" /> 导出Word</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="draftOpen" class="drafts tw-card">
        <div v-if="!drafts.length" class="muted">暂无草稿</div>
        <div v-for="d in drafts" :key="d.id" class="ditem">
          <button type="button" class="dopen" @click="openDraft(d)">
            <b>{{ d.title }}</b>
            <span>{{ new Date(d.updatedAt).toLocaleString() }}</span>
          </button>
          <button type="button" class="ddel" @click="removeDraft(d.id)">删除</button>
        </div>
      </div>

      <label class="lbl">模板</label>
      <div class="tpl">
        <button type="button" :class="{ on: tpl === 'simple' }" @click="tpl = 'simple'; stylePreset = 'minimal-clean'">简约版</button>
        <button type="button" :class="{ on: tpl === 'business' }" @click="tpl = 'business'; stylePreset = 'business-pro'">商务版</button>
      </div>
      <div class="tip">支持从 WPS 模板库导入并即时预览。</div>

      <label class="lbl">图片素材（证件照）</label>
      <div class="img-tools">
        <label class="tw-btn tw-btn-ghost">
          {{ avatarUploading ? '证件照上传中...' : '上传证件照' }}
          <input type="file" accept="image/*" hidden :disabled="avatarUploading" @change="onPickAvatar" />
        </label>
      </div>
      <div v-if="form.avatar_url" class="img-list">
        <div v-if="form.avatar_url" class="img-item">
          <img :src="form.avatar_url" alt="头像" />
          <button type="button" class="img-del" @click="form.avatar_url = ''">删除</button>
        </div>
      </div>

      <label class="lbl">基本信息</label>
      <div class="grid2">
        <input v-model="form.name" class="tw-input" placeholder="姓名" />
        <input v-model="form.school" class="tw-input" placeholder="院校" />
        <input v-model="form.major" class="tw-input" placeholder="专业" />
        <input v-model="form.role" class="tw-input" placeholder="意向岗位" />
      </div>

      <label class="lbl">教育经历</label>
      <div v-for="(e, i) in form.edu" :key="i" class="blk">
        <input v-model="e.time" class="tw-input" placeholder="时间" />
        <input v-model="e.school" class="tw-input" placeholder="学校" />
        <textarea v-model="e.detail" class="tw-input" rows="3" placeholder="亮点/课程/成绩" />
      </div>

      <label class="lbl">实习/项目</label>
      <div v-for="(e, i) in form.exp" :key="i" class="blk">
        <input v-model="e.time" class="tw-input" placeholder="时间" />
        <input v-model="e.org" class="tw-input" placeholder="公司/项目" />
        <textarea v-model="e.detail" class="tw-input" rows="3" placeholder="你做了什么，结果如何" />
      </div>

      <label class="lbl">技能</label>
      <textarea v-model="form.skills" class="tw-input" rows="3" placeholder="技能栈、工具、证书" />

      <label class="lbl">自我评价</label>
      <textarea v-model="form.about" class="tw-input" rows="4" placeholder="用温柔的语气写出你的热情与边界" />

      <button class="tw-btn tw-btn-ghost full" type="button" @click="goInterview">使用此简历开始模拟面试</button>
    </div>

    <div class="preview tw-card" :class="[tpl, stylePreset]">
      <div id="resume-preview" class="paper">
        <div class="hero">
          <div class="hero-main">
            <div class="name">{{ form.name || '你的名字' }}</div>
            <div class="sub">{{ form.role || '意向岗位' }} · {{ form.school || '院校' }} · {{ form.major || '专业' }}</div>
          </div>
          <div class="hero-photo">
            <img v-if="form.avatar_url" :src="form.avatar_url" alt="证件照" class="avatar" />
            <div v-else class="avatar ph">{{ (form.name || '简').slice(0, 1) }}</div>
          </div>
        </div>
        <div v-if="tpl === 'business'" class="biz-top">
          <div class="biz-title">{{ form.name || '你的名字' }}</div>
          <div class="biz-sub">{{ form.role || '意向岗位' }}</div>
        </div>

        <div class="sec">教育背景</div>
        <div v-for="(e, i) in form.edu" :key="i" class="item">
          <b>{{ e.school }}</b> <span class="muted">{{ e.time }}</span>
          <div class="small">{{ e.detail }}</div>
        </div>

        <div class="sec">经历</div>
        <div v-for="(e, i) in form.exp" :key="i" class="item">
          <b>{{ e.org }}</b> <span class="muted">{{ e.time }}</span>
          <div class="small">{{ e.detail }}</div>
        </div>

        <div class="sec">技能</div>
        <div class="small">{{ form.skills }}</div>

        <div class="sec">自我评价</div>
        <div class="small">{{ form.about }}</div>
      </div>
      <div v-if="aiFilling" class="gen-mask">
        <div class="loader" />
        <div class="gen-t">简历正在生成中...</div>
      </div>
    </div>
  </div>
  <div v-if="templateModalOpen" class="modal-mask" @click.self="closeTemplateModal">
    <div class="modal tw-card">
      <div class="modal-head">
        <b>WPS 简历模板库</b>
        <button type="button" class="icon-x" @click="closeTemplateModal">关闭</button>
      </div>
      <input v-model="templateKeyword" class="tw-input" placeholder="搜索模板（如：商务、校招、ATS）" />
      <div class="modal-list">
        <button v-for="t in filteredTemplates" :key="t.id" type="button" class="tpl-item" @click="applyLibraryTemplate(t)">
          <b>{{ t.name }}</b>
          <span>{{ t.desc }}</span>
          <small>{{ t.tpl === 'business' ? '商务版' : '简约版' }}</small>
        </button>
      </div>
      <div v-if="!filteredTemplates.length" class="muted">没有匹配的模板</div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 12px;
  align-items: start;
}
@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.form {
  padding: 20px;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
}
.bar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 10px;
  border: 1px solid var(--border-secondary);
  border-radius: 14px;
  background: var(--bg-soft);
}
.bar-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.btn-lite,
.btn-strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-lite {
  border-color: rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.86);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.btn-lite:hover {
  transform: translateY(-1px);
  border-color: rgba(26, 86, 219, 0.35);
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.08);
}
.btn-strong {
  box-shadow: 0 4px 12px rgba(26, 86, 219, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.btn-strong:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(26, 86, 219, 0.28);
}
.bar-group-main :deep(.tw-btn-primary) {
  box-shadow: 0 4px 12px rgba(26, 86, 219, 0.18);
}
.drafts {
  margin-bottom: 16px;
  border: 1px solid var(--border-secondary);
  background: var(--bg-soft);
  border-radius: 12px;
  padding: 12px;
}
.ditem {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 6px 0;
}
.dopen {
  border: none;
  background: rgba(26, 86, 219, 0.07);
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  padding: 8px 10px;
  display: grid;
  gap: 3px;
}
.dopen span {
  font-size: 12px;
  color: var(--tw-muted);
}
.ddel {
  border: none;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  padding: 0 10px;
  cursor: pointer;
}
.grow {
  flex: 1;
}
.export-wrap {
  position: relative;
}
.export-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 140px;
  z-index: 40;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  display: grid;
  gap: 3px;
}
.export-menu button {
  border: none;
  background: transparent;
  text-align: left;
  border-radius: 8px;
  padding: 7px 9px;
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.export-menu button:hover {
  background: rgba(26, 86, 219, 0.08);
}
.gen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
.lbl {
  display: block;
  margin: 10px 0 8px;
  font-size: 12px;
  font-weight: 900;
  color: var(--tw-muted);
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.blk {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
}
.tpl {
  display: flex;
  gap: 8px;
}
.tpl button {
  border-radius: 999px;
  border: 1px solid rgba(26, 86, 219, 0.12);
  padding: 8px 12px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.55);
  font-weight: 900;
}
.tpl button.on {
  border-color: rgba(26, 86, 219, 0.35);
  background: rgba(26, 86, 219, 0.1);
}
.tip {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}
.img-tools {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.img-list {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.img-item {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.img-item img {
  width: 100%;
  height: 88px;
  object-fit: cover;
  display: block;
}
.img-del {
  width: 100%;
  border: none;
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
  font-size: 12px;
  padding: 6px 0;
  cursor: pointer;
}
.tpl-item {
  border: 1px solid rgba(30, 58, 138, 0.18);
  border-radius: 10px;
  background: #fff;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 2px;
}
.tpl-item:hover {
  border-color: rgba(29, 78, 216, 0.45);
  background: rgba(239, 246, 255, 0.8);
}
.tpl-item span {
  font-size: 12px;
  color: #64748b;
}
.tpl-item small {
  font-size: 11px;
  color: #1e3a8a;
}
.preview {
  padding: 16px;
  position: sticky;
  top: 76px;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  overflow: hidden;
}
.paper {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  min-height: 520px;
  border: 1px solid rgba(15, 23, 42, 0.08);
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
.simple .paper {
  background: #fff;
  color: #0f172a;
}
.minimal-clean .paper {
  background: #fff;
  box-shadow: none;
}
.simple .sec {
  border-bottom: 1px solid rgba(15, 23, 42, 0.14);
}
.simple .item {
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  padding-bottom: 8px;
}
.minimal-sidebar .paper {
  background:
    linear-gradient(to right, #f1f5f9 0, #f1f5f9 28%, #fff 28%, #fff 100%);
}
.minimal-sidebar .name,
.minimal-sidebar .sub,
.minimal-sidebar .sec,
.minimal-sidebar .item,
.minimal-sidebar .small {
  margin-left: 30%;
}
.minimal-sidebar .sec {
  border-bottom: 1px solid rgba(15, 23, 42, 0.2);
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
  background: linear-gradient(135deg, #1e3a8a, #1d4ed8);
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
.business .sec {
  border-bottom: 1px solid rgba(30, 58, 138, 0.18);
  color: #1e3a8a;
}
.business-pro .biz-top {
  background: linear-gradient(135deg, #0f2c73, #1d4ed8);
}
.business-modern .paper {
  background:
    linear-gradient(rgba(71, 85, 105, 0.08) 1px, transparent 1px) 0 0 / 100% 22px,
    #f1f5f9;
}
.business-modern .biz-top {
  background: linear-gradient(135deg, #1e293b, #334155);
}
.business-modern .sec {
  color: #0f172a;
  border-bottom-color: rgba(15, 23, 42, 0.24);
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
.sec {
  margin-top: 14px;
  font-weight: 900;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding-bottom: 6px;
}
.item {
  margin-top: 10px;
}
.small {
  margin-top: 6px;
  color: #334155;
  line-height: 1.55;
  white-space: pre-wrap;
}
.muted {
  color: #94a3b8;
  font-weight: 600;
}
.full {
  width: 100%;
  margin-top: 10px;
}
.gen-mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  gap: 10px;
  z-index: 30;
}
.loader {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid rgba(26, 86, 219, 0.2);
  border-top-color: #1a56db;
  animation: spin 0.8s linear infinite;
}
.gen-t {
  color: #1e3a8a;
  font-size: 14px;
  font-weight: 800;
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(15, 23, 42, 0.35);
  display: grid;
  place-items: center;
  padding: 16px;
}
.modal {
  width: min(760px, 100%);
  max-height: 82vh;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.55);
  padding: 12px;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.icon-x {
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 8px;
  background: #fff;
  padding: 5px 8px;
  cursor: pointer;
}
.modal-list {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 900px) {
  .img-list,
  .modal-list {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 680px) {
  .img-list,
  .modal-list {
    grid-template-columns: 1fr;
  }
}
</style>
