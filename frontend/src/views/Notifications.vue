<template>
  <div class="content-wrap">
    <div class="card">
      <div class="flex items-center justify-between mb-16">
        <h2 class="page-title" style="margin:0;">🔔 通知中心</h2>
        <div class="flex gap-8">
          <el-radio-group v-model="filter" size="small" @change="load">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="unread">未读</el-radio-button>
          </el-radio-group>
          <el-button type="primary" plain size="small" @click="readAll" :disabled="!unread">
            <el-icon style="margin-right:4px;"><Check /></el-icon> 全部标为已读
          </el-button>
        </div>
      </div>
      <div class="flex items-center justify-between mb-16 text-sm text-muted">
        <div>共 {{ total }} 条通知，{{ unread }} 条未读</div>
      </div>
      <div v-if="list.length" style="display:flex;flex-direction:column;gap:10px;">
        <div v-for="n in list" :key="n.id" class="notif-card" :class="{ unread: !n.read }" @click="goto(n)">
          <div style="display:flex;align-items:start;gap:12px;">
            <div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;" :style="typeBg(n.type)">
              {{ typeIcon(n.type) }}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="font-weight:600;">{{ n.title }}</div>
                <span v-if="!n.read" style="width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0;"></span>
              </div>
              <div class="text-sm mt-4 mark-block" style="color:#475569;">{{ n.content }}</div>
              <div style="margin-top:6px;display:flex;gap:8px;align-items:center;" class="text-sm text-muted">
                <span>{{ formatTime(n.createdAt) }}</span>
                <span v-if="n.fromUserId && users[n.fromUserId]">· 来自 {{ users[n.fromUserId]?.name }}</span>
                <span v-if="n.relatedId">· 关联：{{ n.relatedType }}</span>
                <span style="flex:1;"></span>
                <el-button v-if="!n.read" size="small" link type="primary" @click.stop="readOne(n.id)">标为已读</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="icon">🎉</div>
        <div class="text">暂无{{ filter === 'unread' ? '未读' : '' }}通知</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';
import { notificationApi } from '@/api';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();
const list = ref([]);
const users = ref({});
const total = ref(0);
const unread = ref(0);
const filter = ref('all');

function typeIcon(t) {
  return ({ mention: '💬', share: '📤', invite: '✉️', comment: '💭', system: '📢' })[t] || '📌';
}
function typeBg(t) {
  return ({ mention: 'background:#fef3c7;color:#92400e;', share: 'background:#dbeafe;color:#1d4ed8;', invite: 'background:#d1fae5;color:#047857;', comment: 'background:#ede9fe;color:#6d28d9;', system: 'background:#fee2e2;color:#b91c1c;' })[t] || 'background:#f1f5f9;color:#475569;';
}
function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  const diff = (now - dt) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}

async function load() {
  const d = await notificationApi.list({ unreadOnly: filter.value === 'unread', limit: 200 });
  list.value = d.items || [];
  total.value = d.total || 0;
  unread.value = d.unreadCount || 0;
  users.value = d.users || {};
  userStore.unreadCount = unread.value;
}
async function readOne(id) {
  await notificationApi.read(id);
  userStore.decUnread();
  load();
}
async function readAll() {
  const d = await notificationApi.readAll();
  ElMessage.success(`已标记 ${d.count} 条已读`);
  load();
}
function goto(n) {
  if (!n.read) readOne(n.id);
  if (n.relatedType === 'note' && n.relatedId && n.metadata?.workspaceId) {
    router.push({ name: 'note', params: { wsId: n.metadata.workspaceId, noteId: n.relatedId } });
  }
}
onMounted(load);
</script>

<style scoped>
.notif-card {
  background:#fff;
  border:1px solid #eaeef2;
  border-radius:10px;
  padding:14px 16px;
  cursor:pointer;
  transition:all 0.15s;
}
.notif-card:hover { border-color:#c7d2fe; background:#fafbff; }
.notif-card.unread { background:#fafbff; border-color:#e0e7ff; }
</style>
