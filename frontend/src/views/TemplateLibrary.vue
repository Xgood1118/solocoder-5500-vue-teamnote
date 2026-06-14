<template>
  <div class="content-wrap">
    <div class="card">
      <div class="flex items-center justify-between mb-16">
        <h2 class="page-title" style="margin:0;">📚 模板库</h2>
        <el-button type="primary" @click="showCreate = true">
          <el-icon style="margin-right:4px;"><Plus /></el-icon> 新建模板
        </el-button>
      </div>
      <div v-for="(list, cat) in groups" :key="cat" style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px 0;font-size:15px;color:#374151;display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:4px;height:18px;background:#4f46e5;border-radius:2px;"></span>
          {{ cat }}
          <span class="text-sm text-muted">（{{ list.length }}）</span>
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">
          <div v-for="t in list" :key="t.id" class="tpl-card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="font-size:32px;">{{ t.icon }}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;" class="truncate">{{ t.name }}</div>
                <div class="text-sm text-muted">{{ t.category }}</div>
              </div>
              <el-dropdown v-if="!t.isSystem" @command="(c) => tplCmd(c, t)">
                <el-button size="small" link>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" style="color:#ef4444;">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="tpl-preview mark-block">
              <div style="display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden;">{{ previewText(t.content) }}</div>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;">
              <el-button size="small" type="primary" style="flex:1;" @click="useTemplate(t)">
                <el-icon style="margin-right:4px;"><DocumentAdd /></el-icon> 使用模板
              </el-button>
              <el-button size="small" @click="preview(t)">预览</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showCreate" :title="editTpl.id ? '编辑模板' : '新建模板'" width="640px">
      <el-form :model="editTpl" label-width="80px">
        <el-form-item label="图标">
          <div class="flex gap-8" style="flex-wrap:wrap;">
            <div v-for="i in tplIcons" :key="i" @click="editTpl.icon = i"
              style="width:38px;height:38px;border:2px solid;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;font-size:20px;"
              :style="editTpl.icon === i ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
            >{{ i }}</div>
          </div>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editTpl.name" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editTpl.category" allow-create filterable style="width:100%;">
            <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <el-input v-model="editTpl.content" type="textarea" :rows="14" placeholder="支持 Markdown 语法..." />
            <div class="tpl-preview mark-block" style="max-height:330px;overflow-y:auto;padding:12px;border:1px solid #f1f5f9;border-radius:8px;background:#fff;" v-html="markdown(editTpl.content)"></div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="submitTpl">{{ editTpl.id ? '保存修改' : '创建模板' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPreview" :title="previewTpl?.name" width="720px">
      <div class="mark-block" style="padding:12px;" v-html="markdown(previewTpl?.content || '')"></div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, MoreFilled, DocumentAdd } from '@element-plus/icons-vue';
import { templateApi, noteApi } from '@/api';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const route = useRoute();
const router = useRouter();
const wsId = computed(() => route.params.wsId);
const groups = ref({});
const all = ref([]);
const showCreate = ref(false);
const showPreview = ref(false);
const previewTpl = ref(null);
const editTpl = reactive({ id: null, name: '', icon: '📄', category: '自定义', content: '' });
const tplIcons = ['📄','📊','📈','📝','💡','🎯','🚀','🧪','📚','⚙️','🗂️','🤝','📅','✅','🔥'];
const categoryOptions = ['定期报告','会议','产品','技术','项目','自定义'];

function previewText(c) { return (c || '').replace(/[#>*_`~\-\[\]]/g, ''); }
function markdown(s) {
  try { return DOMPurify.sanitize(marked.parse(s || '', { breaks: true, gfm: true })); }
  catch (e) { return s || ''; }
}
async function load() {
  const d = await templateApi.list();
  all.value = d.items || [];
  groups.value = d.groups || {};
}
function preview(t) { previewTpl.value = t; showPreview.value = true; }
function useTemplate(t) {
  if (!wsId.value) return ElMessage.warning('请先选择工作空间');
  ElMessageBox.prompt('请输入笔记标题', '使用模板', { inputValue: t.name + ' - ' + new Date().toLocaleDateString(), })
    .then(async ({ value }) => {
      const d = await noteApi.create({ workspaceId: wsId.value, title: value, templateId: t.id });
      ElMessage.success('已创建');
      router.push({ name: 'note', params: { wsId: wsId.value, noteId: d.note.id } });
    })
    .catch(() => {});
}
function tplCmd(cmd, t) {
  if (cmd === 'edit') {
    Object.assign(editTpl, t);
    showCreate.value = true;
  } else if (cmd === 'delete') {
    ElMessageBox.confirm(`确认删除模板 "${t.name}"？`, '提示', { type: 'warning' })
      .then(async () => { await templateApi.remove(t.id); ElMessage.success('已删除'); load(); })
      .catch(() => {});
  }
}
async function submitTpl() {
  if (!editTpl.name || !editTpl.content) return ElMessage.warning('请填写名称和内容');
  if (editTpl.id) {
    await templateApi.update(editTpl.id, editTpl);
  } else {
    await templateApi.create(editTpl);
  }
  ElMessage.success('已保存');
  showCreate.value = false;
  Object.assign(editTpl, { id: null, name: '', icon: '📄', category: '自定义', content: '' });
  load();
}
onMounted(load);
</script>

<style scoped>
.tpl-card {
  border:1px solid #eaeef2;
  border-radius:10px;
  padding:14px;
  background:#fff;
  transition:all 0.15s;
}
.tpl-card:hover {
  box-shadow:0 4px 14px rgba(0,0,0,0.06);
  transform:translateY(-1px);
  border-color:#c7d2fe;
}
.tpl-preview {
  background:#f9fafb;
  border-radius:6px;
  padding:8px 10px;
  font-size:12px;
  line-height:1.6;
  color:#475569;
}
</style>
