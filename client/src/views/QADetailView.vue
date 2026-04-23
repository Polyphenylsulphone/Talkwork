<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import DOMPurify from 'dompurify';
import { Heart, MessageCircle, Star } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { collegeLabel, collegeColor } from '../constants';
import { ANONYMOUS_AVATAR } from '../constants/defaultAvatars';
import { formatCommentTime } from '../utils/time';

const route = useRoute();
const auth = useAuthStore();

const data = ref(null);
const answerText = ref('');
const showEditor = ref(false);
const sort = ref('new');
const replyForId = ref(null);
const replyText = ref('');
const menuForId = ref(null);
const delAnswerId = ref(null);
const editingId = ref(null);
const editDraft = ref('');

const safeQ = computed(() => DOMPurify.sanitize(data.value?.post?.content || ''));
const postAnonymous = computed(() => !!Number(data.value?.post?.is_anonymous));
const postAvatar = computed(() => data.value?.post?.avatar_url || ANONYMOUS_AVATAR);

const answers = computed(() => {
  const arr = [...(data.value?.answers || [])];
  if (sort.value === 'likes') {
    return arr.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
  }
  return arr;
});

onMounted(load);

async function load() {
  data.value = unwrap(await http.get(`/qa/${route.params.id}`));
  data.value.answers = (data.value.answers || []).map(normalizeAnswer);
}

function normalizeAnswer(a) {
  return {
    ...a,
    liked: !!a.liked,
    collected: !!a.collected,
    likes_count: Number(a.likes_count) || 0,
    collects_count: Number(a.collects_count) || 0,
    comments_count: Number(a.comments_count) || 0,
    reply_comments: a.reply_comments || [],
  };
}

async function submitAnswer() {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const text = answerText.value.trim();
  if (!text) return toast.error('回答不能为空');
  const rows = unwrap(await http.post(`/qa/${route.params.id}/answers`, { content: answerText.value }));
  data.value.answers = rows.map(normalizeAnswer);
  answerText.value = '';
  showEditor.value = false;
  toast.success('回答已发布');
}

function toggleReply(a) {
  menuForId.value = null;
  replyForId.value = replyForId.value === a.id ? null : a.id;
  replyText.value = '';
}

async function submitReply(a) {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  if (!replyText.value.trim()) return toast.error('评论不能为空');
  const rows = unwrap(await http.post(`/qa/answers/${a.id}/comments`, { content: replyText.value }));
  data.value.answers = rows.map(normalizeAnswer);
  replyText.value = '';
  replyForId.value = null;
  toast.success('已发布');
}

async function toggleAnswerLike(a) {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const r = unwrap(await http.post(`/qa/answers/${a.id}/like`));
  a.liked = !!r.liked;
  a.likes_count = r.likes_count;
}

async function toggleAnswerCollect(a) {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const r = unwrap(await http.post(`/qa/answers/${a.id}/collect`));
  a.collected = !!r.collected;
  a.collects_count = r.collects_count;
}

function openMenu(a) {
  menuForId.value = menuForId.value === a.id ? null : a.id;
}

function askDeleteAnswer(id) {
  menuForId.value = null;
  delAnswerId.value = id;
}

async function confirmDeleteAnswer() {
  if (!delAnswerId.value) return;
  const id = delAnswerId.value;
  delAnswerId.value = null;
  const rows = unwrap(await http.delete(`/qa/answers/${id}`));
  data.value.answers = rows.map(normalizeAnswer);
  toast.success('已删除');
}

function startEdit(a) {
  menuForId.value = null;
  editingId.value = a.id;
  const plain = String(a.content || '').replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();
  editDraft.value = plain;
}

function cancelEdit() {
  editingId.value = null;
  editDraft.value = '';
}

async function saveEdit() {
  if (!editingId.value) return;
  const id = editingId.value;
  const wrapped = `<p>${editDraft.value.trim().split(/\n+/).map((x) => x.trim()).filter(Boolean).join('</p><p>')}</p>`;
  const rows = unwrap(await http.patch(`/qa/answers/${id}`, { content: wrapped }));
  data.value.answers = rows.map(normalizeAnswer);
  editingId.value = null;
  editDraft.value = '';
  toast.success('已保存');
}

function canManage(a) {
  return !a.is_ai && auth.user?.id === a.user_id;
}
</script>

