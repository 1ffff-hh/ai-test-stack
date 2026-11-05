<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import { api, errorMessage } from '@/api/client';
import type { ContentItem } from '@/api/types';
import { useMetaStore } from '@/stores/meta';
import { fromNow } from '@/utils/format';

const route = useRoute();
const meta = useMetaStore();

const collection = computed(() => String(route.params.collection || ''));
const label = computed(() => meta.labelOf(collection.value));

const items = ref<ContentItem[]>([]);
const loading = ref(false);
const keyword = ref('');
const page = ref(1);
const pageSize = 15;

const drawerOpen = ref(false);
const saving = ref(false);
const isNew = ref(false);
const draft = ref<Record<string, unknown>>({});
const jsonText = ref<Record<string, string>>({});
const jsonError = ref<Record<string, boolean>>({});
const dirty = ref(false);

const LONG_KEYS = new Set([
  'what', 'use', 'why', 'summary', 'tagline', 'pros', 'cons', 'risk', 'verdict',
  'quota', 'models', 'tools', 'note', 'desc', 'detail', 'body',
]);

type FieldKind = 'string' | 'text' | 'number' | 'boolean' | 'json';

function kindOf(key: string, value: unknown): FieldKind {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value && typeof value === 'object') return 'json';
  if (typeof value === 'string' && (value.length > 60 || value.includes('\n') || LONG_KEYS.has(key))) {
    return 'text';
  }
  return 'string';
}

const fields = computed(() =>
  Object.keys(draft.value)
    .filter((k) => k !== '_updatedAt')
    .map((key) => ({ key, kind: kindOf(key, draft.value[key]) })),
);

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((it) =>
    [it.id, it.name, it.tagline, it.summary, it.why, it.what]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
});

const paged = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filtered.value.slice(start, start + pageSize);
});

watch(keyword, () => {
  page.value = 1;
});

function summaryOf(it: ContentItem): string {
  const v = it.tagline || it.summary || it.why || it.what || '';
  return String(v).slice(0, 90);
}

async function load() {
  if (!collection.value) return;
  loading.value = true;
  try {
    const data = await api.get<{ items: ContentItem[] }>(`/content/${collection.value}`);
    items.value = data.items;
    page.value = 1;
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    loading.value = false;
  }
}

async function openNew() {
  try {
    const data = await api.get<{ template: Record<string, unknown> }>(
      `/content/${collection.value}`,
      { template: 1 },
    );
    draft.value = { id: '', ...data.template };
    isNew.value = true;
    prepareJson();
    dirty.value = false;
    drawerOpen.value = true;
  } catch (e) {
    ElMessage.error(errorMessage(e));
  }
}

function openEdit(item: ContentItem) {
  const copy = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
  delete copy._updatedAt;
  draft.value = copy;
  isNew.value = false;
  prepareJson();
  dirty.value = false;
  drawerOpen.value = true;
}

function prepareJson() {
  jsonText.value = {};
  jsonError.value = {};
  for (const [k, v] of Object.entries(draft.value)) {
    if (v && typeof v === 'object') jsonText.value[k] = JSON.stringify(v, null, 2);
  }
}

function onJsonInput(key: string) {
  dirty.value = true;
  try {
    draft.value[key] = JSON.parse(jsonText.value[key] || 'null');
    jsonError.value[key] = false;
  } catch {
    jsonError.value[key] = true;
  }
}

function onFieldInput(key: string, value: unknown) {
  draft.value[key] = value;
  dirty.value = true;
}

async function save() {
  if (jsonError.value && Object.values(jsonError.value).some(Boolean)) {
    ElMessage.error('有字段不是合法 JSON，先改好再保存');
    return;
  }

  const id = String(draft.value.id || '').trim();
  if (!id) {
    ElMessage.error('id 不能为空');
    return;
  }
  if (!String(draft.value.name || '').trim()) {
    ElMessage.error('name 不能为空——构建期会把它当成缺字段拦下来');
    return;
  }

  const payload: Record<string, unknown> = { ...draft.value, id };
  delete payload._updatedAt;

  saving.value = true;
  try {
    if (isNew.value) {
      await api.post(`/content/${collection.value}`, payload);
      ElMessage.success('已新建');
    } else {
      await api.put(`/content/${collection.value}/${encodeURIComponent(id)}`, payload);
      ElMessage.success('已保存');
    }
    dirty.value = false;
    drawerOpen.value = false;
    await Promise.all([load(), meta.load(true)]);
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    saving.value = false;
  }
}

