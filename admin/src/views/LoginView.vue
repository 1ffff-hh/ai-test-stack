<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/api/client';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const formRef = ref<FormInstance>();
const form = reactive({ email: '', password: '' });
const loading = ref(false);
const denied = route.query.denied === '1';

const rules: FormRules = {
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const user = await auth.login(form.email.trim(), form.password);
    if (user.role !== 'ADMIN') {
      await auth.logout();
      ElMessage.error('这个账号不是管理员');
      return;
    }
    ElMessage.success(`欢迎回来，${user.name}`);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-brand">
      <div class="mark"><i /> AI Test Stack</div>

      <div>
        <h1>内容后台</h1>
        <p>
          改工具、套餐和组合，发布到静态站。数据存在本地 SQLite，前台刷新就能看到最新内容。
        </p>
        <ul>
          <li>内容条目直接对应 data/*.json，发布前自动跑一遍构建校验</li>
          <li>用户、角色、封禁都在这里管理，操作留痕可查</li>
          <li>构建失败自动回滚，不会把线上数据改坏</li>
        </ul>
      </div>

      <footer>AI Test Stack · 内容管理后台</footer>
    </section>

    <section class="login-form-wrap">
      <div class="login-card">
        <h2>登录</h2>
        <p class="sub">用管理员邮箱和密码进入</p>

        <el-alert
          v-if="denied"
          type="warning"
          :closable="false"
          show-icon
          title="当前账号没有管理员权限"
          style="margin-bottom: 18px"
        />

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="form.email" placeholder="admin@localhost" autocomplete="username" size="large" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="••••••••"
              autocomplete="current-password"
              size="large"
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-button class="submit" type="primary" :loading="loading" @click="submit">
            进入后台
          </el-button>
        </el-form>

        <div class="login-hint">
          忘记密码：在项目根目录运行 <b class="mono">npm run admin:reset</b>，会在终端打印一个新密码。
        </div>
      </div>
    </section>
  </div>
</template>
