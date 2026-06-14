<template>
  <div class="app-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span style="font-size:22px;">📝</span>
        <span>TeamNote</span>
      </div>
      <div style="padding:12px;border-bottom:1px solid #eaeef2;">
        <el-button type="primary" size="small" style="width:100%;" @click="showCreateWs = true">
          <el-icon style="margin-right:4px;"><Plus /></el-icon> 新建工作空间
        </el-button>
      </div>
      <div class="sidebar-workspaces">
        <div style="font-size:11px;color:#6b7280;margin:8px 12px;text-transform:uppercase;letter-spacing:0.5px;">我的工作空间</div>
        <div
          v-for="ws in workspaces"
          :key="ws.id"
          class="ws-item"
          :class="{ active: currentWsId === ws.id }"
          @click="gotoWorkspace(ws.id)"
        >
          <span style="font-size:18px;">{{ ws.icon || '📁' }}</span>
          <div class="flex-1 min-w-0">
            <div class="truncate" style="font-weight:500;">{{ ws.name }}</div>
            <div class="text-sm text-muted">
              <span class="role-tag" :class="'role-' + (ws.myRole || 'viewer')">{{ roleLabel(ws.myRole) }}</span>
              <span style="margin-left:6px;">{{ ws.noteCount }} 篇笔记</span>
            </div>
          </div>
        </div>
        <div v-if="!workspaces.length" class="empty-state" style="padding:20px 0;">
          <div class="text-muted text-sm">还没有工作空间</div>
        </div>
      </div>
      <div style="padding:12px;border-top:1px solid #eaeef2;">
        <router-link to="/notifications" class="ws-item" style="margin:0;">
          <el-icon><Bell /></el-icon>
          <span style="flex:1;">通知中心</span>
          <el-badge v-if="userStore.unreadCount > 0" :value="userStore.unreadCount" type="danger" :max="99" size="small" />
        </router-link>
        <router-link to="/profile" class="ws-item" style="margin:4px 0 0 0;">
          <el-icon><User /></el-icon>
          <span style="flex:1;">个人设置</span>
        </router-link>
        <div class="ws-item" style="margin:4px 0 0 0;cursor:pointer;" @click="logout">
          <el-icon><SwitchButton /></el-icon>
          <span style="flex:1;color:#ef4444;">退出登录</span>
        </div>
      </div>
    </aside>

    <div class="main-area">
      <div class="top-bar">
        <template v-if="currentWsId">
          <el-input
            v-model="searchQ"
            placeholder="搜索笔记、标题、标签..."
            style="width:360px;"
            size="default"
            clearable
            @keyup.enter="goSearch"
            :prefix-icon="Search"
          />
          <el-button @click="goSearch">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button type="primary" @click="createNoteFromToolbar">
            <el-icon><DocumentAdd /></el-icon> 新建笔记
          </el-button>
        </template>
        <div style="flex:1;"></div>
        <div class="flex items-center gap-12">
          <div class="flex items-center gap-8">
            <el-avatar :size="32" style="background:#4f46e5;">{{ (userStore.user?.name || userStore.user?.username || '?').charAt(0).toUpperCase() }}</el-avatar>
            <div>
              <div style="font-weight:500;font-size:13px;">{{ userStore.user?.name || userStore.user?.username }}</div>
              <div class="text-sm text-muted">
                <span class="role-tag" :class="'role-' + (userStore.user?.role || 'viewer')">{{ roleLabel(userStore.user?.role) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>

    <el-dialog v-model="showCreateWs" title="新建工作空间" width="480px">
      <el-form :model="wsForm" label-position="top">
        <el-form-item label="图标">
          <div class="flex gap-8">
            <div v-for="i in ['📁','🏢','🚀','💡','🎯','📚','🧪','🎨','⚙️','❤️']" :key="i"
              @click="wsForm.icon = i"
              style="width:40px;height:40px;border:2px solid;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;font-size:22px;"
              :style="wsForm.icon === i ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
            >{{ i }}</div>
          </div>
        </el-form-item>
        <el-form-item label="工作空间名称">
          <el-input v-model="wsForm.name" placeholder="如：产品团队" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="wsForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateWs = false">取消</el-button>
        <el-button type="primary" @click="createWorkspace">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCreateNote" title="新建笔记" width="520px">
      <el-form :model="noteForm" label-position="top">
        <el-form-item label="选择模板">
          <div class="flex gap-8" style="flex-wrap:wrap;">
            <div v-for="t in templateList" :key="t.id"
              @click="noteForm.templateId = t.id"
              style="border:2px solid;border-radius:10px;padding:12px;min-width:130px;cursor:pointer;"
              :style="noteForm.templateId === t.id ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
            >
              <div style="font-size:24px;margin-bottom:6px;">{{ t.icon }}</div>
              <div style="font-weight:500;">{{ t.name }}</div>
              <div class="text-sm text-muted">{{ t.category }}</div>
            </div>
            <div @click="noteForm.templateId = null"
              style="border:2px solid;border-radius:10px;padding:12px;min-width:130px;cursor:pointer;"
              :style="noteForm.templateId === null ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
            >
              <div style="font-size:24px;margin-bottom:6px;">📄</div>
              <div style="font-weight:500;">空白笔记</div>
              <div class="text-sm text-muted">从头开始</div>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="noteForm.title" placeholder="笔记标题" />
        </el-form-item>
        <el-form-item label="保存位置">
          <el-tree-select
            v-model="noteForm.folderId"
            :data="treeData"
            :props="{ label: 'name', children: 'children' }"
            placeholder="选择文件夹（可选）"
            clearable
            check-strictly
          />
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
import { ref, reactive, computed, onMounted, watch, markRaw } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Bell, User, SwitchButton, Search, DocumentAdd } from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';
import { workspaceApi, templateApi, noteApi, folderApi } from '@/api';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const workspaces = ref([]);
const templateList = ref([]);
const treeData = ref([]);
const searchQ = ref('');
const showCreateWs = ref(false);
const showCreateNote = ref(false);
const wsForm = reactive({ name: '', icon: '📁', description: '' });
const noteForm = reactive({ templateId: null, title: '', folderId: null });

const currentWsId = computed(() => route.params.wsId || null);

function roleLabel(r) {
  return ({ owner: '所有者', admin: '管理员', editor: '编辑者', viewer: '浏览者', guest: '访客' })[r] || '访客';
}

async function loadWorkspaces() {
  const d = await workspaceApi.list();
  workspaces.value = d.items || [];
}
function gotoWorkspace(id) {
  router.push({ name: 'workspace', params: { wsId: id } });
}
async function createWorkspace() {
  if (!wsForm.name) return ElMessage.warning('请输入工作空间名称');
  const d = await workspaceApi.create(wsForm);
  ElMessage.success('创建成功');
  showCreateWs.value = false;
  wsForm.name = ''; wsForm.description = ''; wsForm.icon = '📁';
  await loadWorkspaces();
  gotoWorkspace(d.workspace.id);
}
async function logout() {
  await ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' });
  userStore.logout();
}
function goSearch() {
  if (!currentWsId.value) return ElMessage.warning('请先选择工作空间');
  router.push({ name: 'search', params: { wsId: currentWsId.value }, query: { q: searchQ.value } });
}
async function loadTemplates() {
  const d = await templateApi.list();
  templateList.value = (d.items || []).slice(0, 8);
}
async function loadTreeData() {
  if (!currentWsId.value) return;
  try {
    const d = await folderApi.tree(currentWsId.value);
    treeData.value = [{ id: 'root', name: '根目录', children: d.folders || [] }];
  } catch (e) {}
}
function createNoteFromToolbar() {
  if (!currentWsId.value) return ElMessage.warning('请先选择工作空间');
  noteForm.templateId = null;
  noteForm.title = '';
  noteForm.folderId = null;
  showCreateNote.value = true;
}
async function submitCreateNote() {
  const payload = {
    workspaceId: currentWsId.value,
    folderId: noteForm.folderId === 'root' ? null : noteForm.folderId,
    title: noteForm.title || '未命名笔记',
    templateId: noteForm.templateId,
  };
  const d = await noteApi.create(payload);
  ElMessage.success('已创建');
  showCreateNote.value = false;
  router.push({ name: 'note', params: { wsId: currentWsId.value, noteId: d.note.id } });
}
watch(() => route.params.wsId, () => {
  loadTreeData();
});
onMounted(async () => {
  await loadWorkspaces();
  await loadTemplates();
  await loadTreeData();
  if (!workspaces.value.length && route.name === 'home') {
    showCreateWs.value = true;
  } else if (!route.params.wsId && workspaces.value.length) {
    gotoWorkspace(workspaces.value[0].id);
  }
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
