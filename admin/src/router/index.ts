import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '概览' },
        },
        {
          path: 'content/:collection',
          name: 'content',
          component: () => import('@/views/ContentView.vue'),
          meta: { title: '内容' },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: { title: '用户' },
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/LogsView.vue'),
          meta: { title: '操作日志' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: '发布与设置' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();

  if (to.meta.public) {
    if (auth.user && to.name === 'login') return { name: 'dashboard' };
    return true;
  }

  if (!auth.user) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  }
  if (!auth.isAdmin) {
    return { name: 'login', query: { denied: '1' } };
  }
  return true;
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) || '';
  document.title = title ? `${title} · AI Test Stack 后台` : 'AI Test Stack 后台';
});

export default router;
