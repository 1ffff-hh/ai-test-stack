import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { CollectionInfo, Stats } from '@/api/types';

export const useMetaStore = defineStore('meta', () => {
  const collections = ref<CollectionInfo[]>([]);
  const stats = ref<Stats | null>(null);
  const loaded = ref(false);

  async function load(force = false) {
    if (loaded.value && !force) return;
    stats.value = await api.get<Stats>('/system/stats');
    collections.value = stats.value.collections;
    loaded.value = true;
  }

  function labelOf(key: string) {
    return collections.value.find((c) => c.key === key)?.label || key;
  }

  return { collections, stats, loaded, load, labelOf };
});
