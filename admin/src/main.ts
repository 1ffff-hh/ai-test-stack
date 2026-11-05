import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

import 'element-plus/dist/index.css';
import '@/styles/index.css';

import App from './App.vue';
import router from './router';
import { onUnauthorized } from './api/client';
import { useAuthStore } from './stores/auth';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component);
}

onUnauthorized(() => {
  const auth = useAuthStore();
  auth.clear();
  if (router.currentRoute.value.name !== 'login') {
    void router.replace({ name: 'login' });
  }
});

app.mount('#app');
