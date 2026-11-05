<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import { api, errorMessage } from '@/api/client';
import type { Paged, User } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime } from '@/utils/format';

const auth = useAuthStore();

const items = ref<User[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const data = await api.get<Paged<User>>('/users', {
      q: keyword.value.trim() || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    items.value = data.items;
    total.value = data.total;
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  void load();
}

async function patch(user: User, body: Record<string, unknown>, okText: string) {
  try {
    await api.patch(`/users/${user.id}`, body);
    ElMessage.success(okText);
    await load();
  } catch (e) {
    ElMessage.error(errorMessage(e));
  }
}

async function toggleRole(user: User) {
  const next = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
  const verb = next === 'ADMIN' ? '设为管理员' : '取消管理员';
  try {
    await ElMessageBox.confirm(`确定把 @${user.username} ${verb}？`, verb, {
      confirmButtonText: verb,
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await patch(user, { role: next }, `已${verb}`);
}

async function toggleStatus(user: User) {
  const next = user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
  const verb = next === 'BANNED' ? '停用' : '恢复';
  try {
    await ElMessageBox.confirm(
      next === 'BANNED'
        ? `停用后 @${user.username} 会立刻掉线，且无法再登录。`
        : `恢复 @${user.username} 的登录权限？`,
      `${verb}账号`,
      { confirmButtonText: verb, cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  await patch(user, { status: next }, `已${verb}`);
}

async function remove(user: User) {
  try {
    await ElMessageBox.confirm(
      `删除 @${user.username}？该用户的会话和收藏会一起删除，不能撤销。`,
      '删除用户',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await api.delete(`/users/${user.id}`);
    ElMessage.success('已删除');
    await load();
  } catch (e) {
    ElMessage.error(errorMessage(e));
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>用户</h1>
        <p>注册用户、角色和状态。停用会立刻让该用户所有会话失效。</p>
      </div>
      <span class="sp" />
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <section class="panel">
      <div class="panel-body" style="padding-bottom: 8px">
        <div class="toolbar">
          <el-input
            v-model="keyword"
            placeholder="搜索账号 / 邮箱 / 昵称"
            clearable
            :prefix-icon="Search"
            style="max-width: 320px"
            @keyup.enter="search"
            @clear="search"
          />
          <el-button @click="search">搜索</el-button>
          <span class="sp" />
          <span class="muted" style="font-size: 12.5px">共 {{ total }} 人</span>
        </div>
      </div>

      <el-table v-loading="loading" :data="items" row-key="id" style="width: 100%">
        <el-table-column prop="id" label="#" width="64">
          <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
        </el-table-column>
        <el-table-column label="账号" min-width="150">
          <template #default="{ row }"><b class="mono" style="font-weight: 600">@{{ row.username }}</b></template>
        </el-table-column>
        <el-table-column prop="name" label="昵称" min-width="130" />
        <el-table-column label="邮箱" min-width="200">
          <template #default="{ row }">
            <span v-if="row.email" class="mono">{{ row.email }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag :type="row.role === 'ADMIN' ? 'success' : 'info'" effect="light" size="small">
              {{ row.role === 'ADMIN' ? '管理员' : '用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'danger'" effect="plain" size="small">
              {{ row.status === 'ACTIVE' ? '正常' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="150">
          <template #default="{ row }">
            <span class="mono muted">{{ formatDateTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="" width="210" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="toggleRole(row)">
              {{ row.role === 'ADMIN' ? '取消管理员' : '设为管理员' }}
            </el-button>
            <el-button link :type="row.status === 'ACTIVE' ? 'warning' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 'ACTIVE' ? '停用' : '恢复' }}
            </el-button>
            <el-button
              link
              type="danger"
              :disabled="row.id === auth.user?.id"
              @click="remove(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有用户" :image-size="80" />
        </template>
      </el-table>

      <div style="display: flex; justify-content: flex-end; padding: 14px 18px">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="search"
        />
      </div>
    </section>
  </div>
</template>
