<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';

const auth = useAuthStore();
const meta = useMetaStore();
const route = useRoute();
const router = useRouter();

const iconOf: Record<string, string> = {
  tools: 'Grid',
  plans: 'PriceTag',
  bundles: 'Collection',
};

const crumbs = computed(() => {
  if (route.name === 'content') {
    return ['内容', meta.labelOf(String(route.params.collection))];
  }
  return [String(route.meta.title || '')];
});

const initial = computed(() => (auth.user?.name || auth.user?.username || '?').slice(0, 1).toUpperCase());

onMounted(() => {
  void meta.load().catch(() => undefined);
});

async function logout() {
  try {
    await ElMessageBox.confirm('确定退出登录？', '退出', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await auth.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <aside class="side">
      <div class="brand"><i /><span>AI Test Stack</span></div>

      <div class="group">总览</div>
      <router-link class="item" :class="{ on: route.name === 'dashboard' }" :to="{ name: 'dashboard' }">
        <el-icon><Odometer /></el-icon>
        <span>概览</span>
      </router-link>

      <div class="group">内容</div>
      <router-link
        v-for="c in meta.collections"
        :key="c.key"
        class="item"
        :class="{ on: route.name === 'content' && route.params.collection === c.key }"
        :to="{ name: 'content', params: { collection: c.key } }"
      >
        <el-icon><component :is="iconOf[c.key] || 'Document'" /></el-icon>
        <span>{{ c.label }}</span>
        <span class="count">{{ c.count }}</span>
      </router-link>

      <div class="group">系统</div>
      <router-link class="item" :class="{ on: route.name === 'users' }" :to="{ name: 'users' }">
        <el-icon><User /></el-icon>
        <span>用户</span>
      </router-link>
      <router-link class="item" :class="{ on: route.name === 'logs' }" :to="{ name: 'logs' }">
        <el-icon><Tickets /></el-icon>
        <span>操作日志</span>
      </router-link>
      <router-link class="item" :class="{ on: route.name === 'settings' }" :to="{ name: 'settings' }">
        <el-icon><Upload /></el-icon>
        <span>发布与设置</span>
      </router-link>

      <div class="foot">
        数据存在本地 SQLite<br />
        发布后写入 data/*.json
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="crumb">
          <template v-for="(c, i) in crumbs" :key="c">
            <span v-if="i > 0">/</span>
            <b v-if="i === crumbs.length - 1">{{ c }}</b>
            <span v-else>{{ c }}</span>
          </template>
        </div>
        <span class="sp" />

        <el-dropdown trigger="click">
          <div class="user-chip">
            <span class="avatar">{{ initial }}</span>
            <span class="who">
              {{ auth.user?.name }}
              <span>@{{ auth.user?.username }}</span>
            </span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>@{{ auth.user?.username }}</el-dropdown-item>
              <el-dropdown-item divided @click="logout">
                <el-icon><SwitchButton /></el-icon> 退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>
