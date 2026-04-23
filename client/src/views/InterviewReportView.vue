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
<<<<<<< HEAD
  padding: 24px;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
}
.score {
  font-size: 64px;
  font-weight: 900;
  background: linear-gradient(135deg, #1a56db, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
=======
  padding: 32px;
  border: none;
  border-radius: 24px;
  background: #FFFFFF;
}
.score {
  font-size: 72px;
  font-weight: 900;
  color: var(--tw-primary);
>>>>>>> d6473da (前端样式改动，加入默认头像)
  text-align: center;
  line-height: 1.1;
  margin-top: 12px;
}
.sub {
  text-align: center;
  color: var(--tw-muted);
<<<<<<< HEAD
  margin: 4px 0 24px;
  font-size: 14px;
=======
  margin: 8px 0 32px;
  font-size: 15px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  font-weight: 600;
}
.dims {
  display: flex;
  flex-direction: column;
<<<<<<< HEAD
  gap: 14px;
  margin-bottom: 24px;
  padding: 20px;
  background: color-mix(in srgb, var(--tw-primary) 3%, transparent);
  border-radius: 16px;
=======
  gap: 16px;
  margin-bottom: 32px;
  padding: 24px;
  background: #F9FAFB;
  border-radius: 20px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
}
.row {
  display: flex;
  align-items: center;
<<<<<<< HEAD
  gap: 12px;
=======
  gap: 16px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
}
.k {
  font-weight: 800;
  color: var(--text-primary);
<<<<<<< HEAD
  width: 70px;
  font-size: 14px;
}
.bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--border-secondary);
=======
  width: 80px;
  font-size: 15px;
}
.bar {
  flex: 1;
  height: 10px;
  border-radius: 9999px;
  background: #E5E7EB;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  overflow: hidden;
}
.fill {
  height: 100%;
<<<<<<< HEAD
  border-radius: 999px;
  background: linear-gradient(90deg, #1a56db, #60a5fa);
=======
  border-radius: 9999px;
  background: var(--tw-primary);
>>>>>>> d6473da (前端样式改动，加入默认头像)
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}
.n {
  font-weight: 900;
  text-align: right;
<<<<<<< HEAD
  width: 36px;
=======
  width: 40px;
  font-size: 16px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  color: var(--tw-primary);
}
.sec {
  font-weight: 900;
<<<<<<< HEAD
  font-size: 18px;
  margin: 24px 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
=======
  font-size: 20px;
  margin: 32px 0 20px;
  display: flex;
  align-items: center;
  gap: 12px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
}
.sec::before {
  content: '';
  display: block;
<<<<<<< HEAD
  width: 4px;
  height: 16px;
=======
  width: 6px;
  height: 20px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
  background: var(--tw-primary);
  border-radius: 4px;
}
.item {
<<<<<<< HEAD
  padding: 16px 20px;
  margin-bottom: 12px;
  border: 1px solid var(--border-secondary);
  background: var(--bg-soft);
  border-radius: 16px;
=======
  padding: 24px;
  margin-bottom: 16px;
  border: none;
  background: #F9FAFB;
  border-radius: 20px;
>>>>>>> d6473da (前端样式改动，加入默认头像)
}
.b {
  font-weight: 800;
  font-size: 15px;
  color: var(--text-strong);
  margin-bottom: 12px;
}
.sm {
  font-size: 12px;
  font-weight: 800;
  color: var(--tw-primary);
  margin-top: 12px;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
</style>
