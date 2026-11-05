<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { api, errorMessage } from '@/api/client';
import type { PublishResult } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';
import { formatDateTime } from '@/utils/format';

const auth = useAuthStore();
const meta = useMetaStore();

const publishing = ref(false);
const output = ref('');
const lastRun = ref<string | null>(null);
const ok = ref<boolean | null>(null);

const account = reactive({ name: auth.user?.name || '' });
const password = reactive({ current: '', next: '', confirm: '' });
const savingAccount = ref(false);
const savingPassword = ref(false);

async function publish() {
  publishing.value = true;
  ok.value = null;
  output.value = '正在导出数据并重建静态站…';
  try {
    const result = await api.post<PublishResult>('/system/publish');
    ok.value = result.ok;
    output.value = result.ok
      ? `已导出：${(result.files || []).join(' · ')}\n\n${result.build || ''}`
      : result.msg || '发布失败';
    lastRun.value = new Date().toISOString();
    if (result.ok) {
      ElMessage.success('发布完成');
      await meta.load(true);
    } else {
      ElMessage.error('构建没通过，数据已回滚');
    }
  } catch (e) {
    ok.value = false;
    output.value = errorMessage(e);
    ElMessage.error('发布失败');
  } finally {
    publishing.value = false;
  }
}

async function saveName() {
  if (!account.name.trim()) return ElMessage.warning('昵称不能为空');
  savingAccount.value = true;
  try {
    await api.patch('/auth/me', { name: account.name.trim() });
    await auth.fetchMe();
    ElMessage.success('昵称已更新');
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    savingAccount.value = false;
  }
}

async function savePassword() {
  if (!password.current) return ElMessage.warning('请输入当前密码');
  if (password.next.length < 5) return ElMessage.warning('新密码至少 5 位');
  if (password.next !== password.confirm) return ElMessage.warning('两次输入的新密码不一致');

  savingPassword.value = true;
  try {
    await api.patch('/auth/me', {
      currentPassword: password.current,
      newPassword: password.next,
    });
    password.current = '';
    password.next = '';
    password.confirm = '';
    ElMessage.success('密码已更新，其他设备已退出登录');
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    savingPassword.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>发布与设置</h1>
        <p>发布会把库里的内容写回 <span class="mono">data/*.json</span> 并重建静态站。</p>
      </div>
    </div>

    <div style="display: grid; gap: 16px; max-width: 880px">
      <section class="panel">
        <div class="panel-head">
          <h2>发布到静态站</h2>
          <span class="sp" />
          <span v-if="lastRun" class="muted mono" style="font-size: 12px">
            上次：{{ formatDateTime(lastRun) }}
          </span>
        </div>
        <div class="panel-body publish-box">
          <div class="muted" style="font-size: 13px; line-height: 1.8">
            发布 = 导出数据 → 跑一遍构建校验 → 重建 <span class="mono">_site</span>。
            构建不过会自动把 <span class="mono">data/*.json</span> 回滚，站点不受影响。
            日常改内容不需要发布——前台是直接读库渲染的。
          </div>
          <div>
            <el-button type="primary" :icon="Upload" :loading="publishing" @click="publish">
              立即发布
            </el-button>
          </div>
          <pre v-if="output" class="console" :style="ok === false ? 'color:#ffb4a8' : ''">{{ output }}</pre>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>账号</h2></div>
        <div class="panel-body" style="display: grid; gap: 22px; max-width: 460px">
          <div>
            <div class="field-label">昵称</div>
            <div style="display: flex; gap: 10px">
              <el-input v-model="account.name" maxlength="30" />
              <el-button :loading="savingAccount" @click="saveName">保存</el-button>
            </div>
          </div>

          <el-divider style="margin: 0" />

          <div>
            <div class="field-label">修改密码</div>
            <div style="display: grid; gap: 10px">
              <el-input v-model="password.current" type="password" show-password placeholder="当前密码" />
              <el-input v-model="password.next" type="password" show-password placeholder="新密码（至少 5 位）" />
              <el-input v-model="password.confirm" type="password" show-password placeholder="再输一次新密码" />
              <div>
                <el-button type="primary" plain :loading="savingPassword" @click="savePassword">
                  更新密码
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>运行信息</h2></div>
        <div class="panel-body">
          <dl class="kv">
            <dt>接口地址</dt>
            <dd>/api/v1</dd>
            <dt>当前账号</dt>
            <dd>@{{ auth.user?.username }} · {{ auth.user?.role }}</dd>
            <dt>内容条目</dt>
            <dd>
              {{ meta.collections.map((c) => `${c.label} ${c.count}`).join(' · ') || '—' }}
            </dd>
            <dt>数据库</dt>
            <dd>server/.data/app.db（SQLite，不进仓库）</dd>
            <dt>重置密码</dt>
            <dd>npm run admin:reset</dd>
          </dl>
        </div>
      </section>
    </div>
  </div>
</template>
