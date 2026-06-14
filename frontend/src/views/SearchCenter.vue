<template>
  <div class="content-wrap">
    <div class="card">
      <h2 class="page-title" style="margin-top:0;">🔍 搜索中心</h2>
      <div style="display:flex;gap:10px;align-items:stretch;">
        <el-input v-model="q" placeholder="搜索标题、内容、标签..." size="large" clearable @keyup.enter="doSearch" @input="onInput">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" size="large" @click="doSearch">
          <el-icon style="margin-right:4px;"><Search /></el-icon>搜索
        </el-button>
      </div>

      <div v-if="!q" style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <h4 style="margin:0 0 10px 0;">⏰ 搜索历史</h4>
          <div v-if="history.length" style="display:flex;flex-wrap:wrap;gap:8px;">
            <el-tag v-for="h in history" :key="h.id" style="cursor:pointer;" closable @click="q = h.query; doSearch();" @close="clearHist(h.id)">
              {{ h.query }}
            </el-tag>
          </div>
          <div v-else class="text-muted text-sm">暂无搜索历史</div>
          <div style="margin-top:10px;">
            <el-button size="small" link type="danger" @click="clearAllHist">清空历史</el-button>
          </div>
        </div>
        <div>
          <h4 style="margin:0 0 10px 0;">🔥 热门搜索词</h4>
          <div v-if="hot.length" style="display:flex;flex-wrap:wrap;gap:8px;">
            <el-tag v-for="h in hot" :key="h.term" type="warning" style="cursor:pointer;" @click="q = h.term; doSearch();">
              {{ h.term }} <span style="opacity:0.6;">×{{ h.count }}</span>
            </el-tag>
          </div>
          <div v-else class="text-muted text-sm">暂无热门词</div>
        </div>
      </div>

      <div v-if="!q" style="margin-top:20px;">
        <h4 style="margin:0 0 10px 0;">🏷️ 标签库</h4>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <el-tag v-for="t in tags" :key="t.id" effect="dark" :color="t.color" style="cursor:pointer;" size="large" @click="q = t.name; doSearch();">
            {{ t.name }} <span style="opacity:0.7;margin-left:4px;">{{ t.usageCount }}</span>
          </el-tag>
        </div>
      </div>

      <div v-if="q && !loading" style="margin-top:20px;">
        <div class="flex items-center justify-between mb-16">
          <div class="text-sm text-muted">找到 {{ results.total }} 条结果（用时 {{ costMs }}ms）</div>
        </div>
        <div v-if="results.items.length" style="display:flex;flex-direction:column;gap:10px;">
          <div v-for="r in results.items" :key="r.id" class="search-result card" @click="gotoNote(r.id)">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:16px;" v-html="r.highlights?.title || escapeHtml(r.title)"></div>
                <div v-if="r.highlights?.tags" style="margin-top:4px;" class="text-sm">标签：<span v-html="r.highlights.tags"></span></div>
                <div v-if="r.highlights?.content" class="mark-block mt-8" v-html="r.highlights.content"></div>
              </div>
              <div class="text-sm text-muted" style="flex-shrink:0;text-align:right;">
                <div>相关度 {{ (r.score).toFixed(2) }}</div>
                <div>{{ formatDate(r.updatedAt) }}</div>
                <div>更新者：{{ users[r.updatedBy]?.name || '?' }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="icon">🤷</div>
          <div class="text">没有找到相关结果，试试其他关键词</div>
        </div>
      </div>
      <div v-if="loading" class="empty-state">
        <el-icon style="font-size:32px;animation:spin 1s linear infinite;"><Loading /></el-icon>
        <div class="text mt-8">搜索中...</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { searchApi, tagApi } from '@/api';

const route = useRoute();
const router = useRouter();
const wsId = computed(() => route.params.wsId);
const q = ref(route.query.q || '');
const loading = ref(false);
const results = reactive({ total: 0, items: [], users: {} });
const users = computed(() => results.users);
const history = ref([]);
const hot = ref([]);
const tags = ref([]);
const costMs = ref(0);

let inputTimer = null;
function onInput() {
  clearTimeout(inputTimer);
  inputTimer = setTimeout(doSearch, 350);
}
function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}

async function doSearch() {
  if (!q.value.trim()) { await loadSide(); return; }
  loading.value = true;
  const t0 = Date.now();
  try {
    const d = await searchApi.search({ q: q.value, workspaceId: wsId.value, limit: 50 });
    results.total = d.total;
    results.items = d.items;
    results.users = d.users || {};
    costMs.value = Date.now() - t0;
  } finally {
    loading.value = false;
  }
}
async function loadSide() {
  const [h1, h2, h3] = await Promise.all([
    searchApi.history(wsId.value),
    searchApi.hot(wsId.value),
    tagApi.list(wsId.value),
  ]);
  history.value = h1.items || [];
  hot.value = h2.items || [];
  tags.value = h3.items || [];
}
async function clearHist(id) {
  await searchApi.clearHistory(wsId.value);
  ElMessage.success('已清空');
  loadSide();
}
async function clearAllHist() {
  await searchApi.clearHistory(wsId.value);
  ElMessage.success('已清空');
  loadSide();
}
function gotoNote(id) { router.push({ name: 'note', params: { wsId: wsId.value, noteId: id } }); }

watch(() => route.query.q, (v) => { if (v) { q.value = v; doSearch(); } }, { immediate: true });
onMounted(loadSide);
</script>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
.search-result {
  transition: all 0.15s;
  cursor: pointer;
  border:1px solid #eaeef2;
  border-radius:10px;
  padding:14px;
}
.search-result:hover {
  border-color:#c7d2fe;
  background:#fafbff;
  box-shadow:0 4px 12px rgba(79,70,229,0.08);
}
</style>
