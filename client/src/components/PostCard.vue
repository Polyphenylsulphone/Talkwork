<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Heart, MessageCircle, Star } from 'lucide-vue-next';
import { collegeLabel, collegeColor } from '../constants';
import { ANONYMOUS_AVATAR } from '../constants/defaultAvatars';
import { http, unwrap } from '../api/http';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';

const props = defineProps({
  post: { type: Object, required: true },
});

const router = useRouter();
const auth = useAuthStore();
const likeBusy = ref(false);
const collectBusy = ref(false);

const summary = computed(() => props.post.summary || '');
const isAnonymous = computed(() => !!Number(props.post.is_anonymous));
const liked = computed(() => !!Number(props.post.liked));
const collected = computed(() => !!Number(props.post.collected));
const cardStyle = computed(() => ({
  borderLeft: `3px solid ${collegeColor(props.post.college)}`,
}));

<<<<<<< HEAD
const liked = computed(() => !!Number(props.post.liked));
const collected = computed(() => !!Number(props.post.collected));
const displayAvatar = computed(() => props.post.avatar_url || ANONYMOUS_AVATAR);
const interactionCount = computed(() => {
  if (props.post.post_type === 'question') {
    return Number(props.post.answers_count ?? props.post.comments_count ?? 0);
  }
  return Number(props.post.comments_count ?? props.post.answers_count ?? 0);
});

=======
>>>>>>> d6473da (前端样式改动，加入默认头像)
function go() {
  if (props.post.post_type === 'question') {
    router.push({ name: 'qa-detail', params: { id: props.post.id } });
  } else {
    router.push({ name: 'post', params: { id: props.post.id } });
  }
}

function rel(t) {
  const d = (Date.now() - new Date(t).getTime()) / 1000;
  if (d < 60) return '刚刚';
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  return `${Math.floor(d / 86400)} 天前`;
}

async function toggleLike(e) {
  e.stopPropagation();
  if (!auth.isLoggedIn) return toast.error('请先登录');
  if (likeBusy.value) return;
  likeBusy.value = true;
  try {
    const r = unwrap(await http.post(`/posts/${props.post.id}/like`));
    props.post.liked = !!r.liked;
    props.post.likes_count = r.likes_count;
  } catch {
    /* http 拦截器已 toast */
  } finally {
    likeBusy.value = false;
  }
}

async function toggleCollect(e) {
  e.stopPropagation();
  if (!auth.isLoggedIn) return toast.error('请先登录');
  if (collectBusy.value) return;
  collectBusy.value = true;
  try {
    const r = unwrap(await http.post(`/posts/${props.post.id}/collect`));
    props.post.collected = !!r.collected;
    props.post.collects_count = r.collects_count;
  } catch {
    /* http 拦截器已 toast */
  } finally {
    collectBusy.value = false;
  }
}
</script>

<template>
  <article class="card tw-card" :style="cardStyle" @click="go">
    <div class="row-top">
      <span
        class="type-badge"
        :class="post.post_type === 'question' ? 'type-q' : 'type-a'"
        :title="post.post_type === 'question' ? '提问' : '文章'"
        >{{ post.post_type === 'question' ? '提问' : '文章' }}</span
      >
      <h3 class="title">{{ post.title }}</h3>
      <div class="right-tools">
        <slot name="top-right-extra" />
        <span class="tag" :style="{ color: collegeColor(post.college), borderColor: collegeColor(post.college) }">{{
          collegeLabel(post.college)
        }}</span>
      </div>
    </div>
    <p class="summary">{{ summary }}</p>
    <div class="row-bottom">
      <div class="author">
        <div class="avatar" :class="{ 'avatar-anon': isAnonymous }">
<<<<<<< HEAD
          <img v-if="isAnonymous" class="avatar-img" :src="displayAvatar" alt="" />
          <img v-else-if="post.avatar_url" class="avatar-img" :src="post.avatar_url" alt="" />
=======
          <img v-if="post.avatar_url" class="avatar-img" :src="post.avatar_url" alt="" />
>>>>>>> d6473da (前端样式改动，加入默认头像)
          <template v-else>{{ (post.username || '?').slice(0, 1) }}</template>
        </div>
        <span>{{ post.username }}</span>
      </div>
      <div class="meta">
        <button
          type="button"
          class="meta-btn"
          :class="{ on: liked, like: liked }"
          :disabled="likeBusy"
          :title="liked ? '取消点赞' : '点赞'"
          @click="toggleLike"
        >
          <Heart class="meta-ic" :size="16" :fill="liked ? 'currentColor' : 'none'" />
          <span class="meta-num">{{ post.likes_count ?? 0 }}</span>
        </button>
        <button
          type="button"
          class="meta-btn"
          :class="{ on: collected, collect: collected }"
          :disabled="collectBusy"
          :title="collected ? '取消收藏' : '收藏'"
          @click="toggleCollect"
        >
          <Star class="meta-ic" :size="16" :fill="collected ? 'currentColor' : 'none'" />
          <span class="meta-num">{{ post.collects_count ?? 0 }}</span>
        </button>
        <span class="meta-readonly"><MessageCircle :size="16" /> {{ interactionCount }}</span>
        <span class="time">{{ rel(post.created_at) }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  padding: 16px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid #eef2f7;
  border-left-width: 3px;
  background: #ffffff;
  border-radius: 18px;
}
.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}
.row-top {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}
.type-badge {
  flex-shrink: 0;
  min-width: 46px;
  height: 23px;
  padding: 0 9px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 12px;
  margin-top: 2px;
  white-space: nowrap;
}
.type-q {
  color: #9a3412;
  background: #ffedd5;
  border: 1px solid #fed7aa;
}
.type-a {
  color: #1d4ed8;
  background: #dbeafe;
  border: 1px solid #bfdbfe;
}
.title {
  margin: 0;
  font-size: 17px;
  line-height: 1.35;
  font-weight: 900;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}
.tag {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: #ffffff;
  white-space: nowrap;
}
.right-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.summary {
  margin: 8px 0 14px;
  color: #4b5563;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.row-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.author {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #dbeafe;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #1e3a8a;
  font-size: 13px;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar-anon {
  background: #e5e7eb;
  padding: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.meta {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
  color: #6b7280;
}
.meta-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.12s ease;
}
.meta-btn:hover:not(:disabled) {
  background: transparent;
  transform: none;
  color: #475569;
}
.meta-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}
.meta-btn.like.on {
  color: #be123c;
  background: transparent;
}
.meta-btn.collect.on {
  color: #b45309;
  background: transparent;
}
.meta-ic {
  flex-shrink: 0;
}
.meta-num {
  font-weight: 800;
  min-width: 1ch;
}
.meta-readonly {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: #9ca3af;
}
.time {
  color: #9ca3af;
  padding-left: 2px;
}
</style>
