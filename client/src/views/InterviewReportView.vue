<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import html2canvas from 'html2canvas';
import { http, unwrap } from '../api/http';
import { toast } from '../stores/toast';

const route = useRoute();
const router = useRouter();
const s = ref(null);
const reportRef = ref(null);
const sharing = ref(false);

const dims = computed(() => {
  const d = s.value?.dimensions_json || {};
  return [
    { key: 'professional', label: '专业能力', val: Number(d.professional || 0) },
    { key: 'expression', label: '表达能力', val: Number(d.expression || 0) },
    { key: 'adaptability', label: '应变能力', val: Number(d.adaptability || 0) },
  ];
});

onMounted(async () => {
  s.value = unwrap(await http.get(`/interview/${route.params.id}`));
});

function again() {
  router.push({ name: 'interview' });
}

function buildShareTitle() {
  const score = s.value?.score ?? route.query.score ?? '—';
  return `我的面试复盘报告：综合得分 ${score}`;
}

function buildShareContent() {
  const score = s.value?.score ?? route.query.score ?? '—';
  const dimLines = dims.value.map((x) => `<li>${x.label}：${x.val}分</li>`).join('');
  const reviewItems = (s.value?.review || [])
    .map(
      (it, idx) =>
        `<p><strong>第${idx + 1}题：</strong>${it.q || ''}</p><p><strong>点评：</strong>${it.comment || ''}</p>`
    )
    .join('');
  return `
    <h2>面试复盘分享</h2>
    <p>我刚完成了一次模拟面试复盘，综合得分 <strong>${score}</strong>。</p>
    <p><strong>维度表现</strong></p>
    <ul>${dimLines}</ul>
    ${reviewItems || '<p>本次暂无逐题复盘内容。</p>'}
    <p>欢迎一起交流面试经验。</p>
  `.trim();
}

function shareToCommunity() {
  const draft = {
    title: buildShareTitle(),
    content: buildShareContent(),
    college: 'other',
  };
  sessionStorage.setItem('tw_share_post_draft', JSON.stringify(draft));
  toast.success('已生成帖子草稿，可编辑后发布');
  router.push({ name: 'post-create', query: { type: 'article' } });
}

async function shareAsImage() {
  if (!reportRef.value || sharing.value) return;
  sharing.value = true;
  try {
    const canvas = await html2canvas(reportRef.value, {
      backgroundColor: '#f8fafc',
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = `talkwork-report-${route.params.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('分享图已生成');
  } catch {
    toast.error('生成分享图失败，请稍后重试');
  } finally {
    sharing.value = false;
  }
}
</script>

<template>
  <div v-if="s" class="report-page">
    <div class="topbar">
      <div />
      <div class="share-actions">
        <button class="tw-btn tw-btn-ghost" type="button" @click="shareToCommunity">分享为帖子</button>
        <button class="tw-btn tw-btn-ghost" type="button" :disabled="sharing" @click="shareAsImage">
          {{ sharing ? '生成中...' : '生成分享图' }}
        </button>
      </div>
    </div>

    <div ref="reportRef" class="wrap tw-card">
      <div class="score">{{ s.score ?? route.query.score ?? '—' }}</div>
      <div class="sub">综合得分（百分制）</div>

      <div class="dims">
        <div v-for="x in dims" :key="x.key" class="row">
          <div class="k">{{ x.label }}</div>
          <div class="bar">
            <div class="fill" :style="{ width: x.val + '%' }" />
          </div>
          <div class="n">{{ x.val }}</div>
        </div>
      </div>

      <div class="sec">逐题复盘</div>
      <div v-if="!(s.review || []).length" class="muted">暂无逐题条目（演示模式或未解析到结构化结果）。</div>
      <div v-for="(it, i) in s.review || []" :key="i" class="item tw-card">
        <div class="muted sm">题目</div>
        <div class="b">{{ it.q }}</div>
        <div class="muted sm">你的回答</div>
        <div>{{ it.user }}</div>
        <div class="muted sm">点评</div>
        <div>{{ it.comment }}</div>
      </div>
    </div>

    <div class="actions">
      <button class="tw-btn tw-btn-primary" type="button" @click="again">再练一次</button>
      <button class="tw-btn tw-btn-ghost" type="button" @click="router.push({ name: 'assistant' })">返回求职助手</button>
    </div>
  </div>
</template>

<style scoped>
.report-page {
  display: grid;
  gap: 12px;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.share-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.wrap {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.score {
  font-size: 56px;
  font-weight: 900;
  color: #1a56db;
  text-align: center;
  line-height: 1;
}
.sub {
  text-align: center;
  color: var(--tw-muted);
  margin: 8px 0 14px;
}
.dims {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
}
.row {
  display: grid;
  grid-template-columns: 110px 1fr 44px;
  gap: 10px;
  align-items: center;
}
.k {
  font-weight: 900;
  color: #334155;
}
.bar {
  height: 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #1a56db, #60a5fa);
}
.n {
  font-weight: 900;
  text-align: right;
}
.sec {
  font-weight: 900;
  margin: 10px 0;
}
.item {
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.b {
  font-weight: 800;
}
.sm {
  font-size: 12px;
  margin-top: 8px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
</style>