async function remove(item: ContentItem, closeDrawer = false) {
  try {
    await ElMessageBox.confirm(`删除 ${item.id}？这个操作不能撤销。`, '删除条目', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/content/${collection.value}/${encodeURIComponent(item.id)}`);
    ElMessage.success('已删除');
    if (closeDrawer) {
      dirty.value = false;
      drawerOpen.value = false;
    }
    await Promise.all([load(), meta.load(true)]);
  } catch (e) {
    ElMessage.error(errorMessage(e));
  }
}

async function handleClose(done: () => void) {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('有未保存的修改，确定关闭？', '未保存', {
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑',
        type: 'warning',
      });
    } catch {
      return;
    }
  }
  done();
}

watch(
  collection,
  () => {
    void load();
  },
  { immediate: true },
);

onMounted(() => {
  void meta.load().catch(() => undefined);
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ label }}</h1>
        <p>
          {{ items.length }} 条 · 直接对应 <span class="mono">data/{{ collection }}.json</span> ·
          保存后前台刷新即生效
        </p>
      </div>
      <span class="sp" />
      <el-button :icon="Refresh" @click="load">刷新</el-button>
      <el-button type="primary" :icon="Plus" @click="openNew">新建</el-button>
    </div>

    <section class="panel">
      <div class="panel-body" style="padding-bottom: 8px">
        <div class="toolbar">
          <el-input
            v-model="keyword"
            placeholder="搜索 id / 名称 / 摘要"
            clearable
            style="max-width: 320px"
            :prefix-icon="Search"
          />
          <span class="sp" />
          <span class="muted" style="font-size: 12.5px">
            显示 {{ paged.length }} / {{ filtered.length }} 条
          </span>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="paged"
        row-key="id"
        @row-dblclick="openEdit"
        style="width: 100%"
      >
        <el-table-column prop="id" label="ID" width="150">
          <template #default="{ row }">
            <span class="mono">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="180">
          <template #default="{ row }">
            <b style="font-weight: 600">{{ row.name || '—' }}</b>
          </template>
        </el-table-column>
        <el-table-column label="摘要" min-width="320">
          <template #default="{ row }">
            <span class="muted">{{ summaryOf(row) || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="更新" width="110">
          <template #default="{ row }">
            <span class="mono muted">{{ fromNow(row._updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="" width="150" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="keyword ? '没有匹配的条目' : '这个集合还是空的'" :image-size="80" />
        </template>
      </el-table>

      <div style="display: flex; justify-content: flex-end; padding: 14px 18px">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="filtered.length"
          layout="prev, pager, next"
          background
          hide-on-single-page
        />
      </div>
    </section>

    <el-drawer
      v-model="drawerOpen"
      size="720px"
      :before-close="handleClose"
      :with-header="true"
      class="edit-drawer"
    >
      <template #header>
        <div class="drawer-head">
          <h3>{{ isNew ? `新建${label}` : draft.name || draft.id }}</h3>
          <div class="sub">{{ collection }} / {{ isNew ? '新条目' : draft.id }}</div>
        </div>
      </template>

      <div class="field-grid">
        <div
          v-for="f in fields"
          :key="f.key"
          class="field-box"
          :class="{ wide: f.kind === 'text' || f.kind === 'json' }"
        >
          <div class="field-label">
            {{ f.key }}
            <span class="type">{{ f.kind }}</span>
            <span v-if="f.key === 'id' && !isNew" class="type">主键，不可改</span>
          </div>

          <el-input
            v-if="f.kind === 'string'"
            :model-value="String(draft[f.key] ?? '')"
            :disabled="f.key === 'id' && !isNew"
            @update:model-value="(v: string) => onFieldInput(f.key, v)"
          />

          <el-input
            v-else-if="f.kind === 'text'"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 12 }"
            :model-value="String(draft[f.key] ?? '')"
            @update:model-value="(v: string) => onFieldInput(f.key, v)"
          />

          <el-input-number
            v-else-if="f.kind === 'number'"
            :model-value="Number(draft[f.key] ?? 0)"
            :controls="false"
            style="width: 100%"
            @update:model-value="(v: number | undefined) => onFieldInput(f.key, v ?? 0)"
          />

          <el-switch
            v-else-if="f.kind === 'boolean'"
            :model-value="Boolean(draft[f.key])"
            @update:model-value="(v: string | number | boolean) => onFieldInput(f.key, Boolean(v))"
          />

          <div v-else :class="{ 'json-bad': jsonError[f.key] }">
            <el-input
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 18 }"
              :model-value="jsonText[f.key] || ''"
              @update:model-value="
                (v: string) => {
                  jsonText[f.key] = v;
                  onJsonInput(f.key);
                }
              "
            />
            <div v-if="jsonError[f.key]" style="color: var(--ats-danger); font-size: 12px; margin-top: 4px">
              JSON 格式不对
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="drawer-foot">
          <el-button
            v-if="!isNew"
            type="danger"
            plain
            @click="remove({ id: String(draft.id), name: String(draft.name || '') }, true)"
          >
            删除
          </el-button>
          <span class="sp" />
          <el-button @click="drawerOpen = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>
