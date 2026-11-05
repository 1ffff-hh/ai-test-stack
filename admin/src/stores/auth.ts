import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import type { User } from '@/api/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(false);
  const ready = ref(false);

  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  async function fetchMe() {
    loading.value = true;
    try {
      const data = await api.get<{ user: User | null }>('/auth/me');
      user.value = data.user;
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
      ready.value = true;
    }
  }

  async function login(account: string, password: string) {
    const data = await api.post<{ user: User }>('/auth/login', { account, password });
    user.value = data.user;
    return data.user;
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    user.value = null;
  }

  function clear() {
    user.value = null;
  }

  return { user, loading, ready, isAdmin, fetchMe, login, logout, clear };
});
