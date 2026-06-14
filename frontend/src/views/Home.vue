<template>
  <div class="content-wrap">
    <h2 class="page-title">👋 欢迎回来，{{ userStore.user?.name || userStore.user?.username }}</h2>
    <el-row :gutter="20">
      <el-col :span="12">
        <div class="card">
          <h3 style="margin:0 0 12px 0;">快速开始</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="quick-card" @click="pickWs">
              <div style="font-size:28px;">📂</div>
              <div style="font-weight:500;">打开工作空间</div>
              <div class="text-sm text-muted">从侧边栏选择</div>
            </div>
            <div class="quick-card" @click="$router.push('/notifications')">
              <div style="font-size:28px;">🔔</div>
              <div style="font-weight:500;">通知中心</div>
              <div class="text-sm text-muted">{{ userStore.unreadCount }} 条未读</div>
            </div>
            <div class="quick-card" @click="$router.push('/profile')">
              <div style="font-size:28px;">👤</div>
              <div style="font-weight:500;">个人设置</div>
              <div class="text-sm text-muted">资料和密码</div>
            </div>
            <div class="quick-card" @click="showHelp = true">
              <div style="font-size:28px;">❓</div>
              <div style="font-weight:500;">使用帮助</div>
              <div class="text-sm text-muted">功能说明</div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <h3 style="margin:0 0 12px 0;">✨ 产品特性</h3>
          <ul style="line-height:2;padding-left:18px;margin:0;">
            <li><b>实时协作</b>：Yjs CRDT 无冲突同步，多光标、离线合并、历史回放</li>
            <li><b>5 级权限</b>：owner / admin / editor / viewer / guest，文件夹和笔记独立设权</li>
            <li><b>块级评论</b>：@同事 / @全员 / @角色，已解决折叠，通知中心提醒</li>
            <li><b>全文搜索</b>：BM25 + 中文分词，标题/标签/内容高亮，搜索历史与热词</li>
            <li><b>模板系统</b>：周报/月报/会议纪要/PRD/技术方案，Markdown/PDF/HTML 导出</li>
            <li><b>版本回滚</b>：任意快照一键回退，JSON 文件存储 + 定期自动备份</li>
          </ul>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="showHelp" title="使用帮助" width="640px">
      <div class="mark-block">
        <h3>🚀 快速上手</h3>
        <ol>
          <li>从左侧选择或新建<b>工作空间</b></li>
          <li>在工作空间中创建<b>文件夹</b>和<b>笔记</b></li>
          <li>多人同时打开同一笔记，自动进入<b>实时协作</b>模式，光标与编辑同步</li>
          <li>选中任意文字或块，可添加<b>块级评论</b>并 @ 同事</li>
          <li>使用<b>版本快照</b>功能随时保存历史，一键回滚</li>
        </ol>
        <h3>🔐 角色权限说明</h3>
        <ul>
          <li><b>所有者 owner</b>：所有权限，可转让所有权</li>
          <li><b>管理员 admin</b>：成员管理、设置、删除等</li>
          <li><b>编辑者 editor</b>：创建/编辑笔记、评论、标签</li>
          <li><b>浏览者 viewer</b>：查看、评论、导出</li>
          <li><b>访客 guest</b>：仅查看，不可评论</li>
        </ul>
      </div>
      <template #footer>
        <el-button type="primary" @click="showHelp = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
const router = useRouter();
const userStore = useUserStore();
const showHelp = ref(false);
function pickWs() {
  router.push('/home');
  setTimeout(() => document.querySelector('.sidebar-workspaces')?.scrollIntoView({ behavior: 'smooth' }), 100);
}
</script>

<style scoped>
.quick-card {
  background:#f9fafb;
  padding:16px;
  border-radius:10px;
  cursor:pointer;
  transition:all 0.15s;
  border:1px solid transparent;
}
.quick-card:hover {
  background:#eef2ff;
  border-color:#c7d2fe;
  transform:translateY(-1px);
}
</style>
