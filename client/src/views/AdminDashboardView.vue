<script setup>
import { onMounted, ref } from 'vue';
import { http, unwrap } from '../api/http';
import { toast } from '../stores/toast';

const tab = ref('overview');
const q = ref('');
const userList = ref([]);
const postStatus = ref('pending');
const postList = ref([]);
const commentList = ref([]);
const reportStatus = ref('pending');
const reportList = ref([]);
const metrics = ref({ users: 0, posts: 0, comments: 0, reports: 0, pending_posts: 0, pending_reports: 0 });

async function loadOverview() {
  metrics.value = unwrap(await http.get('/admin/dashboard'));
}
async function loadUsers() {
  userList.value = unwrap(await http.get('/admin/users', { params: { q: q.value } })).list || [];
}
async function loadPosts() {
  postList.value = unwrap(await http.get('/admin/posts', { params: { status: postStatus.value } })) || [];
}
async function loadComments() {
  commentList.value = unwrap(await http.get('/admin/comments')) || [];
}
async function loadReports() {
  reportList.value = unwrap(await http.get('/admin/reports', { params: { status: reportStatus.value } })) || [];
}

async function setUserRole(user, role) {
  await http.patch(`/admin/users/${user.id}`, { role });
  toast.success('角色已更新');
  await loadUsers();
}
async function setUserActive(user, isActive) {
  await http.patch(`/admin/users/${user.id}`, { is_active: isActive });
  toast.success('用户状态已更新');
  await loadUsers();
}
async function reviewPost(item, action) {
  await http.patch(`/admin/posts/${item.id}/review`, { action });
  toast.success('审核已处理');
  await loadPosts();
}
async function removeComment(item) {
  await http.delete(`/admin/comments/${item.source}/${item.id}`);
  toast.success('评论已删除');
  await loadComments();
}
async function setReportStatus(item, status) {
  await http.patch(`/admin/reports/${item.id}`, { status });
  toast.success('举报已处理');
  await loadReports();
}

async function onTabChange(next) {
  tab.value = next;
  if (next === 'overview') await loadOverview();
  if (next === 'users') await loadUsers();
  if (next === 'posts') await loadPosts();
  if (next === 'comments') await loadComments();
  if (next === 'reports') await loadReports();
}

onMounted(() => {
  onTabChange('overview');
});
</script>

