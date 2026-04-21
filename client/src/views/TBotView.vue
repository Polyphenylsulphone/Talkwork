<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Copy, MoreHorizontal, Paperclip, Pencil, Pin, Share2, Star, Trash2, X } from 'lucide-vue-next';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { http, unwrap } from '../api/http';
import { toast } from '../stores/toast';
import { useUiStore } from '../stores/ui';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const route = useRoute();
const router = useRouter();
const ui = useUiStore();
const sessions = ref([]);
const currentId = ref('');
const messages = ref([]);
const input = ref('');
const streaming = ref(false);
const box = ref(null);
const confirmDeleteId = ref('');
const favoriteSet = ref(new Set());
const favorites = ref([]);
const sessionMenuId = ref('');
const renamingId = ref('');
const renamingTitle = ref('');
const mobileActionsForId = ref(0);
const uploading = ref(false);
const attachments = ref([]);
const fileInput = ref(null);
const focusMsgId = ref(0);
let longPressTimer = null;

onMounted(async () => {
  await refreshSessions();
  await refreshFavorites();
  if (typeof route.query.sid === 'string' && route.query.sid) {
    await openSession(route.query.sid);
  }
  document.addEventListener('click', onDocClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
});

async function refreshSessions() {
  sessions.value = unwrap(await http.get('/chat/sessions'));
}
function onDocClick(e) {
  if (!e.target.closest('.sess-menu-wrap')) sessionMenuId.value = '';
}

async function refreshFavorites() {
  const rows = unwrap(await http.get('/chat/favorites'));
  favorites.value = rows || [];
  favoriteSet.value = new Set((rows || []).map((x) => x.id));
}

async function newSession() {
  const { id } = unwrap(await http.post('/chat/sessions'));
  currentId.value = id;
  messages.value = [];
  ui.applyTbotMood('calm');
  mobileActionsForId.value = 0;
  await refreshFavorites();
  await refreshSessions();
}

async function openSession(id) {
  currentId.value = id;
  const rows = unwrap(await http.get(`/chat/sessions/${id}/messages`));
  messages.value = rows;
  const latestText = [...(rows || [])].reverse().find((m) => String(m?.content || '').trim())?.content || '';
  ui.updateTbotMoodByText(latestText);
  mobileActionsForId.value = 0;
  await refreshFavorites();
  if (route.query.sid !== id) {
    router.replace({ name: 'tbot', query: { sid: id } });
  }
}

async function openFavorite(item) {
  await openSession(item.session_id);
  await nextTick();
  const el = document.querySelector(`[data-mid="${item.id}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  focusMsgId.value = item.id;
  window.setTimeout(() => {
    if (focusMsgId.value === item.id) focusMsgId.value = 0;
  }, 1600);
}

async function send() {
  if (!currentId.value) await newSession();
  const text = input.value.trim();
  if ((!text && !attachments.value.length) || streaming.value || uploading.value) return;
  const payloadAttachments = attachments.value.map((a) => ({
    type: a.type,
    name: a.name,
    data_base64: a.data_base64 || '',
    text: a.text || '',
  }));
  input.value = '';
  attachments.value = [];
  streaming.value = true;

  const previewText = text || '[附件提问]';
  ui.updateTbotMoodByText(previewText);
  messages.value = messages.value.concat([{ role: 'user', content: previewText }]);
  const assistant = { role: 'assistant', content: '' };
  messages.value = messages.value.concat([assistant]);
  await scroll();

  const token = localStorage.getItem('tw_token');
  const res = await fetch('/api/v1/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ session_id: currentId.value, content: previewText, attachments: payloadAttachments }),
  });

  if (!res.ok || !res.body) {
    streaming.value = false;
    const rows = unwrap(
      await http.post(`/chat/sessions/${currentId.value}/messages`, { content: previewText, attachments: payloadAttachments })
    );
    messages.value = rows;
    await refreshSessions();
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      const line = block.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = JSON.parse(line.slice(5).trim());
      if (payload.delta) {
        assistant.content += payload.delta;
        await scroll();
      }
      if (payload.done && payload.messages) {
        messages.value = payload.messages;
        await refreshFavorites();
      }
    }
  }
  streaming.value = false;
  await refreshSessions();
}

async function scroll() {
  await nextTick();
  const el = box.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function delSession(id) {
  await http.delete(`/chat/sessions/${id}`);
  if (currentId.value === id) {
    currentId.value = '';
    messages.value = [];
  }
  confirmDeleteId.value = '';
  sessionMenuId.value = '';
  await refreshSessions();
}

function openSessionMenu(id, e) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  sessionMenuId.value = sessionMenuId.value === id ? '' : id;
}

function startRename(s) {
  sessionMenuId.value = '';
  renamingId.value = s.id;
  renamingTitle.value = s.title;
}

async function saveRename(s) {
  const title = renamingTitle.value.trim().slice(0, 80);
  renamingId.value = '';
  if (!title || title === s.title) return;
  await http.patch(`/chat/sessions/${s.id}`, { title });
  await refreshSessions();
}

function cancelRename() {
  renamingId.value = '';
  renamingTitle.value = '';
}

async function togglePinned(s) {
  sessionMenuId.value = '';
  await http.patch(`/chat/sessions/${s.id}`, { is_pinned: !s.is_pinned });
  await refreshSessions();
}

async function shareSessionLink(s) {
  sessionMenuId.value = '';
  const url = `${window.location.origin}/tbot?sid=${s.id}`;
  await navigator.clipboard.writeText(url);
  toast.success('链接已复制');
}

async function shareToPostDraft(s) {
  sessionMenuId.value = '';
  const rows = unwrap(await http.get(`/chat/sessions/${s.id}/messages`));
  const txt = (rows || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? '我' : 'T宝'}：${m.content}`)
    .join('\n\n')
    .slice(0, 12000);
  const id = `d_${Date.now()}`;
  const item = {
    id,
    title: `T宝对话整理：${s.title}`.slice(0, 50),
    content: `<p>${txt
      .split(/\n+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .join('</p><p>')}</p>`,
    updatedAt: Date.now(),
  };
  const listKey = 'tw_draft_list_article';
  const key = 'tw_draft_article';
  const prev = JSON.parse(localStorage.getItem(listKey) || '[]');
  const next = [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 10);
  localStorage.setItem(listKey, JSON.stringify(next));
  localStorage.setItem(key, JSON.stringify(item));
  router.push({ name: 'post-create' });
}

function isFavorited(msg) {
  return !!msg?.id && favoriteSet.value.has(msg.id);
}

async function toggleFavorite(msg) {
  if (!msg?.id || msg.role !== 'assistant') return;
  const r = unwrap(await http.post(`/chat/messages/${msg.id}/favorite`));
  const next = new Set(favoriteSet.value);
  if (r?.favorited) next.add(msg.id);
  else next.delete(msg.id);
  favoriteSet.value = next;
  await refreshFavorites();
}

async function copyMessage(msg) {
  const text = String(msg?.content || '').trim();
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

async function shareMessage(msg) {
  const text = String(msg?.content || '').trim();
  if (!text) return;
  if (navigator.share) {
    await navigator.share({ title: 'T宝回复', text });
    return;
  }
  await copyMessage(msg);
}

function onTouchStart(msg) {
  if (!msg?.id || msg.role !== 'assistant') return;
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    mobileActionsForId.value = msg.id;
  }, 420);
}