<template>
  <div v-if="data" class="layout">
    <div class="main">
      <article class="tw-card q">
        <div class="top">
          <h1>{{ data.post.title }}</h1>
          <div class="meta">
            <span class="tag" :style="{ color: collegeColor(data.post.college), borderColor: collegeColor(data.post.college) }">{{
              collegeLabel(data.post.college)
            }}</span>
            <span class="muted">浏览 {{ data.post.views }}</span>
          </div>
          <div class="q-author">
            <div class="q-avatar" :class="{ 'q-avatar-anon': postAnonymous }">
<<<<<<< HEAD
              <img v-if="postAnonymous" class="q-avatar-img" :src="postAvatar" alt="" />
=======
              <img v-if="data.post.avatar_url" class="q-avatar-img" :src="data.post.avatar_url" alt="" />
>>>>>>> d6473da (前端样式改动，加入默认头像)
              <template v-else>{{ data.post.username?.slice(0, 1) }}</template>
            </div>
            <span class="muted q-author-name">{{ data.post.username }}</span>
          </div>
        </div>
        <div class="html ql-snow" v-html="safeQ" />

        <div class="row">
          <button class="tw-btn tw-btn-primary" type="button" @click="showEditor = !showEditor">写回答</button>
          <div class="grow" />
          <label class="muted sm">排序</label>
          <select v-model="sort" class="tw-input sm">
            <option value="new">最新</option>
            <option value="likes">最多点赞</option>
          </select>
        </div>

        <div v-if="showEditor" class="editor tw-card">
          <textarea v-model="answerText" class="tw-input" rows="8" placeholder="写下你的回答（支持换行；服务器会自动清理不安全标签）" />
          <button class="tw-btn tw-btn-primary" type="button" @click="submitAnswer">提交回答</button>
        </div>
      </article>

      <section class="tw-card ans">
        <h3>回答 {{ answers.length }}</h3>
        <div v-for="a in answers" :key="a.id" class="a tw-card">
          <div class="head">
            <div class="who">
              <div class="avatar">{{ a.is_ai ? 'T' : a.username?.slice(0, 1) }}</div>
              <div class="who-text">
                <b>{{ a.is_ai ? 'T宝' : a.username }}</b>
                <div class="muted sm">{{ formatCommentTime(a.created_at) }}</div>
              </div>
            </div>
            <div v-if="canManage(a)" class="more-wrap">
              <button type="button" class="more-btn" @click="openMenu(a)">···</button>
              <div v-if="menuForId === a.id" class="more-menu tw-card">
                <button type="button" @click="startEdit(a)">编辑</button>
                <button type="button" class="danger" @click="askDeleteAnswer(a.id)">删除</button>
              </div>
            </div>
          </div>

          <template v-if="editingId === a.id">
            <textarea v-model="editDraft" class="tw-input" rows="6" />
            <div class="edit-actions">
              <button type="button" class="tw-btn tw-btn-ghost" @click="cancelEdit">取消</button>
              <button type="button" class="tw-btn tw-btn-primary" @click="saveEdit">保存</button>
            </div>
          </template>
          <template v-else>
            <div class="html ql-snow" v-html="DOMPurify.sanitize(a.content)" />
          </template>

          <div v-if="a.is_ai" class="badge">由T宝AI生成</div>

          <div class="ans-actions">
            <button type="button" class="act" :disabled="!auth.isLoggedIn" @click="toggleAnswerLike(a)">
              <Heart :size="16" :fill="a.liked ? 'currentColor' : 'none'" /> {{ a.likes_count }}
            </button>
            <button type="button" class="act" :disabled="!auth.isLoggedIn" @click="toggleAnswerCollect(a)">
              <Star :size="16" :fill="a.collected ? 'currentColor' : 'none'" /> 收藏 {{ a.collects_count }}
            </button>
            <button type="button" class="act" :disabled="!auth.isLoggedIn" @click="toggleReply(a)">
              <MessageCircle :size="16" /> 评论 {{ a.comments_count }}
            </button>
          </div>

          <div v-if="a.reply_comments?.length" class="replies">
            <div v-for="r in a.reply_comments" :key="r.id" class="rep">
              <b>{{ r.username }}</b>
              <span class="muted sm rep-time">{{ formatCommentTime(r.created_at) }}</span>
              <div class="rep-txt">{{ r.content }}</div>
            </div>
          </div>

          <div v-if="replyForId === a.id" class="reply-box tw-card">
            <textarea v-model="replyText" class="tw-input" rows="3" placeholder="写下评论…" />
            <div class="reply-row">
              <button type="button" class="tw-btn tw-btn-ghost" @click="replyForId = null">取消</button>
              <button type="button" class="tw-btn tw-btn-primary" @click="submitReply(a)">发送</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <aside class="side tw-card">
      <div class="h">相关问题</div>
      <RouterLink
        v-for="r in data.related"
        :key="r.id"
        class="rel"
        :to="{ name: r.post_type === 'question' ? 'qa-detail' : 'post', params: { id: r.id } }"
      >
        <span class="rel-type" :class="r.post_type === 'question' ? 'q' : 'a'">{{ r.post_type === 'question' ? '问答' : '文章' }}</span>
        <span class="rel-title">{{ r.title }}</span>
      </RouterLink>
    </aside>

    <div v-if="delAnswerId" class="modal-mask">
      <div class="modal tw-card">
        <p class="modal-t">确定删除这条回答吗？</p>
        <div class="modal-actions">
          <button type="button" class="tw-btn tw-btn-ghost" @click="delAnswerId = null">取消</button>
          <button type="button" class="tw-btn tw-btn-primary" @click="confirmDeleteAnswer">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.q,
