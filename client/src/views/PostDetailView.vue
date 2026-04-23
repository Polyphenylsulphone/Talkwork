<script setup>
import { onMounted, ref, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import DOMPurify from 'dompurify';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Reply, Star, X } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { collegeLabel, collegeColor } from '../constants';
import { ANONYMOUS_AVATAR } from '../constants/defaultAvatars';
import { formatCommentTime } from '../utils/time';

const route = useRoute();
const auth = useAuthStore();

const data = ref(null);
const comment = ref('');
const preview = ref({ open: false, urls: [], idx: 0 });
const contentRef = ref(null);
const delCommentId = ref(null);
const replyTarget = ref(null);
/** 评论收藏：文档要求前端占位交互 */
const commentCollected = ref(new Set());

const safeHtml = computed(() => DOMPurify.sanitize(data.value?.post?.content || ''));
const postAnonymous = computed(() => !!Number(data.value?.post?.is_anonymous));
const postAvatar = computed(() => data.value?.post?.avatar_url || ANONYMOUS_AVATAR);
const threadedComments = computed(() => {
  const list = Array.isArray(data.value?.comments) ? data.value.comments : [];
  const roots = [];
  const map = new Map();
  list.forEach((item) => map.set(item.id, { ...item, children: [] }));
  list.forEach((item) => {
    const cur = map.get(item.id);
    if (!item.parent_comment_id) {
      roots.push(cur);
      return;
    }
    const parent = map.get(item.parent_comment_id);
    if (!parent) {
      roots.push(cur);
      return;
    }
    parent.children.push(cur);
  });
  return roots;
});

onMounted(load);

async function load() {
  data.value = unwrap(await http.get(`/posts/${route.params.id}`));
  commentCollected.value = new Set();
  data.value.comments = (data.value.comments || []).map((c) => ({
    ...c,
    liked: !!c.liked,
    likes_count: Number(c.likes_count) || 0,
  }));
  await nextTick();
  setupArticleImages();
}

async function toggleLike() {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const r = unwrap(await http.post(`/posts/${route.params.id}/like`));
  data.value.post.liked = r.liked;
  data.value.post.likes_count = r.likes_count;
}

async function toggleCollect() {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const r = unwrap(await http.post(`/posts/${route.params.id}/collect`));
  data.value.post.collected = r.collected;
  data.value.post.collects_count = r.collects_count;
}

async function sendComment() {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  if (!comment.value.trim()) return;
  const rows = unwrap(
    await http.post(`/posts/${route.params.id}/comments`, {
      content: comment.value,
      parent_comment_id: replyTarget.value?.parentId || null,
      reply_to_user_id: replyTarget.value?.userId || null,
    })
  );
  data.value.comments = rows.map((c) => ({
    ...c,
    liked: !!c.liked,
    likes_count: Number(c.likes_count) || 0,
  }));
  comment.value = '';
  replyTarget.value = null;
  toast.success('评论已发送');
}

function askDelComment(id) {
  delCommentId.value = id;
}

async function confirmDelComment() {
  if (!delCommentId.value) return;
  const id = delCommentId.value;
  delCommentId.value = null;
  unwrap(await http.delete(`/posts/comments/${id}`));
  data.value.comments = data.value.comments.filter((c) => c.id !== id && c.parent_comment_id !== id);
  toast.success('已删除');
}

async function toggleCommentLike(c) {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const r = unwrap(await http.post(`/posts/comments/${c.id}/like`));
  c.liked = !!r.liked;
  c.likes_count = r.likes_count;
}

function toggleCommentCollect(id) {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const next = new Set(commentCollected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  commentCollected.value = next;
}

function replyToComment(c) {
  if (!auth.isLoggedIn) return toast.error('请先登录');
  const parentId = c.parent_comment_id || c.id;
  replyTarget.value = { parentId, userId: c.user_id, username: c.username };
}

function cancelReply() {
  replyTarget.value = null;
}

function onComposerKeydown(e) {
  if (e.key !== 'Enter') return;
  if (e.shiftKey) return;
  e.preventDefault();
  sendComment();
}

function openImg(urls, idx) {
  preview.value = { open: true, urls, idx };
}

function closePreview() {
  preview.value = { open: false, urls: [], idx: 0 };
}

function movePreview(step) {
  if (!preview.value.urls.length) return;
  const n = preview.value.urls.length;
  preview.value.idx = (preview.value.idx + step + n) % n;
}

function setupArticleImages() {
  const wrap = contentRef.value;
  if (!wrap) return;
  const imgs = Array.from(wrap.querySelectorAll('img'));
  if (!imgs.length) return;
  const urls = imgs.map((img) => img.getAttribute('src')).filter(Boolean);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.getAttribute('data-src');
        if (src) img.setAttribute('src', src);
        io.unobserve(img);
      });
    },
    { rootMargin: '120px 0px' }
  );
  imgs.forEach((img, idx) => {
    const src = img.getAttribute('src');
    if (!src) return;
    img.setAttribute('data-src', src);
    img.removeAttribute('src');
    img.classList.add('lazy-img');
    img.addEventListener('click', () => openImg(urls, idx), { passive: true });
    io.observe(img);
  });
}
</script>

