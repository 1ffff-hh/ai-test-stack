<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import { api, errorMessage } from '@/api/client';
import type { AuditLog } from '@/api/types';
import { formatDateTime } from '@/utils/format';

const logs = ref<AuditLog[]>([]);
const loading = ref(false);
const keyword = ref('');

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return logs.value;
  return logs.value.filter((l) =>
    [l.action, l.target, l.user?.email, l.user?.name, l.ip]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
});

function isDanger(action: string) {
  return action.includes('delete') || action.includes('failed') || action.includes('banned');
}

async function load() {
  loading.value = true;
  try {
    const data = await api.get<{ items: AuditLog[] }>('/system/logs', { limit: 100 });
    logs.value = data.items;
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>操作日志</h1>
        <p>登录、改内容、改用户、发布，最近 100 条。</p>
      </div>
      <span class="sp" />
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <section class="panel">
      <div class="panel-body" style="padding-bottom: 8px">
        <div class="toolbar">
          <el-input
            v-model="keyword"
            placeholder="搜索动作 / 目标 / 操作人"
            clearable
            :prefix-icon="Search"
            style="max-width: 340px"
          />
          <span class="sp" />
          <span class="muted" style="font-size: 12.5px">{{ filtered.length }} 条</span>
        </div>
      </div>

      <el-table v-loading="loading" :data="filtered" row-key="id" style="width: 100%">
        <el-table-column label="时间" width="150">
          <template #default="{ row }">
            <span class="mono muted">{{ formatDateTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="动作" width="190">
          <template #default="{ row }">
            <span class="log-action" :class="{ danger: isDanger(row.action) }">{{ row.action }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="200">
          <template #default="{ row }">
            <span v-if="row.user">{{ row.user.name }} <span class="muted mono">{{ row.user.email }}</span></span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="目标" min-width="220">
          <template #default="{ row }">
            <span class="mono">{{ row.target || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="详情" min-width="240">
          <template #default="{ row }">
            <span class="log-detail" :title="row.detail || ''">{{ row.detail || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="IP" width="130">
          <template #default="{ row }"><span class="mono muted">{{ row.ip || '—' }}</span></template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有日志" :image-size="80" />
        </template>
      </el-table>
    </section>
  </div>
</template>
