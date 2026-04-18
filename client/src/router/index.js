import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import NProgress from 'nprogress';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guest: true } },
    {
      path: '/',
      component: () => import('../layouts/AppShell.vue'),
      children: [
        { path: '', name: 'home', component: () => import('../views/HomeView.vue') },
        { path: 'post/:id', name: 'post', component: () => import('../views/PostDetailView.vue') },
        {
          path: 'post/create',
          name: 'post-create',
          component: () => import('../views/PostEditorView.vue'),
          meta: { auth: true },
        },
        { path: 'qa', name: 'qa', component: () => import('../views/QAListView.vue') },
        { path: 'qa/:id', name: 'qa-detail', component: () => import('../views/QADetailView.vue') },
        {
          path: 'assistant',
          name: 'assistant',
          component: () => import('../views/AssistantHubView.vue'),
          meta: { auth: true },
        },
        {
          path: 'assistant/resume/create',
          name: 'resume-create',
          component: () => import('../views/ResumeCreateView.vue'),
          meta: { auth: true },
        },
        {
          path: 'assistant/resume/optimize',
          name: 'resume-optimize',
          component: () => import('../views/ResumeOptimizeView.vue'),
          meta: { auth: true },
        },
        {
          path: 'assistant/interview',
          name: 'interview',
          component: () => import('../views/InterviewModesView.vue'),
          meta: { auth: true },
        },
        {
          path: 'assistant/interview/session',
          name: 'interview-session',
          component: () => import('../views/InterviewSessionView.vue'),
          meta: { auth: true },
        },
        {
          path: 'assistant/interview/report/:id',
          name: 'interview-report',
          component: () => import('../views/InterviewReportView.vue'),
          meta: { auth: true },
        },
        { path: 'tbot', name: 'tbot', component: () => import('../views/TBotView.vue'), meta: { auth: true } },
        { path: 'profile', name: 'profile', component: () => import('../views/ProfileView.vue'), meta: { auth: true } },
        {
          path: 'profile/edit',
          name: 'profile-edit',
          component: () => import('../views/ProfileEditView.vue'),
          meta: { auth: true },
        },
      ],
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { auth: true, admin: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('../views/AdminDashboardView.vue'),
          meta: { auth: true, admin: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  NProgress.start();
  const auth = useAuthStore();
  if (to.meta.auth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.admin && !auth.isAdmin) {
    return { name: 'home' };
  }
  if (to.meta.guest && auth.isLoggedIn && to.name === 'login') {
    return { name: 'home' };
  }
  return true;
});

router.afterEach(() => {
  NProgress.done();
});

router.onError(() => {
  NProgress.done();
});

export default router;