function onTouchEnd() {
  clearTimeout(longPressTimer);
}

function hideMobileActions() {
  mobileActionsForId.value = 0;
}

function openAttachmentPicker() {
  fileInput.value?.click();
}

async function onPickFiles(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (!files.length) return;
  if (attachments.value.length + files.length > 3) return toast.error('最多上传 3 个附件');
  uploading.value = true;
  try {
    const next = [];
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        const data_base64 = await fileToDataUrl(f);
        next.push({
          id: `${Date.now()}_${Math.random()}`,
          type: 'image',
          name: f.name,
          data_base64,
          text: '',
        });
        continue;
      }
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const text = await pdfToText(f);
        next.push({
          id: `${Date.now()}_${Math.random()}`,
          type: 'pdf',
          name: f.name,
          data_base64: '',
          text,
        });
      } else {
        toast.error(`不支持的附件类型：${f.name}`);
      }
    }
    attachments.value = attachments.value.concat(next).slice(0, 3);
  } catch {
    toast.error('附件处理失败，请重试');
  } finally {
    uploading.value = false;
  }
}

function removeAttachment(id) {
  attachments.value = attachments.value.filter((a) => a.id !== id);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function pdfToText(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const chunks = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => it.str || '').join(' ');
    if (line.trim()) chunks.push(line.trim());
    if (chunks.join('\n').length > 12000) break;
  }
  return chunks.join('\n').slice(0, 12000);
}
</script>

