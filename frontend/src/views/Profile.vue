<template>
  <div class="content-wrap" style="max-width:720px;">
    <div class="card">
      <h2 class="page-title" style="margin-top:0;">👤 个人设置</h2>
      <el-tabs v-model="tab">
        <el-tab-pane label="基本资料" name="basic">
          <div class="flex items-center gap-16 mb-16" style="padding:16px;background:#f9fafb;border-radius:10px;">
            <el-avatar :size="72" style="background:#4f46e5;font-size:32px;">
              {{ (form.name || form.username || '?').charAt(0) }}
            </el-avatar>
            <div>
              <div style="font-weight:600;font-size:18px;">{{ form.name }} (@{{ form.username }})</div>
              <div class="text-sm text-muted mt-4">
                <span class="role-tag" :class="'role-' + form.role">{{ roleLabel(form.role) }}</span>
              </div>
              <div class="text-sm text-muted mt-4">加入时间：{{ formatTime(userStore.user?.createdAt) }}</div>
            </div>
          </div>
          <el-form :model="form" label-width="100px">
            <el-form-item label="姓名">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="form.email" />
            </el-form-item>
            <el-form-item label="头像URL">
              <el-input v-model="form.avatar" placeholder="选填，直接使用首字母头像即可" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveProfile">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="修改密码" name="password">
          <el-form :model="pwForm" label-width="100px" style="max-width:400px;">
            <el-form-item label="原密码">
              <el-input v-model="pwForm.oldPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="pwForm.newPassword" type="password" show-password placeholder="至少6位" />
            </el-form-item>
            <el-form-item label="确认新密码">
              <el-input v-model="pwForm.confirmPassword" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="changePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="使用说明" name="help">
          <div class="mark-block" style="padding:10px;">
            <h3>📖 TeamNote 使用说明</h3>
            <h4>基本操作</h4>
            <ul>
              <li>左侧边栏可切换不同的<b>工作空间</b>，每个工作空间独立管理成员与权限</li>
              <li>工作空间中可创建多层<b>文件夹</b>，并将<b>笔记</b>归类整理</li>
              <li>打开笔记后，多人同时进入自动开启<b>实时协作</b>，编辑内容、光标、选区无冲突同步</li>
              <li>点击块左侧的工具栏可以进行块类型转换、上下移动、删除、添加评论等操作</li>
            </ul>
            <h4>评论与@提及</h4>
            <ul>
              <li>每个内容块都可以添加独立评论，支持折叠<b>已解决</b>的评论</li>
              <li>评论输入时输入 <code>@用户名</code> 可定向通知同事</li>
              <li>@所有人 / @管理员 / @编辑者 等可以批量通知对应角色</li>
            </ul>
            <h4>版本与历史</h4>
            <ul>
              <li>点击编辑器顶部"<b>N 个版本</b>"可随时保存快照或回滚到任意历史版本</li>
              <li>编辑历史回放功能可以逐条播放所有操作，便于追踪变更</li>
            </ul>
            <h4>搜索与导入导出</h4>
            <ul>
              <li>全文搜索基于 BM25 算法 + 中文分词，支持标题/标签/内容精准高亮</li>
              <li>支持 Markdown、HTML、PDF 三种格式的导出</li>
              <li>支持 Markdown 和 Docx (Word) 文件直接导入为新笔记</li>
            </ul>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { authApi } from '@/api';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const tab = ref('basic');
const form = reactive({ name: '', username: '', email: '', avatar: '', role: '' });
const pwForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });

function roleLabel(r) { return ({ owner: '所有者', admin: '管理员', editor: '编辑者', viewer: '浏览者', guest: '访客' })[r] || '访客'; }
function formatTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`;
}

function load() {
  const u = userStore.user;
  if (u) Object.assign(form, u);
}
async function saveProfile() {
  const d = await authApi.updateProfile({ name: form.name, email: form.email, avatar: form.avatar });
  userStore.user = d.user;
  ElMessage.success('资料已更新');
  load();
}
async function changePassword() {
  if (!pwForm.oldPassword || !pwForm.newPassword) return ElMessage.warning('请填写密码');
  if (pwForm.newPassword !== pwForm.confirmPassword) return ElMessage.warning('两次输入的新密码不一致');
  if (pwForm.newPassword.length < 6) return ElMessage.warning('新密码至少6位');
  await authApi.changePassword(pwForm);
  ElMessage.success('密码已更新');
  pwForm.oldPassword = pwForm.newPassword = pwForm.confirmPassword = '';
}
onMounted(load);
</script>
