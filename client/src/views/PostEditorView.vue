<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { QuillEditor } from '@vueup/vue-quill';
import { Mic, Square } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const title = ref('');
const college = ref('engineering');
const editor = ref(null);
const content = ref('<p></p>');
const draftOpen = ref(false);
const drafts = ref([]);
const currentDraftId = ref('');
const aiLoading = ref('');
const listening = ref(false);
const speechSupported = ref(false);
const speechTranscript = ref('');
const speechInterim = ref('');
const speechBusy = ref(false);
/** 匿名发帖：对外展示为「匿名用户」与默认头像，不显示真实用户名与头像 */
const anonymousPost = ref(false);

const postType = computed(() => (route.query.type === 'question' ? 'question' : 'article'));
const draftKey = computed(() => `tw_draft_${postType.value}`);
const draftListKey = computed(() => `tw_draft_list_${postType.value}`);
const shareDraftKey = 'tw_share_post_draft';

let timer = null;
let recognition = null;
let recognizedFinal = '';

onMounted(() => {
  try {
    const shared = sessionStorage.getItem(shareDraftKey);
    if (shared) {
      const d = JSON.parse(shared);
      title.value = d.title || '';
      content.value = d.content || '<p></p>';
      college.value = d.college || 'engineering';
      currentDraftId.value = '';
      sessionStorage.removeItem(shareDraftKey);
      return;
    }
    const raw = localStorage.getItem(draftKey.value);
    const arr = localStorage.getItem(draftListKey.value);
    drafts.value = arr ? JSON.parse(arr) : [];
    if (raw) {
      const d = JSON.parse(raw);
      title.value = d.title || '';
      content.value = d.content || '<p></p>';
      currentDraftId.value = d.id || '';
    }
  } catch {
    /* */
  }
  timer = window.setInterval(saveDraft, 30_000);
  speechSupported.value = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (recognition) {
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.stop();
    recognition = null;
  }
  saveDraft();
});

function saveDraft() {
  const id = currentDraftId.value || `d_${Date.now()}`;
  currentDraftId.value = id;
  const item = {
    id,
    title: title.value.trim() || '未命名草稿',
    content: content.value,
    updatedAt: Date.now(),
  };
  const next = [item, ...drafts.value.filter((d) => d.id !== id)].slice(0, 10);
  drafts.value = next;
  localStorage.setItem(draftListKey.value, JSON.stringify(next));
  localStorage.setItem(draftKey.value, JSON.stringify(item));
}

function openDraft(d) {
  currentDraftId.value = d.id;
  title.value = d.title === '未命名草稿' ? '' : d.title;
  content.value = d.content || '<p></p>';
  draftOpen.value = false;
}

function removeDraft(id) {
  const next = drafts.value.filter((d) => d.id !== id);
  drafts.value = next;
  localStorage.setItem(draftListKey.value, JSON.stringify(next));
  if (currentDraftId.value === id) {
    currentDraftId.value = '';
    title.value = '';
    content.value = '<p></p>';
    localStorage.removeItem(draftKey.value);
  }
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

const options = {
  theme: 'snow',
  modules: {
    toolbar: {
      container: [['bold', 'italic'], [{ header: 1 }, { header: 2 }], [{ list: 'ordered' }, { list: 'bullet' }], ['image']],
      handlers: {
        image: pickImage,
      },
    },
  },
  placeholder: '把你的故事写得更温柔一点…',
};

async function pickImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    let file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.info('图片较大，正在压缩...');
      file = await compressImage(file);
    }
    if (file.size > 5 * 1024 * 1024) return toast.error('单张图片不超过 5MB');
    const fd = new FormData();
    fd.append('file', file);
    const data = unwrap(await http.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
    const quill = editor.value?.getQuill?.();
    if (!quill) return;
    const range = quill.getSelection(true);
    const idx = range ? range.index : quill.getLength();
    quill.insertEmbed(idx, 'image', data.url, 'user');
    quill.setSelection(idx + 1);
  };
  input.click();
}

async function compressImage(file) {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const maxW = 1920;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > 1024 * 1024 && quality > 0.55) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }
  const ext = file.type.includes('png') ? 'png' : 'jpg';
  const outType = ext === 'png' ? 'image/png' : 'image/jpeg';
  return new File([blob], file.name.replace(/\.\w+$/, `.${ext}`), { type: outType });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality);
  });
}

