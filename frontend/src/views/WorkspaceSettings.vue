<template>
  <div class="content-wrap">
    <div class="card">
      <h2 class="page-title" style="margin-top:0;">⚙️ 工作空间设置 · {{ workspace?.name }}</h2>
      <el-tabs v-model="tab">
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="form" label-width="100px" style="max-width:520px;">
            <el-form-item label="图标">
              <div class="flex gap-8" style="flex-wrap:wrap;">
                <div v-for="i in icons" :key="i" @click="form.icon = i"
                  style="width:44px;height:44px;border:2px solid;display:flex;align-items:center;justify-content:center;border-radius:10px;cursor:pointer;font-size:24px;"
                  :style="form.icon === i ? 'border-color:#4f46e5;background:#eef2ff;' : 'border-color:transparent;background:#f9fafb;'"
                >{{ i }}</div>
              </div>
            </el-form-item>
            <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
            <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveBasic">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="成员管理" name="members">
          <div class="flex items-center justify-between mb-16">
            <div class="text-muted text-sm">共 {{ members.length }} 名成员</div>
            <el-button type="primary" @click="showAddMember = true">
              <el-icon style="margin-right:4px;"><UserAdd /></el-icon> 添加成员
            </el-button>
          </div>
          <el-table :data="members" stripe>
            <el-table-column label="成员" width="260">
              <template #default="{ row: uid }">
                <div class="flex items-center gap-8">
                  <el-avatar :size="32" style="background:#4f46e5;">{{ (users[uid]?.name || '?').charAt(0) }}</el-avatar>
                  <div>
                    <div style="font-weight:500;">{{ users[uid]?.name || '?' }}</div>
                    <div class="text-sm text-muted">@{{ users[uid]?.username }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="角色" width="240">
              <template #default="{ row: uid }">
                <el-select v-if="uid !== workspace?.ownerId" v-model="roleMap[uid]" @change="changeRole(uid, $event)" size="small" style="width:160px;">
                  <el-option value="admin" label="🛡️ 管理员" />
                  <el-option value="editor" label="✏️ 编辑者" />
                  <el-option value="viewer" label="👁️ 浏览者" />
                  <el-option value="guest" label="👤 访客" />
                </el-select>
                <span v-else class="role-tag role-owner">⭐ 所有者</span>
              </template>
            </el-table-column>
            <el-table-column label="邮箱">
              <template #default="{ row: uid }">{{ users[uid]?.email || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="160" align="right">
              <template #default="{ row: uid }">
                <el-button v-if="uid !== workspace?.ownerId && uid !== userStore.user?.id" size="small" type="danger" link @click="removeMember(uid)">移除</el-button>
                <el-button v-if="uid === workspace?.ownerId && workspace?.ownerId === userStore.user?.id" size="small" link @click="showTransfer = true">转让所有权</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="邀请链接" name="invites">
          <div class="flex items-center justify-between mb-16">
            <div class="text-muted text-sm">创建邀请链接，让外部用户加入工作空间</div>
            <el-button type="primary" @click="openCreateInvite">
              <el-icon style="margin-right:4px;"><Link /></el-icon> 生成邀请链接
            </el-button>
          </div>
          <el-table :data="invites" stripe>
            <el-table-column label="Token" width="300">
              <template #default="{ row: r }">
                <el-input v-model="r.token" readonly size="small" />
              </template>
            </el-table-column>
            <el-table-column label="默认角色" width="140">
              <template #default="{ row: r }">
                <span class="role-tag" :class="'role-' + r.defaultRole">{{ roleLabel(r.defaultRole) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="使用次数" width="120">
              <template #default="{ row: r }">{{ r.useCount || 0 }} / {{ r.maxUses || '∞' }}</template>
            </el-table-column>
            <el-table-column label="过期时间">
              <template #default="{ row: r }">{{ r.expiresAt ? formatTime(r.expiresAt) : '永不过期' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row: r }">
                <el-tag v-if="r.revoked" type="danger" size="small">已撤销</el-tag>
                <el-tag v-else-if="isExpired(r)" type="info" size="small">已过期</el-tag>
                <el-tag v-else type="success" size="small">有效</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="right">
              <template #default="{ row: r }">
                <el-button size="small" link type="primary" @click="copyInvite(r)">复制链接</el-button>
                <el-button v-if="!r.revoked && !isExpired(r)" size="small" link type="danger" @click="revoke(r.id)">撤销</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="审计日志" name="audit">
          <div class="mb-16">
            <el-select v-model="auditFilter.action" placeholder="过滤操作" clearable size="small" style="width:220px;">
              <el-option v-for="a in actionOptions" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
            <el-select v-model="auditFilter.userId" placeholder="过滤用户" clearable size="small" style="width:180px;margin-left:8px;">
              <el-option v-for="u in userList" :key="u.id" :label="u.name + ' (@' + u.username + ')'" :value="u.id" />
            </el-select>
          </div>
          <el-table :data="audit.items" stripe height="500">
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-tag size="small" :type="tagType(row.action)">{{ actionLabel(row.action) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作用户" width="160">
              <template #default="{ row }">{{ audit.users[row.userId]?.name || '?' }}</template>
            </el-table-column>
            <el-table-column label="详情">
              <template #default="{ row }">
                <span class="text-muted text-sm">{{ JSON.stringify(row.details || {}) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="IP" width="140">
              <template #default="{ row }">{{ row.ip || '-' }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="危险操作" name="danger">
          <div style="border:1px solid #fecaca;background:#fef2f2;border-radius:10px;padding:20px;">
            <h4 style="color:#b91c1c;margin:0 0 8px 0;">⚠️ 删除工作空间</h4>
            <p class="text-sm text-muted" style="margin:0 0 12px 0;">删除后所有文件夹、笔记、评论将被永久删除，不可恢复。</p>
            <el-button type="danger" @click="deleteWs">永久删除工作空间</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="showAddMember" title="添加成员" width="520px">
      <el-input v-model="addMemberQ" placeholder="搜索用户名、姓名或邮箱" size="large" @input="searchUsers" />
      <div style="margin-top:12px;max-height:320px;overflow-y:auto;">
        <div v-for="u in searchUserResult" :key="u.id" style="padding:10px;border:1px solid #f1f5f9;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
          <el-avatar :size="36" style="background:#4f46e5;">{{ u.name.charAt(0) }}</el-avatar>
          <div style="flex:1;">
            <div style="font-weight:500;">{{ u.name }}</div>
            <div class="text-sm text-muted">@{{ u.username }} · {{ u.email }}</div>
          </div>
          <el-select v-model="pendingRole[u.id]" size="small" style="width:140px;">
            <el-option value="admin" label="管理员" />
            <el-option value="editor" label="编辑者" />
            <el-option value="viewer" label="浏览者" />
            <el-option value="guest" label="访客" />
          </el-select>
          <el-button size="small" type="primary" :disabled="!!roleMap[u.id]" @click="addMember(u)">
            {{ roleMap[u.id] ? '已添加' : '添加' }}
          </el-button>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="showCreateInvite" title="生成邀请链接" width="460px">
      <el-form :model="inviteForm" label-width="100px">
        <el-form-item label="默认角色">
          <el-select v-model="inviteForm.role" style="width:100%;">
            <el-option value="admin" label="🛡️ 管理员" />
            <el-option value="editor" label="✏️ 编辑者" />
            <el-option value="viewer" label="👁️ 浏览者（推荐）" />
            <el-option value="guest" label="👤 访客" />
          </el-select>
        </el-form-item>
        <el-form-item label="最大使用">
          <el-input-number v-model="inviteForm.maxUses" :min="1" :max="1000" style="width:100%;" />
        </el-form-item>
        <el-form-item label="有效期(小时)">
          <el-input-number v-model="inviteForm.expiresHours" :min="1" :max="24 * 365" style="width:100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateInvite = false">取消</el-button>
        <el-button type="primary" @click="createInvite">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showTransfer" title="转让所有权" width="440px">
      <el-select v-model="newOwnerId" placeholder="选择新所有者" style="width:100%;" size="large">
        <el-option v-for="uid in members.filter(m => m !== workspace?.ownerId)" :key="uid" :label="users[uid]?.name + ' (@' + users[uid]?.username + ')'" :value="uid" />
      </el-select>
      <template #footer>
        <el-button @click="showTransfer = false">取消</el-button>
        <el-button type="danger" @click="transfer">确认转让</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UserAdd, Link } from '@element-plus/icons-vue';
import { workspaceApi, userApi } from '@/api';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const wsId = computed(() => route.params.wsId);

const workspace = ref(null);
const users = ref({});
const roleMap = ref({});
const form = reactive({ name: '', icon: '', description: '' });
const tab = ref('basic');
const icons = ['📁','🏢','🚀','💡','🎯','📚','🧪','🎨','⚙️','❤️','🌱','🔥','🎉','🔬','📊'];
const members = computed(() => {
  if (!workspace.value) return [];
  const w = workspace.value;
  return [w.ownerId, ...(w.admins || []), ...(w.editors || []), ...(w.viewers || []), ...(w.guests || [])];
});

const invites = ref([]);
const showAddMember = ref(false);
const showCreateInvite = ref(false);
const showTransfer = ref(false);
const newOwnerId = ref(null);
const addMemberQ = ref('');
const searchUserResult = ref([]);
const pendingRole = reactive({});
const inviteForm = reactive({ role: 'viewer', maxUses: 10, expiresHours: 24 * 7 });

const audit = reactive({ items: [], total: 0, users: {} });
const auditFilter = reactive({ action: '', userId: '' });
const userList = ref([]);

const actionOptions = [
  { label: '笔记创建', value: 'note:create' },
  { label: '笔记更新', value: 'note:update' },
  { label: '笔记删除', value: 'note:delete' },
  { label: '笔记回滚', value: 'note:rollback' },
  { label: '笔记导出', value: 'note:export' },
  { label: '笔记导入', value: 'note:import' },
  { label: '评论创建', value: 'comment:create' },
  { label: '评论解决', value: 'comment:resolve' },
  { label: '成员添加', value: 'workspace:member_add' },
  { label: '成员移除', value: 'workspace:member_remove' },
  { label: '角色变更', value: 'workspace:member_role_change' },
  { label: '邀请创建', value: 'invite:create' },
  { label: '邀请接受', value: 'invite:accept' },
];

function roleLabel(r) { return ({ owner: '所有者', admin: '管理员', editor: '编辑者', viewer: '浏览者', guest: '访客' })[r] || '访客'; }
function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}
function isExpired(r) { return r.expiresAt && new Date(r.expiresAt) < new Date(); }
function tagType(a) {
  if (a.includes('delete') || a.includes('remove') || a.includes('revoke')) return 'danger';
  if (a.includes('create') || a.includes('add') || a.includes('accept')) return 'success';
  if (a.includes('update') || a.includes('change') || a.includes('resolve')) return 'warning';
  return 'info';
}
function actionLabel(a) {
  const map = {};
  for (const o of actionOptions) map[o.value] = o.label;
  return map[a] || a;
}

async function load() {
  const d = await workspaceApi.get(wsId.value);
  workspace.value = d.workspace;
  users.value = d.users;
  roleMap.value = { ...(d.roleMap || {}) };
  form.name = d.workspace.name;
  form.icon = d.workspace.icon;
  form.description = d.workspace.description;
  invites.value = (await workspaceApi.listInvites(wsId.value)).items || [];
  await loadAudit();
  userList.value = (await userApi.list({ workspaceId: wsId.value })).items || [];
}
async function loadAudit() {
  const params = {};
  if (auditFilter.action) params.action = auditFilter.action;
  if (auditFilter.userId) params.userId = auditFilter.userId;
  const d = await workspaceApi.auditLogs(wsId.value, params);
  audit.items = d.items || [];
  audit.total = d.total;
  audit.users = d.users || {};
}
async function saveBasic() {
  if (!form.name) return ElMessage.warning('请输入工作空间名称');
  await workspaceApi.update(wsId.value, { name: form.name, icon: form.icon, description: form.description });
  ElMessage.success('已保存');
  load();
}
async function changeRole(uid, role) {
  try {
    await workspaceApi.updateMember(wsId.value, { userId: uid, role });
    ElMessage.success('角色已更新');
    load();
  } catch (e) {
    load();
  }
}
async function removeMember(uid) {
  try {
    const name = users.value[uid]?.name || '该成员';
    await ElMessageBox.confirm(`确认移除 ${name}？`, '提示', { type: 'warning' });
    await workspaceApi.removeMember(wsId.value, { userId: uid });
    ElMessage.success('已移除');
    load();
  } catch (e) {}
}
async function addMember(u) {
  const role = pendingRole[u.id] || 'viewer';
  await workspaceApi.updateMember(wsId.value, { userId: u.id, role });
  ElMessage.success('已添加');
  pendingRole[u.id] = role;
  load();
}
async function searchUsers() {
  if (!addMemberQ.value) { searchUserResult.value = []; return; }
  const d = await userApi.list({ q: addMemberQ.value });
  searchUserResult.value = (d.items || []).filter(u => !members.value.includes(u.id));
  for (const u of searchUserResult.value) {
    if (!pendingRole[u.id]) pendingRole[u.id] = 'viewer';
  }
}
async function createInvite() {
  const d = await workspaceApi.createInvite(wsId.value, inviteForm);
  ElMessage.success('邀请链接已生成');
  await load();
  const link = `${location.origin}${location.pathname}#/invite/${d.invite.token}`;
  const textarea = document.createElement('textarea');
  textarea.value = link;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  ElMessage.success('链接已复制到剪贴板');
}
function copyInvite(r) {
  const link = `${location.origin}${location.pathname}#/invite/${r.token}`;
  navigator.clipboard?.writeText(link);
  ElMessage.success('已复制');
}
async function revoke(id) {
  await workspaceApi.revokeInvite(wsId.value, id);
  ElMessage.success('已撤销');
  load();
}
async function transfer() {
  if (!newOwnerId.value) return;
  await ElMessageBox.confirm('确认转让所有权？此操作不可撤销。', '提示', { type: 'warning' });
  await workspaceApi.transfer(wsId.value, { newOwnerId: newOwnerId.value });
  ElMessage.success('所有权已转让');
  showTransfer.value = false;
  load();
}
async function deleteWs() {
  try {
    await ElMessageBox.confirm(`确认永久删除工作空间 "${workspace.value.name}"？所有数据将被清空，不可恢复！`, '危险操作', { type: 'error', confirmButtonText: '永久删除', confirmButtonClass: 'el-button--danger' });
    await workspaceApi.remove(wsId.value);
    ElMessage.success('已删除');
    router.push('/home');
  } catch (e) {}
}

onMounted(load);
</script>