.ans {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  margin-bottom: 12px;
}
.top h1 {
  margin: 0 0 10px;
  font-size: 24px;
  line-height: 1.25;
}
.meta {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.q-author {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.q-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(26, 86, 219, 0.12);
  font-weight: 900;
  color: #1a56db;
  overflow: hidden;
  flex-shrink: 0;
}
.q-avatar-anon {
  background: #e2e8f0;
}
.q-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.q-author-name {
  font-size: 13px;
}
.tag {
  font-size: 12px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.55);
}
.muted {
  color: var(--tw-muted);
}
.html {
  margin-top: 12px;
  line-height: 1.75;
}
.row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 14px;
  flex-wrap: wrap;
}
.grow {
  flex: 1;
}
.sm {
  width: 140px;
  padding: 8px 10px;
}
.editor {
  margin-top: 12px;
  padding: 12px;
  display: grid;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.ans h3 {
  margin: 0 0 10px;
}
.a {
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  position: relative;
  transition: all 0.2s ease;
}
.a:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
}
.head {
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.who {
  display: flex;
  gap: 10px;
  align-items: center;
}
.who-text {
  min-width: 0;
}
.avatar {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(26, 86, 219, 0.12);
  font-weight: 900;
  color: #1a56db;
}
.more-wrap {
  position: relative;
}
.more-btn {
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
  font-weight: 900;
}
.more-menu {
  position: absolute;
  right: 0;
  top: 36px;
  z-index: 30;
  min-width: 120px;
  padding: 6px;
  display: grid;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.more-menu button {
  border: none;
  background: rgba(26, 86, 219, 0.06);
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  text-align: left;
}
.more-menu .danger {
  color: #b91c1c;
}
.badge {
  margin-top: 10px;
  font-size: 12px;
  color: var(--tw-muted);
}
.ans-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.act {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  color: var(--tw-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.act:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.replies {
  margin-top: 10px;
  padding-left: 10px;
  border-left: 3px solid rgba(26, 86, 219, 0.15);
}
.rep {
  margin-bottom: 10px;
}
.rep-txt {
  margin-top: 4px;
  white-space: pre-wrap;
  font-size: 14px;
}
.rep-time {
  margin-left: 8px;
}
.reply-box {
  margin-top: 10px;
  padding: 10px;
  display: grid;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.reply-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.side {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  position: sticky;
  top: 76px;
}
.h {
  font-weight: 900;
  margin-bottom: 10px;
}
.rel {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
  padding: 10px 8px;
  border-radius: 12px;
  color: var(--tw-text);
}
.rel:hover {
  background: rgba(26, 86, 219, 0.06);
}
.rel-type {
  font-size: 11px;
  font-weight: 900;
  border-radius: 999px;
  padding: 2px 8px;
  line-height: 1.5;
}
.rel-type.q {
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.12);
}
.rel-type.a {
  color: #1a56db;
  background: rgba(26, 86, 219, 0.12);
}
.rel-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: grid;
  place-items: center;
  z-index: 200;
  padding: 16px;
}
.modal {
  width: min(360px, 100%);
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.modal-t {
  margin: 0 0 14px;
  font-weight: 800;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
