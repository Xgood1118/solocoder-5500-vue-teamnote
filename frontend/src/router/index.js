import { createRouter, createWebHashHistory } from 'vue-router';
import { getToken } from '@/api/http';

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/Login.vue'), meta: { noAuth: true } },
  { path: '/invite/:token', name: 'invite', component: () => import('@/views/Invite.vue'), meta: { noAuth: true } },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/home',
    children: [
      { path: 'home', name: 'home', component: () => import('@/views/Home.vue') },
      { path: 'workspace/:wsId', name: 'workspace', component: () => import('@/views/Workspace.vue') },
      { path: 'workspace/:wsId/folder/:folderId', name: 'folder', component: () => import('@/views/Workspace.vue') },
      { path: 'workspace/:wsId/note/:noteId', name: 'note', component: () => import('@/views/NoteEditor.vue') },
      { path: 'workspace/:wsId/settings', name: 'ws-settings', component: () => import('@/views/WorkspaceSettings.vue') },
      { path: 'workspace/:wsId/search', name: 'search', component: () => import('@/views/SearchCenter.vue') },
      { path: 'workspace/:wsId/templates', name: 'templates', component: () => import('@/views/TemplateLibrary.vue') },
      { path: 'notifications', name: 'notifications', component: () => import('@/views/Notifications.vue') },
      { path: 'profile', name: 'profile', component: () => import('@/views/Profile.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to, from, next) => {
  const logged = !!getToken();
  if (to.meta.noAuth) { next(); return; }
  if (!logged) next({ name: 'login', query: { redirect: to.fullPath } });
  else next();
});

export default router;