<template>
  <div class="tw-card wrap">
    <div class="tabs">
      <button type="button" :class="{ on: tab === 'overview' }" @click="onTabChange('overview')">数据看板</button>
      <button type="button" :class="{ on: tab === 'users' }" @click="onTabChange('users')">用户管理</button>
      <button type="button" :class="{ on: tab === 'posts' }" @click="onTabChange('posts')">帖子审核</button>
      <button type="button" :class="{ on: tab === 'comments' }" @click="onTabChange('comments')">评论管理</button>
      <button type="button" :class="{ on: tab === 'reports' }" @click="onTabChange('reports')">举报处理</button>
    </div>

    <div v-if="tab === 'overview'" class="grid">
      <div class="kpi"><b>{{ metrics.users }}</b><span>用户数</span></div>
      <div class="kpi"><b>{{ metrics.posts }}</b><span>帖子数</span></div>
      <div class="kpi"><b>{{ metrics.comments }}</b><span>评论数</span></div>
      <div class="kpi"><b>{{ metrics.reports }}</b><span>举报数</span></div>
      <div class="kpi warn"><b>{{ metrics.pending_posts }}</b><span>待审核帖子</span></div>
      <div class="kpi warn"><b>{{ metrics.pending_reports }}</b><span>待处理举报</span></div>
    </div>

    <div v-else-if="tab === 'users'" class="panel">
      <div class="tools">
        <input v-model="q" class="tw-input" placeholder="搜索用户名" />
        <button class="tw-btn tw-btn-ghost" type="button" @click="loadUsers">搜索</button>
      </div>
      <table class="tb">
        <tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>操作</th></tr>
        <tr v-for="u in userList" :key="u.id">
          <td>{{ u.id }}</td><td>{{ u.username }}</td><td>{{ u.role }}</td><td>{{ u.is_active ? '启用' : '禁用' }}</td>
          <td class="ops">
            <button type="button" @click="setUserRole(u, u.role === 'admin' ? 'user' : 'admin')">{{ u.role === 'admin' ? '降级为用户' : '设为管理员' }}</button>
            <button type="button" @click="setUserActive(u, !u.is_active)">{{ u.is_active ? '禁用' : '启用' }}</button>
          </td>
        </tr>
      </table>
    </div>

    <div v-else-if="tab === 'posts'" class="panel">
      <div class="tools">
        <select v-model="postStatus" class="tw-input sm">
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
          <option value="all">全部</option>
        </select>
        <button class="tw-btn tw-btn-ghost" type="button" @click="loadPosts">刷新</button>
      </div>
      <table class="tb">
        <tr><th>ID</th><th>标题</th><th>作者</th><th>状态</th><th>操作</th></tr>
        <tr v-for="p in postList" :key="p.id">
          <td>{{ p.id }}</td><td>{{ p.title }}</td><td>{{ p.username }}</td><td>{{ p.review_status }}</td>
          <td class="ops">
            <button type="button" @click="reviewPost(p, 'approve')">通过</button>
            <button type="button" @click="reviewPost(p, 'reject')">拒绝</button>
            <button type="button" @click="reviewPost(p, 'pending')">改回待审</button>
          </td>
        </tr>
      </table>
    </div>

    <div v-else-if="tab === 'comments'" class="panel">
      <div class="tools">
        <button class="tw-btn tw-btn-ghost" type="button" @click="loadComments">刷新</button>
      </div>
      <table class="tb">
        <tr><th>ID</th><th>来源</th><th>用户</th><th>内容</th><th>操作</th></tr>
        <tr v-for="c in commentList" :key="`${c.source}_${c.id}`">
          <td>{{ c.id }}</td><td>{{ c.source }}</td><td>{{ c.username }}</td><td>{{ c.content }}</td>
          <td class="ops"><button type="button" @click="removeComment(c)">删除</button></td>
        </tr>
      </table>
    </div>

    <div v-else class="panel">
      <div class="tools">
        <select v-model="reportStatus" class="tw-input sm">
          <option value="pending">待处理</option>
          <option value="resolved">已处理</option>
          <option value="rejected">已驳回</option>
          <option value="all">全部</option>
        </select>
        <button class="tw-btn tw-btn-ghost" type="button" @click="loadReports">刷新</button>
      </div>
      <table class="tb">
        <tr><th>ID</th><th>举报人</th><th>类型</th><th>目标ID</th><th>原因</th><th>状态</th><th>操作</th></tr>
        <tr v-for="r in reportList" :key="r.id">
          <td>{{ r.id }}</td><td>{{ r.reporter_name }}</td><td>{{ r.target_type }}</td><td>{{ r.target_id }}</td><td>{{ r.reason }}</td><td>{{ r.status }}</td>
          <td class="ops">
            <button type="button" @click="setReportStatus(r, 'resolved')">标记已处理</button>
            <button type="button" @click="setReportStatus(r, 'rejected')">驳回</button>
            <button type="button" @click="setReportStatus(r, 'pending')">改回待处理</button>
          </td>
        </tr>
      </table>
    </div>
  </div>
</template>

<style scoped>
.wrap { padding: 12px; border: 1px solid rgba(255,255,255,.55); }
.tabs { display:flex; gap:8px; flex-wrap: wrap; margin-bottom: 10px; }
.tabs button { border:1px solid rgba(26,86,219,.2); background:#fff; border-radius:999px; padding:8px 12px; font-weight:800; cursor:pointer; }
.tabs button.on { background:rgba(26,86,219,.1); border-color: rgba(26,86,219,.4); color:#1a56db; }
.grid { display:grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap:10px; }
.kpi { border:1px solid rgba(148,163,184,.3); border-radius:10px; padding:12px; display:grid; gap:3px; background:#fff; }
.kpi b { font-size: 26px; }
.kpi span { color: var(--tw-muted); font-weight: 700; }
.kpi.warn { background: rgba(251,191,36,.08); }
.panel { display:grid; gap:10px; }
.tools { display:flex; gap:8px; align-items:center; }
.sm { max-width: 160px; }
.tb { width:100%; border-collapse: collapse; background:#fff; border-radius:10px; overflow: hidden; }
.tb th,.tb td { border-bottom:1px solid rgba(148,163,184,.2); text-align:left; padding:8px; vertical-align: top; font-size: 13px; }
.ops { display:flex; gap:6px; flex-wrap: wrap; }
.ops button { border:none; border-radius:8px; padding:4px 8px; cursor:pointer; background:rgba(26,86,219,.1); color:#1a56db; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 680px) { .grid { grid-template-columns: 1fr; } .tb { font-size: 12px; } }
</style>
