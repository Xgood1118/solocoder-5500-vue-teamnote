<template>
  <div class="content-wrap" style="max-width:none;">
    <div v-if="workspace" class="flex items-center justify-between mb-16">
      <div>
        <h2 class="page-title" style="margin-bottom:4px;">
          <span style="font-size:28px;">{{ workspace.icon }}</span>
          {{ workspace.name }}
        </h2>
        <p class="text-muted text-sm" style="margin:0;">{{ workspace.description || '暂无描述' }} · {{ stats.folders }} 个文件夹 · {{ stats.notes }} 篇笔记</p>
      </div>
      <div class="flex gap-8">
        <el-dropdown @command="onWsCmd">
          <el-button type="primary" plain>
            <el-icon style="margin-right:4px;"><MoreFilled /></el-icon> 工作空间
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="createFolder">
                <el-icon style="margin-right:6px;"><FolderAdd /></el-icon> 新建文件夹
              </el-dropdown-item>
              <el-dropdown-item command="import">
                <el-icon style="margin-right:6px;"><UploadFilled /></el-icon> 导入 Markdown/Docx
              </el-dropdown-item>
              <el-dropdown-item command="templates">
                <el-icon style="margin-right:6px;"><CollectionTag /></el-icon> 模板库
              </el-dropdown-item>
              <el-dropdown-item command="settings" divided>
                <el-icon style="margin-right:6px;"><Setting /></el-icon> 工作空间设置
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="5">
        <div class="card" style="padding:12px;min-height:500px;">
          <div class="flex items-center justify-between" style="padding:8px 12px;">
            <span style="font-weight:600;">目录</span>
            <el-button size="small" link type="primary" @click="createFolder">
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>
          <div style="border-top:1px solid #f1f5f9;padding-top:8px;">
            <div
              v-for="f in tree.folders" :key="f.id"
              class="folder-item"
              :class="{ active: currentFolderId === f.id }"
              @click="gotoFolder(f.id)"
            >
              <el-icon style="color:#f59e0b;"><Folder /></el-icon>
              <span class="flex-1 truncate">{{ f.name }}</span>
              <span class="text-muted text-sm">{{ f.noteCount || 0 }}</span>
            </div>
            <div
              class="folder-item"
              :class="{ active: !currentFolderId && !inNoteView }"
              @click="gotoRoot"
              style="margin-top:8px;background:#f8fafc;border-radius:8px;"
            >
              <el-icon style="color:#64748b;"><Collection /></el-icon>
              <span class="flex-1 truncate">全部笔记</span>
              <span class="text-muted text-sm">{{ stats.notes }}</span>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :span="19">
        <div class="card" style="min-height:500px;">
          <div class="flex items-center justify-between mb-16">
            <div>
              <div v-if="currentFolder" class="flex items-center gap-8">
                <span style="font-size:22px;">{{ currentFolder.icon || '📁' }}</span>
                <h3 style="margin:0;font-size:18px;">{{ currentFolder.name }}</h3>
              </div>
              <h3 v-else style="margin:0;font-size:18px;">📚 所有笔记</h3>
              <div class="text-sm text-muted mt-8">{{ currentNotes.length }} 篇笔记</div>
            </div>
            <div class="flex gap-8">
              <el-button @click="openImport">
                <el-icon style="margin-right:4px;"><Upload /></el-icon> 导入
              </el-button>
              <el-button type="primary" @click="openCreateNote">
                <el-icon style="margin-right:4px;"><Plus /></el-icon> 新建笔记
              </el-button>
            </div>
          </div>

          <el-tabs v-model="tab" @tab-change="reload">
            <el-tab-pane label="最近编辑" name="updated" />
            <el-tab-pane label="创建时间" name="created" />
            <el-tab-pane label="标题排序" name="title" />
          </el-tabs>

          <div v-if="currentNotes.length" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
            <div v-for="n in currentNotes" :key="n.id" class="note-card" @click="gotoNote(n.id)">
              <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
                <div style="font-weight:600;font-size:15px;flex:1;" class="truncate">{{ n.title || '未命名笔记' }}</div>
                <el-dropdown @command="(cmd) => onNoteCmd(cmd, n)">
                  <el-button size="small" link style="margin:-6px;">
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="rename">重命名</el-dropdown-item>
                      <el-dropdown-item command="move">移动</el-dropdown-item>
                      <el-dropdown-item command="export">导出</el-dropdown-item>
                      <el-dropdown-item command="delete" style="color:#ef4444;">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div class="text-sm text-muted mt-8" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:38px;line-height:1.6;">
                {{ previewText(n) }}
              </div>
              <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
                <div class="flex gap-8 flex-wrap">
                  <el-tag v-for="t in (n.tags || []).slice(0,3)" :key="t" size="small" effect="plain">{{ t }}</el-tag>
                </div>
                <div class="text-sm text-muted">{{ formatDate(n.updatedAt) }}</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <div class="icon">📝</div>
            <div class="text">还没有笔记，点击右上角按钮创建第一篇吧</div>
            <div style="margin-top:16px;">
              <el-button type="primary" @click="openCreateNote">+ 新建笔记</el-button>
            </div>
          </div>
        </div>

        <div class="card mt-16">
          <div class="flex items-center justify-between mb-16">
            <h3 style="margin:0;font-size:16px;">🔥 最近活跃</h3>
            <span class="text-sm text-muted">最近 24 小时内有编辑的笔记</span>
          </div>
          <div v-if="recentNotes.length" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">
            <div v-for="n in recentNotes" :key="n.id" style="padding:12px;border:1px solid #f1f5f9;border-radius:8px;cursor:pointer;" @click="gotoNote(n.id)">
              <div class="truncate" style="font-weight:500;">{{ n.title || '未命名笔记' }}</div>
              <div class="text-sm text-muted mt-4">{{ formatDate(n.lastActiveAt || n.updatedAt) }}</div>
            </div>
          </div>
          <div v-else class="text-muted text-sm">暂无最近活跃的笔记</div>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="showFolderDialog" :title="folderForm.id ? '重命名文件夹' : '新建文件夹'" width="420px">
      <el-form :model="folderForm" label-position="top">
        <el-form-item label="名称">
          <el-input v-model="folderForm.name" placeholder="文件夹名称" />
        </el-form-item>
        <el-form-item v-if="!folderForm.id" label="图标">
          <div class="flex gap-8" style="flex-wrap:wrap;">
            <div v-for="i in folderIcons" :key="i"
              @click="folderForm.icon = i"
              style="width:36px;height:36px;border:2px solid;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;font-size:18px;"
              :style="folderForm.icon === i ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
            >{{ i }}</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFolderDialog = false">取消</el-button>
        <el-button type="primary" @click="submitFolder">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showImport" title="导入笔记" width="520px">
      <el-tabs v-model="importTab">
        <el-tab-pane label="文件上传" name="file">
          <el-upload
            drag
            :auto-upload="false"
            :on-change="fileChange"
            accept=".md,.markdown,.txt,.docx"
            :limit="1"
          >
            <el-icon style="font-size:48px;color:#8c959f;"><UploadFilled /></el-icon>
            <div style="margin-top:8px;font-weight:500;">拖入或点击上传 Markdown / Docx 文件</div>
            <div class="text-sm text-muted" style="margin-top:4px;">支持 .md .markdown .txt .docx</div>
          </el-upload>
          <div class="mt-16">
            <label class="text-sm" style="font-weight:500;">保存到文件夹</label>
            <el-tree-select v-model="importFolderId" :data="treeSelect" :props="{label:'name',children:'children'}" check-strictly style="width:100%;margin-top:6px;" placeholder="选择文件夹（可选）" clearable />
          </div>
          <div style="margin-top:20px;text-align:right;">
            <el-button @click="showImport = false">取消</el-button>
            <el-button type="primary" :disabled="!importFile" @click="doImport">导入</el-button>
          </div>
        </el-tab-pane>
        <el-tab-pane label="粘贴 Markdown" name="text">
          <el-input v-model="importContent" type="textarea" :rows="12" placeholder="粘贴 Markdown 内容..." />
          <el-input v-model="importTitle" placeholder="笔记标题（可选，默认取第一个 H1）" style="margin-top:8px;" />
          <div style="margin-top:8px;">
            <label class="text-sm" style="font-weight:500;">保存到文件夹</label>
            <el-tree-select v-model="importFolderId2" :data="treeSelect" :props="{label:'name',children:'children'}" check-strictly style="width:100%;margin-top:6px;" clearable />
          </div>
          <div style="margin-top:16px;text-align:right;">
            <el-button @click="showImport = false">取消</el-button>
            <el-button type="primary" :disabled="!importContent" @click="doImportMd">导入</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <el-dialog v-model="showCreateNote" title="新建笔记" width="520px">
      <el-form :model="noteForm" label-position="top">
        <el-form-item label="选择模板">
          <div class="flex gap-8" style="flex-wrap:wrap;">
            <div v-for="t in templates" :key="t.id"
              @click="noteForm.templateId = t.id"
              style="border:2px solid;border-radius:10px;padding:10px;min-width:110px;cursor:pointer;text-align:center;"
              :style="noteForm.templateId === t.id ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
            >
              <div style="font-size:22px;">{{ t.icon }}</div>
              <div style="font-weight:500;font-size:13px;">{{ t.name }}</div>
            </div>
            <div @click="noteForm.templateId = null"
              style="border:2px solid;border-radius:10px;padding:10px;min-width:110px;cursor:pointer;text-align:center;"
              :style="noteForm.templateId === null ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
            >
              <div style="font-size:22px;">📄</div>
              <div style="font-weight:500;font-size:13px;">空白</div>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="noteForm.title" placeholder="笔记标题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateNote = false">取消</el-button>
        <el-button type="primary" @click="submitCreateNote">创建并编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  MoreFilled, ArrowDown, FolderAdd, UploadFilled, CollectionTag, Setting,
  Plus, Folder, Collection, Upload,
} from '@element-plus/icons-vue';
import { workspaceApi, folderApi, noteApi, templateApi, ioApi } from '@/api';