async function publish() {
  const text = editor.value?.getQuill?.().getText() || '';
  if (!title.value.trim()) return toast.error('请填写标题');
  if (!text.trim()) return toast.error('请填写正文');
  const imgs = (content.value.match(/<img/g) || []).length;
  if (imgs > 9) return toast.error('图片最多 9 张');
  const data = unwrap(
    await http.post('/posts', {
      title: title.value.trim(),
      content: content.value,
      college: college.value,
      post_type: postType.value,
      is_anonymous: anonymousPost.value,
    })
  );
  localStorage.removeItem(draftKey.value);
  drafts.value = drafts.value.filter((d) => d.id !== currentDraftId.value);
  localStorage.setItem(draftListKey.value, JSON.stringify(drafts.value));
  currentDraftId.value = '';
  toast.success('发帖成功');
  if (postType.value === 'question') {
    router.push({ name: 'qa' });
  } else {
    router.push({ name: 'post', params: { id: data.id } });
  }
}

async function runAi(mode, sourceText = '') {
  if (aiLoading.value) return;
  const text = sourceText || editor.value?.getQuill?.().getText() || '';
  if (!text.trim()) return toast.error('请先输入正文');
  const modeMap = {
    format: '正在一键排版...',
    summary: '正在总结...',
    polish: '正在润色...',
    experience: '正在整理经验贴...',
  };
  aiLoading.value = mode;
  toast.info(modeMap[mode] || 'AI处理中...');
  try {
    const data = unwrap(
      await http.post('/posts/ai/rewrite', {
        mode,
        title: title.value.trim(),
        content: content.value,
      })
    );
    const nextText = String(data.content || '').trim();
    if (!nextText) return toast.error('AI未返回有效内容');
    const nextHtml = `<p>${nextText
      .split(/\n+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .join('</p><p>')}</p>`;
    if (mode === 'experience' && sourceText) {
      const existing = (editor.value?.getQuill?.().getText() || '').trim();
      content.value = existing ? `${content.value}<p><br></p>${nextHtml}` : nextHtml;
    } else {
      content.value = nextHtml;
    }
    saveDraft();
    toast.success('AI处理完成');
  } finally {
    aiLoading.value = '';
  }
}

function initRecognition() {
  if (recognition || !speechSupported.value) return recognition;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.lang = 'zh-CN';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const chunk = event.results[i]?.[0]?.transcript || '';
      if (event.results[i].isFinal) {
        recognizedFinal += chunk;
      } else {
        interim += chunk;
      }
    }
    speechInterim.value = interim.trim();
    speechTranscript.value = recognizedFinal.trim();
  };
  rec.onerror = () => {
    listening.value = false;
    speechBusy.value = false;
    toast.error('语音识别失败，请检查浏览器权限');
  };
  rec.onend = async () => {
    listening.value = false;
    if (speechBusy.value) return;
    const finalText = `${speechTranscript.value} ${speechInterim.value}`.trim();
    speechInterim.value = '';
    if (!finalText) return;
    speechBusy.value = true;
    try {
      await runAi('experience', finalText);
    } finally {
      speechBusy.value = false;
      speechTranscript.value = '';
      recognizedFinal = '';
    }
  };
  recognition = rec;
  return rec;
}

function startVoiceInput() {
  if (aiLoading.value || speechBusy.value) return;
  if (!speechSupported.value) return toast.error('当前浏览器不支持语音识别');
  const rec = initRecognition();
  if (!rec) return;
  recognizedFinal = '';
  speechTranscript.value = '';
  speechInterim.value = '';
  listening.value = true;
  rec.start();
  toast.info('开始录音，点击停止后会自动整理成经验贴');
}

function stopVoiceInput() {
  if (!recognition || !listening.value) return;
  listening.value = false;
  recognition.stop();
}

function cancel() {
  router.back();
}
</script>