<template>
  <div class="layout">
    <aside class="side tw-card">
      <button class="tw-btn tw-btn-primary full" type="button" @click="newSession">新对话</button>
      <div class="h">历史</div>
      <div
        v-for="s in sessions"
        :key="s.id"
        class="sitem"
        @click="openSession(s.id)"
        @contextmenu="openSessionMenu(s.id, $event)"
      >
        <div class="sleft">
          <Pin v-if="s.is_pinned" :size="12" class="pin-ico" />
          <template v-if="renamingId === s.id">
            <input
              v-model="renamingTitle"
              class="rename-input"
              maxlength="80"
              @click.stop
              @keydown.enter.prevent="saveRename(s)"
              @keydown.esc.prevent="cancelRename"
              @blur="saveRename(s)"
            />
          </template>
          <span v-else class="t">{{ s.title }}</span>
        </div>
        <div class="sess-menu-wrap" @click.stop>
          <template v-if="confirmDeleteId === s.id">
            <span class="confirm-row">
              <button type="button" class="mini" @click.stop="confirmDeleteId = ''">取消</button>
              <button type="button" class="mini danger" @click.stop="delSession(s.id)">删除</button>
            </span>
          </template>
          <template v-else>
            <button class="icon-mini" type="button" @click.stop="openSessionMenu(s.id, $event)">
              <MoreHorizontal :size="14" />
            </button>
            <div v-if="sessionMenuId === s.id" class="sess-menu tw-card">
              <button type="button" @click="startRename(s)"><Pencil :size="12" />重命名</button>
              <button type="button" @click="togglePinned(s)"><Pin :size="12" />{{ s.is_pinned ? '取消置顶' : '置顶' }}</button>
              <button type="button" @click="shareToPostDraft(s)"><Share2 :size="12" />生成帖子草稿</button>
              <button type="button" @click="shareSessionLink(s)"><Share2 :size="12" />复制分享链接</button>
              <button type="button" class="danger" @click="confirmDeleteId = s.id"><Trash2 :size="12" />删除</button>
            </div>
          </template>
        </div>
      </div>

      <div class="h">收藏（消息）</div>
      <button v-for="f in favorites" :key="f.id" type="button" class="fav-item" @click="openFavorite(f)">
        <span class="fav-title">{{ f.title || '未命名会话' }}</span>
        <span class="fav-snippet">{{ f.content }}</span>
      </button>
      <div v-if="!favorites.length" class="muted sm">暂无收藏消息</div>
    </aside>

    <section class="main tw-card">
      <div ref="box" class="msgs" @touchstart="hideMobileActions">
        <div v-if="!messages.length" class="muted center">你好呀，我是 T 宝。今天想聊简历、面试，还是心态？</div>
        <div
          v-for="(m, i) in messages"
          :key="m.id || i"
          class="msg"
          :class="[m.role, { 'tools-force-show': mobileActionsForId === m.id, 'is-focus': focusMsgId === m.id }]"
          :data-mid="m.id || ''"
          @touchstart.stop="onTouchStart(m)"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        >
          <div class="bubble-wrap">
            <div v-if="m.role === 'assistant' && m.id" class="msg-tools" @touchstart.stop @click.stop>
              <button type="button" class="tool-btn" :class="{ on: isFavorited(m) }" title="收藏" @click="toggleFavorite(m)">
                <Star :size="14" />
              </button>
              <button type="button" class="tool-btn" title="复制" @click="copyMessage(m)">
                <Copy :size="14" />
              </button>
              <button type="button" class="tool-btn" title="分享" @click="shareMessage(m)">
                <Share2 :size="14" />
              </button>
            </div>
            <div class="bubble">{{ m.content }}<span v-if="streaming && m.role === 'assistant' && i === messages.length - 1" class="dot">▍</span></div>
          </div>
        </div>
      </div>

      <div class="composer">
        <div class="input-wrap">
          <button class="plus-btn" type="button" :disabled="uploading || streaming" title="上传图片/PDF" @click="openAttachmentPicker">
            <Paperclip :size="14" />
          </button>
          <input ref="fileInput" type="file" hidden accept="image/*,.pdf,application/pdf" multiple @change="onPickFiles" />
          <textarea
            v-model="input"
            class="tw-input"
            rows="3"
            placeholder="可附带图片/PDF提问；Enter发送 · Shift+Enter换行"
            @keydown.enter.exact.prevent="send"
          />
        </div>
        <div v-if="attachments.length" class="atts">
          <div v-for="a in attachments" :key="a.id" class="att">
            <span>{{ a.type === 'image' ? '图片' : 'PDF' }} · {{ a.name }}</span>
            <button type="button" @click="removeAttachment(a.id)"><X :size="12" /></button>
          </div>
        </div>
        <div class="row">
          <button class="tw-btn tw-btn-ghost" type="button" @click="input = ''">清空</button>
          <div class="grow" />
          <button class="tw-btn tw-btn-primary" type="button" :disabled="streaming || uploading" @click="send">
            {{ uploading ? '处理中附件…' : streaming ? '处理中…' : '发送' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.side {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  position: sticky;
  top: 76px;
}
.full {
  width: 100%;
  margin-bottom: 10px;
}
.h {
  font-weight: 900;
  margin: 10px 0 8px;
}
.sitem {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  margin-bottom: 8px;
}
.sleft {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pin-ico {
  color: #ca8a04;
  flex: 0 0 auto;
}
.t {
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rename-input {
  width: 130px;
  max-width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 8px;
  padding: 2px 6px;
  font-size: 12px;
}
.icon-mini {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
}
.sess-menu-wrap {
  position: relative;
}
.sess-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  min-width: 138px;
  z-index: 30;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  display: grid;
  gap: 2px;
}
.sess-menu button {
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  padding: 6px 8px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.sess-menu button:hover {
  background: rgba(26, 86, 219, 0.08);
}
.sess-menu .danger {
  color: #b91c1c;
}
.confirm-row {
  display: inline-flex;
  gap: 4px;
}
.mini {
  border: none;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 12px;
}
.mini.danger {
  color: #b91c1c;
}
.main {
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 120px);
}
.msgs {
  padding: 14px;
  flex: 1;
  overflow: auto;
}
.msg {
  display: flex;
  margin-bottom: 10px;
}
.msg.user {
  justify-content: flex-end;
}
.msg.is-focus .bubble {
  box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.25);
}
.bubble-wrap {
  position: relative;
}
.bubble {
  max-width: min(720px, 92%);
  padding: 10px 12px;
  border-radius: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.75);
}
.msg.user .bubble {
  background: rgba(26, 86, 219, 0.12);
  border-color: rgba(26, 86, 219, 0.18);
}
.msg-tools {
  position: absolute;
  right: 8px;
  top: -12px;
  display: inline-flex;
  gap: 6px;
  opacity: 0;
  transform: translateY(3px);
  pointer-events: none;
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.msg.assistant:hover .msg-tools,
.msg.tools-force-show .msg-tools {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.tool-btn {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: #fff;
  color: #475569;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
}
.tool-btn.on {
  color: #ca8a04;
  background: #fef3c7;
  border-color: rgba(202, 138, 4, 0.28);
}
.dot {
  animation: blink 1s infinite;
}
@keyframes blink {
  50% {
    opacity: 0.2;
  }
}
.composer {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 10px;
  background: rgba(255, 255, 255, 0.55);
}
.input-wrap {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: start;
}
.plus-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(26, 86, 219, 0.22);
  background: rgba(26, 86, 219, 0.09);
  color: #1a56db;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}
.plus-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.atts {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.att {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(26, 86, 219, 0.09);
  color: #1e40af;
  font-size: 12px;
}
.att button {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
}
.row {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.grow {
  flex: 1;
}
.center {
  text-align: center;
  padding: 40px 10px;
}
.sm {
  font-size: 12px;
}
.fav-item {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.62);
  border-radius: 10px;
  margin-top: 6px;
  padding: 7px 8px;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 2px;
}
.fav-title {
  font-size: 12px;
  font-weight: 800;
  color: #334155;
}
.fav-snippet {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .msg-tools {
    top: -10px;
    right: 6px;
  }
}
</style>
