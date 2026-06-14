import { defineStore } from 'pinia';
import { authApi, notificationApi } from '@/api';
import { setToken, clearToken, getToken } from '@/api/http';
import router from '@/router';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: null,
    user: null,
    unreadCount: 0,
  }),
  getters: {
    isLoggedIn: (s) => !!s.user && !!s.token,
  },
  actions: {
    async login(payload) {
      const data = await authApi.login(payload);
      setToken(data.token);
      this.token = data.token;
      this.user = data.user;
      await this.loadNotificationsCount();
      return data;
    },
    async register(payload) {
      const data = await authApi.register(payload);
      setToken(data.token);
      this.token = data.token;
      this.user = data.user;
      return data;
    },
    async loginWithInvite(payload) {
      const data = await authApi.loginInvite(payload);
      setToken(data.token);
      this.token = data.token;
      this.user = data.user;
      return data;
    },
    async restoreSession() {
      const t = getToken();
      if (!t) {
        if (!location.hash.includes('/login') && !location.hash.includes('/invite')) {
          router.replace('/login');
        }
        return false;
      }
      this.token = t;
      try {
        const data = await authApi.profile();
        this.user = data.user;
        this.unreadCount = data.unreadNotifications || 0;
        return true;
      } catch (e) {
        clearToken();
        this.token = null;
        this.user = null;
        if (!location.hash.includes('/login')) router.replace('/login');
        return false;
      }
    },
    async updateProfile(payload) {
      const d = await authApi.updateProfile(payload);
      this.user = d.user;
      return d;
    },
    async loadNotificationsCount() {
      try {
        const d = await notificationApi.list({ limit: 1 });
        this.unreadCount = d.unreadCount || 0;
      } catch (e) {}
    },
    decUnread() { if (this.unreadCount > 0) this.unreadCount--; },
    logout() {
      clearToken();
      this.token = null;
      this.user = null;
      this.unreadCount = 0;
      router.replace('/login');
    },
  },
});