<template>
  <div class="wrap">
    <div class="bar tw-card">
      <button class="tw-btn tw-btn-ghost" type="button" @click="cancel">取消</button>
      <button class="tw-btn tw-btn-ghost" type="button" @click="draftOpen = !draftOpen">草稿（{{ drafts.length }}）</button>
      <button class="tw-btn tw-btn-ghost" type="button" @click="saveDraft">保存草稿</button>
      <div class="ai-wrap">
        <button class="tw-btn tw-btn-ghost ai-btn" type="button" :disabled="!!aiLoading" @click="runAi('format')">
          ✦AI 一键排版
        </button>
        <button class="tw-btn tw-btn-ghost ai-btn" type="button" :disabled="!!aiLoading" @click="runAi('summary')">
          ✦AI 帮我总结
        </button>
        <button class="tw-btn tw-btn-ghost ai-btn" type="button" :disabled="!!aiLoading" @click="runAi('polish')">
          ✦AI 润色表达
        </button>
      </div>
      <div class="grow" />
      <button class="tw-btn tw-btn-primary" type="button" @click="publish">发布</button>
    </div>

    <div v-if="draftOpen" class="drafts tw-card">
      <div v-if="!drafts.length" class="empty">暂无草稿</div>
      <div v-for="d in drafts" :key="d.id" class="ditem">
        <button type="button" class="dopen" @click="openDraft(d)">
          <b>{{ d.title }}</b>
          <span>{{ fmtTime(d.updatedAt) }}</span>
        </button>
        <button type="button" class="ddel" @click="removeDraft(d.id)">删除</button>
      </div>
    </div>

    <div class="card tw-card">
      <div class="voice-hero">
        <button
          v-if="!listening"
          class="mic-hero-btn"
          type="button"
          :disabled="!speechSupported || !!aiLoading || speechBusy"
          :title="speechSupported ? '语音转文字并整理为经验贴' : '当前浏览器不支持语音识别'"
          @click="startVoiceInput"
        >
          <Mic :size="20" />
          <span>{{ speechSupported ? '语音输入，AI 自动整理' : '浏览器不支持语音' }}</span>
        </button>
        <button v-else class="mic-hero-btn stop" type="button" :disabled="speechBusy" title="停止录音并生成经验贴" @click="stopVoiceInput">
          <Square :size="18" />
          <span>停止录音并整理</span>
        </button>
        <div class="voice-hero-tip">
          {{
            listening
              ? `录音中... ${speechTranscript || speechInterim || '请开始说话'}`
              : speechBusy
                ? 'AI 正在整理为「背景-过程-经验」...'
                : speechSupported
                  ? '点击麦克风：录音 → 转文字 → AI 生成经验贴'
                  : '当前浏览器不支持 Web Speech API'
          }}
        </div>
      </div>

      <label class="lbl">标题（最多 50 字）</label>
      <input v-model="title" class="tw-input" maxlength="50" placeholder="起一个让人想点进来的标题" />

      <label class="lbl">学院分类</label>
      <select v-model="college" class="tw-input">
        <option value="engineering">工科</option>
        <option value="science">理科</option>
        <option value="liberal">文科</option>
        <option value="other">其他</option>
      </select>

      <label class="anon-row">
        <input v-model="anonymousPost" type="checkbox" />
        <span>匿名发布</span>
        <span class="anon-hint">选中后帖子里将显示默认头像与「匿名用户」，不展示你的账号与头像</span>
      </label>

      <label class="lbl">正文（支持加粗/斜体/标题/列表/图片）</label>
      <QuillEditor ref="editor" v-model:content="content" content-type="html" :options="options" class="quill" />

      <div class="tip">草稿每30秒自动保存到本地（最多10条） · 当前登录：{{ auth.user?.username }}</div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: grid;
  gap: 0;
  min-height: calc(100vh - 52px);
}
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  position: sticky;
  top: 52px;
  z-index: 20;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow: none;
  max-width: 1220px;
  width: calc(100% - 48px);
  margin: 0 auto;
}
.grow {
  flex: 1;
}
.ai-wrap {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ai-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.card {
  padding: 14px 20px 22px;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: rgba(255, 255, 255, 0.72);
  min-height: calc(100vh - 102px);
  max-width: 1220px;
  width: calc(100% - 48px);
  margin: 0 auto;
}
.lbl {
  display: block;
  margin: 10px 0 8px;
  font-size: 12px;
  color: var(--tw-muted);
  font-weight: 800;
}
.anon-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 10px;
  margin: 12px 0 4px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.anon-row input {
  margin-top: 3px;
  cursor: pointer;
}
.anon-hint {
  width: 100%;
  flex-basis: 100%;
  font-size: 12px;
  font-weight: 500;
  color: var(--tw-muted);
  line-height: 1.45;
}
.quill {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.75);
}
.tip {
  margin-top: 10px;
  color: var(--tw-muted);
  font-size: 12px;
}
.voice-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, rgba(26, 86, 219, 0.04) 0%, rgba(26, 86, 219, 0.08) 100%);
  border-radius: 16px;
  border: 1px dashed rgba(26, 86, 219, 0.25);
  gap: 12px;
}
.mic-hero-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border: none;
  border-radius: 999px;
  background: #1a56db;
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(26, 86, 219, 0.25);
}
.mic-hero-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(26, 86, 219, 0.35);
}
.mic-hero-btn.stop {
  background: #ef4444;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
}
.mic-hero-btn.stop:hover:not(:disabled) {
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.35);
}
.mic-hero-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
.voice-hero-tip {
  font-size: 13px;
  color: #475569;
  text-align: center;
  max-width: 90%;
  line-height: 1.5;
  min-height: 20px;
}
.drafts {
  border-radius: 0;
  border: none;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: none;
  padding: 10px 12px;
  max-width: 1220px;
  width: calc(100% - 48px);
  margin: 0 auto;
}
.ditem {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 8px 0;
}
.dopen {
  border: none;
  background: rgba(26, 86, 219, 0.06);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
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
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  border-radius: 10px;
  padding: 0 10px;
  cursor: pointer;
}
.empty {
  color: var(--tw-muted);
  font-size: 13px;
  padding: 8px 2px;
}
@media (max-width: 900px) {
  .bar,
  .drafts,
  .card {
    width: calc(100% - 20px);
  }
}
</style>