const route = useRoute();
const router = useRouter();

const workspace = ref(null);
const tree = ref({ folders: [], notes: [] });
const notes = ref([]);
const recentNotes = ref([]);
const templates = ref([]);
const tab = ref('updated');

const showFolderDialog = ref(false);
const showImport = ref(false);
const showCreateNote = ref(false);
const importTab = ref('file');
const folderForm = reactive({ id: null, name: '', icon: '📁', parentId: null });
const noteForm = reactive({ templateId: null, title: '' });
const importFile = ref(null);
const importContent = ref('');
const importTitle = ref('');
const importFolderId = ref(null);
const importFolderId2 = ref(null);

const wsId = computed(() => route.params.wsId);
const currentFolderId = computed(() => route.params.folderId || null);
const inNoteView = computed(() => route.name === 'note');
const currentFolder = computed(() => tree.value.folders?.find?.(f => f.id === currentFolderId.value) || null);
const currentNotes = computed(() => {
  let list = notes.value;
  if (currentFolderId.value) list = list.filter(n => n.folderId === currentFolderId.value);
  const arr = [...list];
  if (tab.value === 'created') arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (tab.value === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else arr.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return arr;
});
const stats = computed(() => ({
  folders: tree.value.folders?.length || 0,
  notes: notes.value.length,
}));
const treeSelect = computed(() => [{ id: 'root', name: '根目录', children: tree.value.folders || [] }]);
const folderIcons = ['📁', '📂', '💼', '📚', '🧪', '🎨', '💡', '🚀', '🎯', '✅'];

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  const diff = (now - dt) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
}
function previewText(n) {
  if (!n.blocks || !n.blocks.length) return '暂无内容';
  for (const b of n.blocks) {
    const text = (b.content || b.text || '').replace(/[#>*_`~\-\[\]]/g, '').trim();
    if (text) return text;
  }
  return '暂无内容';
}

async function loadAll() {
  if (!wsId.value) return;
  const [ws, t, n, r, tpl] = await Promise.all([
    workspaceApi.get(wsId.value),
    folderApi.tree(wsId.value),
    noteApi.listByWorkspace(wsId.value, { limit: 500 }),
    noteApi.recent(wsId.value),
    templateApi.list(),
  ]);
  workspace.value = ws.workspace;
  tree.value = t || { folders: [], notes: [] };
  notes.value = n.items || [];
  recentNotes.value = r.items || [];
  templates.value = tpl.items || [];
}
function reload() {}
function gotoFolder(id) { router.push({ name: 'folder', params: { wsId: wsId.value, folderId: id } }); }
function gotoRoot() { router.push({ name: 'workspace', params: { wsId: wsId.value } }); }
function gotoNote(id) { router.push({ name: 'note', params: { wsId: wsId.value, noteId: id } }); }

function createFolder() {
  folderForm.id = null;
  folderForm.name = '';
  folderForm.icon = '📁';
  folderForm.parentId = currentFolderId.value || null;
  showFolderDialog.value = true;
}
async function submitFolder() {
  if (!folderForm.name) return ElMessage.warning('请输入名称');
  if (folderForm.id) {
    await folderApi.update(folderForm.id, { name: folderForm.name, icon: folderForm.icon });
  } else {
    await folderApi.create(wsId.value, { name: folderForm.name, icon: folderForm.icon, parentId: folderForm.parentId });
  }
  ElMessage.success('已保存');
  showFolderDialog.value = false;
  loadAll();
}

function openCreateNote() {
  noteForm.templateId = null;
  noteForm.title = '';
  showCreateNote.value = true;
}
async function submitCreateNote() {
  const payload = {
    workspaceId: wsId.value,
    folderId: currentFolderId.value || null,
    title: noteForm.title || '未命名笔记',
    templateId: noteForm.templateId,
  };
  const d = await noteApi.create(payload);
  ElMessage.success('已创建');
  showCreateNote.value = false;
  router.push({ name: 'note', params: { wsId: wsId.value, noteId: d.note.id } });
}

function openImport() {
  importFile.value = null;
  importContent.value = '';
  importTitle.value = '';
  importFolderId.value = currentFolderId.value || null;
  importFolderId2.value = currentFolderId.value || null;
  showImport.value = true;
}
function fileChange(file) { importFile.value = file; }
async function doImport() {
  if (!importFile.value) return;
  const fd = new FormData();
  fd.append('file', importFile.value.raw);
  fd.append('workspaceId', wsId.value);
  if (importFolderId.value && importFolderId.value !== 'root') fd.append('folderId', importFolderId.value);
  const d = await ioApi.importFile(fd);
  ElMessage.success('导入成功');
  showImport.value = false;
  loadAll();
  if (d.note) router.push({ name: 'note', params: { wsId: wsId.value, noteId: d.note.id } });
}
async function doImportMd() {
  if (!importContent.value) return;
  const d = await ioApi.importMd({
    workspaceId: wsId.value,
    folderId: importFolderId2.value && importFolderId2.value !== 'root' ? importFolderId2.value : null,
    title: importTitle.value || undefined,
    content: importContent.value,
  });
  ElMessage.success('导入成功');
  showImport.value = false;
  loadAll();
  router.push({ name: 'note', params: { wsId: wsId.value, noteId: d.note.id } });
}

function onWsCmd(cmd) {
  if (cmd === 'createFolder') createFolder();
  else if (cmd === 'import') openImport();
  else if (cmd === 'templates') router.push({ name: 'templates', params: { wsId: wsId.value } });
  else if (cmd === 'settings') router.push({ name: 'ws-settings', params: { wsId: wsId.value } });
}

async function onNoteCmd(cmd, n) {
  if (cmd === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('修改标题', '重命名笔记', { inputValue: n.title });
      await noteApi.update(n.id, { title: value });
      ElMessage.success('已保存');
      loadAll();
    } catch (e) {}
  } else if (cmd === 'move') {
    try {
      const folders = [{ value: 'root', label: '根目录' }, ...(tree.value.folders || []).map(f => ({ value: f.id, label: `${f.icon} ${f.name}` }))];
      const { value } = await ElMessageBox({
        title: '移动到',
        message: () => import('vue').h('div', null, [
          import('element-plus').then(el => import('vue').h(el.ElSelect, {
            modelValue: n.folderId || 'root',
            'onUpdate:modelValue': (v) => { window.__tmpMove = v; },
            placeholder: '选择文件夹',
            style: 'width:100%;',
          }, () => folders.map(f => import('vue').h(el.ElOption, { label: f.label, value: f.value }))))
        ]),
      });
      const fid = window.__tmpMove;
      await folderApi.moveNote({ noteId: n.id, folderId: fid === 'root' ? null : fid });
      ElMessage.success('已移动');
      loadAll();
    } catch (e) {}
  } else if (cmd === 'export') {
    const formats = [
      { label: 'Markdown (.md)', value: 'md', url: ioApi.exportMd(n.id) },
      { label: 'HTML (.html)', value: 'html', url: ioApi.exportHtml(n.id) },
      { label: 'PDF (.pdf)', value: 'pdf', url: ioApi.exportPdf(n.id) },
    ];
    const { value: fmt } = await ElMessageBox({
      title: '导出格式',
      message: () => import('vue').h('div', null, [
        import('element-plus').then(el => import('vue').h(el.ElSelect, {
          modelValue: 'md',
          'onUpdate:modelValue': (v) => { window.__tmpFmt = v; },
          placeholder: '选择格式',
          style: 'width:100%;',
        }, () => formats.map(f => import('vue').h(el.ElOption, { label: f.label, value: f.value }))))
      ]),
    });
    const v = window.__tmpFmt || 'md';
    const fmt = formats.find(f => f.value === v);
    const a = document.createElement('a');
    const token = localStorage.getItem('teamnote_token');
    const sep = fmt.url.includes('?') ? '&' : '?';
    a.href = fmt.url + sep + 'token=' + encodeURIComponent(token);
    a.download = (n.title || 'note') + '.' + v;
    a.click();
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确认删除《${n.title}》？`, '提示', { type: 'warning' });
      await noteApi.remove(n.id);
      ElMessage.success('已删除');
      loadAll();
    } catch (e) {}
  }
}

watch(() => [route.params.wsId, route.params.folderId], loadAll);
onMounted(loadAll);
</script>

<style scoped>
.folder-item {
  padding:8px 12px;
  border-radius:6px;
  display:flex;
  align-items:center;
  gap:8px;
  cursor:pointer;
  margin:2px 8px;
  transition:background 0.15s;
}
.folder-item:hover { background:#f3f4f6; }
.folder-item.active { background:#eef2ff; color:#4f46e5; }
.note-card {
  padding:14px;
  border:1px solid #eaeef2;
  border-radius:10px;
  background:#fff;
  cursor:pointer;
  transition:all 0.15s;
}
.note-card:hover {
  box-shadow:0 4px 14px rgba(0,0,0,0.08);
  border-color:#c7d2fe;
  transform:translateY(-2px);
}
</style>
