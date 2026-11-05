<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, errorMessage } from '@/api/client';
import type { AuditLog, Stats } from '@/api/types';
import { fromNow } from '@/utils/format';
import { ElMessage } from 'element-plus';

const stats = ref<Stats | null>(null);
const logs = ref<AuditLog[]>([]);
const loading = ref(true);

const totalContent = computed(
  () => stats.value?.collections.reduce((sum, c) => sum + c.count, 0) ?? 0,
);

async function load() {
  loading.value = true;
  try {
    const [s, l] = await Promise.all([
      api.get<Stats>('/system/stats'),
      api.get<{ items: AuditLog[] }>('/system/logs', { limit: 8 }),
    ]);
    stats.value = s;
    logs.value = l.items;
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h1>概览</h1>
        <p>库里的实时状态。改完内容不用发布，前台刷新就能看到。</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <div class="label"><el-icon><User /></el-icon> 注册用户</div>
        <div class="value">{{ stats?.users ?? '—' }}</div>
        <div class="hint">{{ stats?.admins ?? 0 }} 个管理员</div>
      </div>
      <div class="stat accent">
        <div class="label"><el-icon><Files /></el-icon> 内容条目</div>
        <div class="value">{{ totalContent }}</div>
        <div class="hint">
          {{ stats?.collections.map((c) => `${c.label} ${c.count}`).join(' · ') || '—' }}
        </div>
      </div>
      <div class="stat">
        <div class="label"><el-icon><Key /></el-icon> 活跃会话</div>
        <div class="value">{{ stats?.sessions ?? '—' }}</div>
        <div class="hint">未过期的登录会话</div>
      </div>
      <div class="stat">
        <div class="label"><el-icon><Star /></el-icon> 收藏</div>
        <div class="value">{{ stats?.favorites ?? '—' }}</div>
        <div class="hint">登录用户跨设备同步</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px" class="dash-grid">
      <section class="panel">
        <div class="panel-head">
          <h2>最近操作</h2>
          <span class="sp" />
          <router-link :to="{ name: 'logs' }" class="muted" style="font-size: 12.5px">全部日志 →</router-link>
        </div>
        <div class="panel-body" style="padding: 6px 20px 16px">
          <el-empty v-if="!logs.length" description="还没有操作记录" :image-size="72" />
          <div v-for="log in logs" :key="log.id" class="log-row">
            <span class="log-action" :class="{ danger: log.action.includes('delete') || log.action.includes('failed') }">
              {{ log.action }}
            </span>
            <span class="log-target">{{ log.target || '—' }}</span>
            <span class="sp" />
            <span class="muted mono">{{ fromNow(log.createdAt) }}</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>内容分布</h2></div>
        <div class="panel-body" style="padding: 10px 20px 18px">
          <router-link
            v-for="c in stats?.collections || []"
            :key="c.key"
            class="dist-row"
            :to="{ name: 'content', params: { collection: c.key } }"
          >
            <span>{{ c.label }}</span>
            <span class="mono muted">{{ c.count }} 条</span>
            <el-icon><ArrowRight /></el-icon>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dash-grid {
  align-items: start;
}

@media (max-width: 1080px) {
  .dash-grid {
    grid-template-columns: 1fr !important;
  }
}

.log-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ats-line);
  font-size: 13px;
}

.log-row:last-child {
  border-bottom: 0;
}

.log-target {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ats-dim);
}

.log-row .sp {
  flex: 1;
}

.dist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid var(--ats-line);
  color: var(--ats-text);
  font-size: 13.5px;
}

.dist-row:last-child {
  border-bottom: 0;
}

.dist-row .mono {
  margin-left: auto;
}

.dist-row:hover {
  color: var(--ats-act);
}
</style>