<template>
  <div v-if="data" class="layout">
    <article class="main tw-card">
      <div class="top">
        <h1>{{ data.post.title }}</h1>
        <div class="meta">
          <span class="tag" :style="{ color: collegeColor(data.post.college), borderColor: collegeColor(data.post.college) }">{{
            collegeLabel(data.post.college)
          }}</span>
          <span class="muted">{{ new Date(data.post.created_at).toLocaleString() }}</span>
        </div>
        <div class="author">
          <div class="avatar" :class="{ 'avatar-anon': postAnonymous }">
<<<<<<< HEAD
            <img v-if="postAnonymous" class="avatar-img" :src="postAvatar" alt="" />
=======
            <img v-if="data.post.avatar_url" class="avatar-img" :src="data.post.avatar_url" alt="" />
>>>>>>> d6473da (前端样式改动，加入默认头像)
            <template v-else>{{ data.post.username?.slice(0, 1) }}</template>
          </div>
          <div>
            <div class="name">{{ data.post.username }}</div>
            <button class="follow" type="button" disabled>关注（预留）</button>
          </div>
        </div>
      </div>

      <div ref="contentRef" class="content ql-snow" v-html="safeHtml" />

      <div class="actions">
        <button type="button" class="tw-btn tw-btn-ghost" @click="toggleLike">
          <Heart :size="16" :fill="data.post.liked ? 'currentColor' : 'none'" />
          {{ data.post.liked ? '已赞' : '点赞' }} {{ data.post.likes_count }}
        </button>
        <button type="button" class="tw-btn tw-btn-ghost" @click="toggleCollect">
          <Star :size="16" :fill="data.post.collected ? 'currentColor' : 'none'" />
          {{ data.post.collected ? '已收藏' : '收藏' }} {{ data.post.collects_count }}
        </button>
        <span class="muted"><MessageCircle :size="16" /> {{ data.post.comments_count }} 条评论</span>
      </div>

      <div v-if="data.post.post_type === 'question' && data.tbaoInsight" class="tbao tw-card">
        <div class="tbao-title">T宝对这个问题的看法</div>
        <p class="tbao-text">{{ data.tbaoInsight }}</p>
      </div>

      <div class="comments">
        <h3>评论区</h3>
        <div v-for="c in threadedComments" :key="c.id" class="c tw-card">
          <div class="crow">
            <div class="avatar sm">{{ c.username?.slice(0, 1) }}</div>
            <div class="grow">
              <div class="r">
                <b>{{ c.username }}</b>
                <button v-if="auth.user?.id === c.user_id" class="del" type="button" @click="askDelComment(c.id)">删除</button>
              </div>
              <div class="txt">{{ c.content }}</div>
              <div class="crow-actions">
                <button type="button" class="icon-btn" :disabled="!auth.isLoggedIn" @click="toggleCommentLike(c)">
                  <Heart :size="14" :fill="c.liked ? 'currentColor' : 'none'" /> {{ c.likes_count ?? 0 }}
                </button>
                <button type="button" class="icon-btn" :disabled="!auth.isLoggedIn" @click="toggleCommentCollect(c.id)">
                  <Star :size="14" :fill="commentCollected.has(c.id) ? 'currentColor' : 'none'" /> 收藏
                </button>
                <button type="button" class="icon-btn" :disabled="!auth.isLoggedIn" @click="replyToComment(c)">
                  <Reply :size="14" /> 回复
                </button>
                <span class="muted sm">{{ formatCommentTime(c.created_at) }}</span>
              </div>
            </div>
          </div>
          <div v-for="child in c.children" :key="child.id" class="sub-reply">
            <div class="crow">
              <div class="avatar sm">{{ child.username?.slice(0, 1) }}</div>
              <div class="grow">
                <div class="r">
                  <b>{{ child.username }}</b>
                  <button v-if="auth.user?.id === child.user_id" class="del" type="button" @click="askDelComment(child.id)">删除</button>
                </div>
                <div class="txt">
                  <span v-if="child.reply_to_user_id" class="at">回复 {{ child.reply_to_username || '用户' }}：</span>
                  {{ child.content }}
                </div>
                <div class="crow-actions">
                  <button type="button" class="icon-btn" :disabled="!auth.isLoggedIn" @click="toggleCommentLike(child)">
                    <Heart :size="14" :fill="child.liked ? 'currentColor' : 'none'" /> {{ child.likes_count ?? 0 }}
                  </button>
                  <button type="button" class="icon-btn" :disabled="!auth.isLoggedIn" @click="toggleCommentCollect(child.id)">
                    <Star :size="14" :fill="commentCollected.has(child.id) ? 'currentColor' : 'none'" /> 收藏
                  </button>
                  <button type="button" class="icon-btn" :disabled="!auth.isLoggedIn" @click="replyToComment(child)">
                    <Reply :size="14" /> 回复
                  </button>
                  <span class="muted sm">{{ formatCommentTime(child.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="delCommentId" class="modal-mask">
          <div class="modal tw-card">
            <p class="modal-t">确定删除这条评论吗？</p>
            <div class="modal-actions">
              <button type="button" class="tw-btn tw-btn-ghost" @click="delCommentId = null">取消</button>
              <button type="button" class="tw-btn tw-btn-primary" @click="confirmDelComment">删除</button>
            </div>
          </div>
        </div>

        <div v-if="auth.isLoggedIn" class="composer tw-card">
          <div v-if="replyTarget" class="reply-tip">
            正在回复 <b>{{ replyTarget.username }}</b>
            <button type="button" class="cancel-reply" @click="cancelReply">取消</button>
          </div>
          <textarea
            v-model="comment"
            class="tw-input"
            rows="3"
            :placeholder="replyTarget ? `回复 ${replyTarget.username}...` : '写下你的想法…'"
            @keydown="onComposerKeydown"
          />
          <button class="tw-btn tw-btn-primary" type="button" @click="sendComment">发布评论</button>
        </div>
        <div v-else class="muted">登录后即可评论</div>
      </div>
    </article>

    <aside class="side">
      <div class="tw-card pad">
        <div class="h">相关帖子</div>
        <RouterLink
          v-for="r in data.related"
          :key="r.id"
          class="rel"
          :to="{ name: r.post_type === 'question' ? 'qa-detail' : 'post', params: { id: r.id } }"
        >
          <span class="rel-type" :class="r.post_type === 'question' ? 'q' : 'a'">{{ r.post_type === 'question' ? '问答' : '文章' }}</span>
          <span class="rel-title">{{ r.title }}</span>
        </RouterLink>
      </div>
    </aside>

    <div v-if="preview.open" class="lightbox" @click.self="closePreview">
      <button type="button" class="lb-close" @click="closePreview"><X :size="20" /></button>
      <button type="button" class="lb-nav left" @click="movePreview(-1)"><ChevronLeft :size="20" /></button>
      <img class="lb-img" :src="preview.urls[preview.idx]" alt="" />
      <button type="button" class="lb-nav right" @click="movePreview(1)"><ChevronRight :size="20" /></button>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    order: -1;
  }
}
.main {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.top h1 {
  margin: 0 0 10px;
  font-size: 26px;
  line-height: 1.25;
}
.meta {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.tag {
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.55);
}
.muted {
  color: var(--tw-muted);
}
.author {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 14px 0 10px;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #93c5fd, #bfdbfe);
  font-weight: 900;
  overflow: hidden;
}
.avatar.avatar-anon {
  background: #e2e8f0;
  padding: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar.sm {
  width: 34px;
  height: 34px;
}
.name {
  font-weight: 900;
}
.follow {
  margin-top: 6px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  padding: 6px 10px;
  border-radius: 999px;
  cursor: not-allowed;
  color: var(--tw-muted);
  font-size: 12px;
}
.content {
  margin-top: 12px;
  line-height: 1.75;
}
:deep(.content img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: zoom-in;
}
:deep(.content img.lazy-img) {
  min-height: 120px;
  background: rgba(148, 163, 184, 0.16);
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.actions .tw-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.actions .muted {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tbao {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(26, 86, 219, 0.12);
  background: rgba(26, 86, 219, 0.05);
}
.tbao-title {
  font-weight: 900;
  margin-bottom: 8px;
}
.tbao-text {
  margin: 0;
  color: var(--tw-text);
  white-space: pre-wrap;
}
.comments {
  margin-top: 16px;
}
.comments h3 {
  margin: 0 0 10px;
}
.c {
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.crow {
  display: flex;
  gap: 10px;
}
.grow {
  flex: 1;
  min-width: 0;
}
.r {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.del {
  border: none;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  font-weight: 800;
}
.txt {
  margin-top: 6px;
  white-space: pre-wrap;
}
.sm {
  font-size: 12px;
  margin-top: 6px;
}
.crow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
}
.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  color: var(--tw-muted);
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
.composer {
  padding: 12px;
  display: grid;
  gap: 10px;
  margin-top: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.sub-reply {
  margin-left: 44px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(148, 163, 184, 0.35);
}
.reply-tip {
  font-size: 12px;
  color: var(--tw-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}
.cancel-reply {
  border: none;
  background: transparent;
  color: #1a56db;
  cursor: pointer;
  font-size: 12px;
}
.at {
  color: #1d4ed8;
  font-weight: 700;
  margin-right: 4px;
}
.side .pad {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
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
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.82);
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 20px 54px;
}
.lb-img {
  max-width: min(1100px, 90vw);
  max-height: 84vh;
  border-radius: 8px;
}
.lb-close {
  position: absolute;
  right: 18px;
  top: 10px;
  border: none;
  background: transparent;
  color: #fff;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}
.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  line-height: 1;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}
.lb-nav.left {
  left: 10px;
}
.lb-nav.right {
  right: 10px;
}
</style>
