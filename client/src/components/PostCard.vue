<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Heart, MessageCircle, Star } from 'lucide-vue-next';
import { collegeLabel, collegeColor } from '../constants';

const props = defineProps({
  post: { type: Object, required: true },
});

const router = useRouter();
const summary = computed(() => props.post.summary || '');
const isAnonymous = computed(() => !!Number(props.post.is_anonymous));
const cardStyle = computed(() => ({
  borderLeft: `3px solid ${collegeColor(props.post.college)}`,
}));

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
          <img v-if="isAnonymous" class="avatar-img" src="/anonymous-avatar.svg" alt="" />
          <template v-else>{{ (post.username || '?').slice(0, 1) }}</template>
        </div>
        <span>{{ post.username }}</span>
      </div>
      <div class="meta">
        <span><Heart :size="16" /> {{ post.likes_count ?? 0 }}</span>
        <span><Star :size="16" /> {{ post.collects_count ?? 0 }}</span>
        <span><MessageCircle :size="16" /> {{ post.comments_count ?? post.answers_count ?? 0 }}</span>
        <span class="time">{{ rel(post.created_at) }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-left-width: 3px;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
  background: rgba(255, 255, 255, 0.92);
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
  height: 26px;
  padding: 0 8px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 12px;
  margin-top: 2px;
  white-space: nowrap;
}
.type-q {
  color: #c2410c;
  background: rgba(251, 146, 60, 0.2);
  border: 1px solid rgba(251, 146, 60, 0.45);
}
.type-a {
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.35);
}
.title {
  margin: 0;
  font-size: 17px;
  line-height: 1.35;
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
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
}
.right-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.summary {
  margin: 10px 0 14px;
  color: var(--tw-muted);
  line-height: 1.55;
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
  color: var(--tw-muted);
  font-size: 13px;
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #93c5fd, #bfdbfe);
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #1e3a8a;
  font-size: 13px;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar-anon {
  background: #e2e8f0;
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
  font-size: 12px;
  color: var(--tw-muted);
}
.meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.time {
  color: #94a3b8;
}
</style>
