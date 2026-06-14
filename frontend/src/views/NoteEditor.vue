<template>
  <div style="display:flex;height:100%;min-height:0;gap:12px;">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
      <div style="padding:0 12px 12px 12px;border-bottom:1px solid #eaeef2;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div class="flex items-center gap-8 text-sm text-muted" style="margin-bottom:4px;">
              <router-link :to="'/workspace/' + wsId" style="color:#4f46e5;">
                {{ workspace?.icon }} {{ workspace?.name }}
              </router-link>
              <span>/</span>
              <span v-if="currentFolder">{{ currentFolder.icon }} {{ currentFolder.name }}</span>
              <span style="margin-left:8px;" class="role-tag" :class="'role-' + myRole">{{ roleLabel(myRole) }}</span>
              <span :style="'color:' + (collabStatusColor) + ';margin-left:8px;display:inline-flex;align-items:center;gap:4px;'">
                <span :style="'width:8px;height:8px;border-radius:50%;background:' + collabStatusColor"></span>
                {{ collabStatusText }}
              </span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <input
                v-if="canEdit"
                v-model="localTitle"
                @blur="saveTitle"
                @keyup.enter="$event.target.blur()"
                style="font-size:28px;font-weight:700;border:none;outline:none;background:transparent;width:100%;padding:4px 0;"
                placeholder="笔记标题"
              />
              <span v-else style="font-size:28px;font-weight:700;">{{ note?.title || '未命名笔记' }}</span>
            </div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <el-tag
                v-for="t in localTags" :key="t"
                closable
                :disable-transitions="false"
                style="cursor:default;"
                @close="canEdit && removeTag(t)"
              >{{ t }}</el-tag>
              <el-input
                v-if="canEdit && showTagInput"
                ref="tagInputRef"
                v-model="newTag"
                size="small"
                style="width:140px;"
                placeholder="输入标签回车"
                @blur="addTagFromInput"
                @keyup.enter="addTagFromInput"
              />
              <el-button v-if="canEdit && !showTagInput" size="small" link type="primary" @click="startAddTag">
                <el-icon style="margin-right:2px;"><Plus /></el-icon>标签
              </el-button>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <el-dropdown trigger="click" @command="verCmd">
              <el-button size="small">
                <el-icon style="margin-right:4px;"><Clock /></el-icon>
                {{ versions.length }} 个版本
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="save">
                    <el-icon style="margin-right:6px;"><DocumentCopy /></el-icon> 保存当前快照
                  </el-dropdown-item>
                  <el-dropdown-item v-if="versions.length" command="list" divided>
                    <el-icon style="margin-right:6px;<List /></el-icon> 查看历史版本
                  </el-dropdown-item>
                  <el-dropdown-item command="replay">
                    <el-icon style="margin-right:6px;"><VideoPlay /></el-icon> 编辑历史回放
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown trigger="click" @command="cmdIO">
              <el-button size="small">
                <el-icon style="margin-right:4px;"><Download /></el-icon>
                导入/导出
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="md">导出 Markdown</el-dropdown-item>
                  <el-dropdown-item command="html">导出 HTML</el-dropdown-item>
                  <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
                  <el-dropdown-item command="import" divided>导入 Markdown/Docx...</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" :type="rightPanel ? 'primary' : ''" @click="togglePanel">
              <el-icon style="margin-right:4px;"><ChatDotRound /></el-icon>
              评论 ({{ note?.comments || comments.length }})
            </el-button>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <div v-for="(u, uid) in onlineUsers" :key="uid" class="flex items-center gap-6" style="font-size:12px;padding:2px 8px;background:#f8fafc;border-radius:20px;">
            <span :style="'width:8px;height:8px;border-radius:50%;background:' + (u.color || '#94a3b8')"></span>
            <el-avatar :size="18" style="background:#4f46e5;">{{ (u.name || '?').charAt(0) }}</el-avatar>
            <span>{{ u.name }}</span>
          </div>
          <template v-if="canEdit">
            <div style="flex:1;"></div>
            <div class="flex gap-6">
              <el-button-group size="small">
                <el-button @click="insertBlock('heading')"><b>H1</b></el-button>
                <el-button @click="insertBlock('h2')"><b>H2</b></el-button>
                <el-button @click="insertBlock('h3')"><b>H3</b></el-button>
              </el-button-group>
              <el-button-group size="small">
                <el-button @click="insertBlock('bulleted')">• 列表</el-button>
                <el-button @click="insertBlock('numbered')">1. 列表</el-button>
                <el-button @click="insertBlock('todo')">☑ 待办</el-button>
              </el-button-group>
              <el-button-group size="small">
                <el-button @click="insertBlock('quote')">“ 引用</el-button>
                <el-button @click="insertBlock('code')">{ } 代码</el-button>
                <el-button @click="insertBlock('divider')">— 分割</el-button>
              </el-button-group>
            </div>
          </template>
        </div>
      </div>

      <div ref="editorScroll" style="flex:1;overflow-y:auto;padding:8px 12px 20px 12px;min-height:0;">
        <div style="max-width:900px;margin:0 auto;">
          <div
            v-for="(block, idx) in blocks" :key="block.id"
            :class="['block-wrapper', { 'has-comment': blockCommentCount(block.id), 'is-selected': selectedBlockId === block.id }]"
            :style="{ '--comment-count': blockCommentCount(block.id) }"
            @click="selectBlock(block.id)"
          >
            <div class="block-toolbar">
              <template v-if="canEdit">
                <el-dropdown trigger="click" @command="(c) => blockCmd(c, block, idx)">
                  <el-button size="small" link :icon="MoreFilled" />
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="moveUp" :disabled="idx === 0">向上移动</el-dropdown-item>
                      <el-dropdown-item command="moveDown" :disabled="idx === blocks.length - 1">向下移动</el-dropdown-item>
                      <el-dropdown-item command="turnType" divided>转换类型...</el-dropdown-item>
                      <el-dropdown-item command="duplicate">复制块</el-dropdown-item>
                      <el-dropdown-item command="delete" style="color:#ef4444;">删除块</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button size="small" link style="margin-left:-4px;" @click.stop="insertBlockBefore(idx)">
                  <el-icon><Plus /></el-icon>
                </el-button>
              </template>
              <el-button
                size="small" link
                :style="{ color: blockCommentCount(block.id) ? '#4f46e5' : '' }"
                @click.stop="openCommentsForBlock(block.id)"
              >
                <el-icon><ChatDotRound /></el-icon>
                <span v-if="blockCommentCount(block.id)" style="margin-left:2px;">{{ blockCommentCount(block.id) }}</span>
              </el-button>
            </div>

            <div v-if="block.type === 'heading' || block.type === 'h1'" class="block-line">
              <input v-if="canEdit" v-model="block.content" @input="onBlockChange" class="block-input heading1" placeholder="一级标题" />
              <h1 v-else style="margin:0;">{{ block.content }}</h1>
            </div>
            <div v-else-if="block.type === 'h2'" class="block-line">
              <input v-if="canEdit" v-model="block.content" @input="onBlockChange" class="block-input heading2" placeholder="二级标题" />
              <h2 v-else style="margin:0;">{{ block.content }}</h2>
            </div>
            <div v-else-if="block.type === 'h3'" class="block-line">
              <input v-if="canEdit" v-model="block.content" @input="onBlockChange" class="block-input heading3" placeholder="三级标题" />
              <h3 v-else style="margin:0;">{{ block.content }}</h3>
            </div>
            <div v-else-if="block.type === 'paragraph' || block.type === 'markdown'" class="block-line">
              <textarea
                v-if="canEdit"
                v-model="block.content"
                @input="onBlockChange"
                rows="1"
                class="block-input textarea"
                :ref="el => setTextareaRef(block.id, el)"
                placeholder="输入内容，支持 Markdown 语法..."
                @focus="onFocusBlock(block.id)"
                @blur="onBlurBlock"
              />
              <div v-else class="mark-block">{{ markdown(block.content) }}</div>
            </div>
            <div v-else-if="block.type === 'bulleted'" class="block-line list-block">
              <span class="list-bullet">•</span>
              <textarea v-if="canEdit" v-model="block.content" @input="onBlockChange" rows="1" class="block-input textarea" placeholder="列表项" />
              <div v-else>{{ block.content }}</div>
            </div>
            <div v-else-if="block.type === 'numbered'" class="block-line list-block">
              <span class="list-bullet num">{{ idx + 1 }}.</span>
              <textarea v-if="canEdit" v-model="block.content" @input="onBlockChange" rows="1" class="block-input textarea" placeholder="列表项" />
              <div v-else>{{ block.content }}</div>
            </div>
            <div v-else-if="block.type === 'todo'" class="block-line list-block">
              <el-checkbox v-model="block.checked" :disabled="!canEdit" @change="onBlockChange" style="margin-right:8px;" />
              <textarea v-if="canEdit" v-model="block.content" @input="onBlockChange" rows="1" class="block-input textarea" :style="block.checked ? 'text-decoration:line-through;color:#94a3b8;' : ''" placeholder="待办事项" />
              <div v-else :style="block.checked ? 'text-decoration:line-through;color:#94a3b8;' : ''">{{ block.content }}</div>
            </div>
            <div v-else-if="block.type === 'quote'" class="block-line">
              <div style="border-left:4px solid #d1d5db;padding:4px 12px;background:#f9fafb;border-radius:0 6px 6px 0;">
                <textarea v-if="canEdit" v-model="block.content" @input="onBlockChange" rows="2" class="block-input textarea" placeholder="引用内容..." />
                <div v-else>{{ block.content }}</div>
              </div>
            </div>
            <div v-else-if="block.type === 'code'" class="block-line">
              <div style="background:#1e293b;border-radius:8px;padding:10px 12px;">
                <div style="color:#94a3b8;font-size:12px;margin-bottom:6px;">{{ block.language || 'code' }}</div>
                <textarea v-if="canEdit" v-model="block.content" @input="onBlockChange" rows="4" class="block-input codearea" placeholder="// code here" />
                <pre v-else style="margin:0;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;">{{ block.content }}</pre>
              </div>
            </div>
            <div v-else-if="block.type === 'divider'" class="block-line">
              <hr style="border:none;border-top:2px dashed #e2e8f0;margin:12px 0;" />
            </div>
            <div v-else class="block-line">
              <textarea v-if="canEdit" v-model="block.content" @input="onBlockChange" rows="1" class="block-input textarea" />
              <div v-else>{{ block.content }}</div>
            </div>
          </div>

          <div v-if="canEdit" style="margin-top:10px;">
            <el-button size="small" link type="primary" @click="appendBlock()">
              <el-icon style="margin-right:4px;"><Plus /></el-icon> + 添加段落
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <aside v-if="rightPanel" style="width:360px;flex-shrink:0;border-left:1px solid #eaeef2;background:#fff;display:flex;flex-direction:column;min-height:0;">
      <div style="padding:12px 16px;border-bottom:1px solid #eaeef2;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-weight:600;font-size:15px;">
          <el-icon style="margin-right:4px;vertical-align:-2px;"><ChatDotRound /></el-icon>
          {{ activeBlockId ? '块评论' : '全部评论' }}
        </div>
        <el-button size="small" link @click="togglePanel">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <div style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
        <el-radio-group v-model="commentFilter" size="small" @change="loadComments">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="open">未解决</el-radio-button>
          <el-radio-button value="resolved">已解决</el-radio-button>
        </el-radio-group>
        <el-button v-if="activeBlockId" size="small" link style="margin-left:8px;" @click="activeBlockId = null; loadComments();">
          ← 查看全部
        </el-button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:10px 12px;min-height:0;">
        <div v-if="viewComments.length" style="display:flex;flex-direction:column;gap:12px;">
          <div v-for="c in viewComments" :key="c.id" class="comment-card" :class="{ resolved: c.resolved }">
            <div class="flex items-start gap-8">
              <el-avatar :size="32" style="background:#4f46e5;flex-shrink:0;">{{ (users[c.createdBy]?.name || '?').charAt(0) }}</el-avatar>
              <div style="flex:1;min-width:0;">
                <div class="flex items-center gap-8">
                  <span style="font-weight:600;">{{ users[c.createdBy]?.name || users[c.createdBy]?.username || '未知用户' }}</span>
                  <span v-if="activeBlockId" class="text-sm text-muted">#{{ shortBlockId(c.blockId) }}</span>
                  <span class="text-sm text-muted">{{ formatTime(c.createdAt) }}</span>
                  <span v-if="c.resolved" class="role-tag role-viewer">已解决</span>
                  <div style="flex:1;"></div>
                  <el-dropdown @command="(cmd) => commentCmd(cmd, c)" trigger="click">
                    <el-button size="small" link><el-icon><MoreFilled /></el-icon></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item v-if="!c.resolved" command="resolve">标记已解决</el-dropdown-item>
                        <el-dropdown-item v-else command="resolve">重新打开</el-dropdown-item>
                        <el-dropdown-item v-if="c.createdBy === userStore.user?.id" command="delete" style="color:#ef4444;">删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
                <div class="mark-block" style="margin-top:4px;" v-html="renderMentions(c.content)"></div>
                <div style="margin-top:8px;display:flex;gap:6px;align-items:center;">
                  <el-button size="small" link @click="startReply(c.id)">回复</el-button>
                  <el-button size="small" link @click="toggleExpandReplies(c.id)">
                    {{ (replyCount(c.id) || 0) ? `查看 ${replyCount(c.id)} 条回复` : '暂无回复' }}
                  </el-button>
                </div>
                <div v-if="expandedReplies.has(c.id)">
                  <div v-for="r in repliesOf(c.id)" :key="r.id" style="margin-left:8px;margin-top:8px;padding-left:12px;border-left:2px solid #e2e8f0;">
                    <div class="flex items-center gap-8">
                      <el-avatar :size="24" style="background:#6366f1;">{{ (users[r.createdBy]?.name || '?').charAt(0) }}</el-avatar>
                      <span style="font-weight:500;font-size:13px;">{{ users[r.createdBy]?.name || '?' }}</span>
                      <span class="text-xs text-muted">{{ formatTime(r.createdAt) }}</span>
                    </div>
                    <div class="mark-block text-sm" style="margin-top:2px;" v-html="renderMentions(r.content)"></div>
                  </div>
                </div>
                <div v-if="replyingTo === c.id" style="margin-top:8px;display:flex;gap:6px;">
                  <el-input
                    ref="replyInputRef"
                    v-model="replyText"
                    size="small"
                    type="textarea" :rows="2"
                    placeholder="回复评论... 输入 @ 可以提及"
                    @keyup.enter.ctrl="submitReply(c.id)"
                  />
                  <div style="display:flex;flex-direction:column;gap:4px;">
                    <el-button size="small" type="primary" @click="submitReply(c.id)">发送</el-button>
                    <el-button size="small" @click="replyingTo = null">取消</el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state" style="padding:40px 10px;">
          <div class="icon">💬</div>
          <div class="text">暂无评论，在编辑区点击块旁的 💬 发起评论</div>
        </div>
      </div>
      <div style="padding:10px 12px;border-top:1px solid #f1f5f9;background:#f9fafb;">
        <div class="text-sm" style="margin-bottom:6px;color:#374151;font-weight:500;">
          {{ activeBlockId ? `对块 #${shortBlockId(activeBlockId)} 评论` : '对整个笔记评论' }}
          <el-button v-if="activeBlockId" size="small" link style="float:right;" @click="activeBlockId = null">取消定位</el-button>
        </div>
        <el-input
          v-model="newComment"
          type="textarea" :rows="3"
          placeholder="输入评论内容... 输入 @ 可以提及同事或 @所有人"
          @keyup.enter.ctrl="submitNewComment"
        />
        <div v-if="showMentions" class="mentions-picker">
          <div
            v-for="m in mentionCandidates" :key="m.key"
            class="mention-item"
            :class="{ active: mentionIndex === mentionCandidates.indexOf(m) }"
            @click="insertMention(m)"
          >
            <el-icon style="margin-right:6px;">{{ m.icon }}</el-icon>
            <span style="font-weight:500;">{{ m.label }}</span>
            <span class="text-sm text-muted" style="margin-left:8px;">{{ m.desc }}</span>
          </div>
        </div>
        <div style="margin-top:6px;text-align:right;">
          <el-button size="small" type="primary" @click="submitNewComment">
            <el-icon style="margin-right:4px;"><Promotion /></el-icon> 发送评论
          </el-button>
        </div>
      </div>
    </aside>

    <el-dialog v-model="showVersions" title="历史版本" width="640px">
      <div v-if="versions.length" style="max-height:480px;overflow-y:auto;">
        <div v-for="v in versions" :key="v.id" style="border:1px solid #f1f5f9;border-radius:10px;padding:14px;margin-bottom:10px;">
          <div class="flex items-center justify-between">
            <div>
              <div style="font-weight:600;">
                <el-icon style="margin-right:4px;vertical-align:-2px;"><CollectionTag /></el-icon>
                v{{ v.version }} {{ v.label ? `· ${v.label}` : '' }}
              </div>
              <div class="text-sm text-muted" style="margin-top:4px;">
                保存者：{{ users[v.createdBy]?.name || '?' }} · {{ formatTime(v.createdAt) }}
              </div>
            </div>
            <el-button size="small" type="primary" plain @click="rollbackTo(v)">回滚到此版本</el-button>
          </div>
          <div class="text-sm mt-8" style="color:#475569;background:#f9fafb;padding:8px 12px;border-radius:6px;">
            标题：{{ v.title || '未命名' }} · 标签：{{ (v.tags || []).join(', ') || '无' }} · {{ (v.blocks || []).length }} 个块
          </div>
        </div>
      </div>
      <div v-else class="empty-state" style="padding:40px;">
        <div class="icon">🗂️</div>
        <div class="text">还没有保存任何版本快照，点击顶部“保存当前快照”按钮</div>
      </div>
    </el-dialog>

    <el-dialog v-model="showReplay" title="编辑历史回放" width="720px">
      <div v-if="replayEvents.length">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
          <el-button size="small" @click="replayStep(-10)">⏪</el-button>
          <el-button size="small" @click="replayPlaying = !replayPlaying">
            {{ replayPlaying ? '⏸ 暂停' : '▶ 播放' }}
          </el-button>
          <el-button size="small" @click="replayStep(10)">⏩</el-button>
          <el-slider v-model="replayIdx" :max="replayEvents.length - 1" style="flex:1;" />
          <span class="text-sm text-muted">{{ replayIdx + 1 }} / {{ replayEvents.length }}</span>
        </div>
        <div style="max-height:400px;overflow-y:auto;background:#f9fafb;padding:14px;border-radius:8px;">
          <div v-for="(ev, i) in replayEvents.slice(Math.max(0, replayIdx - 10), replayIdx + 1)" :key="i" class="text-sm" style="margin-bottom:6px;">
            <span style="color:#64748b;">[{{ formatTime(ev.t) }}]</span>
            <el-avatar :size="16" style="margin:0 6px;">{{ users[ev.by]?.name?.charAt(0) || '?' }}</el-avatar>
            <span>{{ users[ev.by]?.name || '?' }}：编辑操作</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state" style="padding:30px;">
        <div class="icon">⏳</div>
        <div class="text">加载历史事件中...</div>
      </div>
    </el-dialog>

    <el-dialog v-model="showSaveVersion" title="保存版本快照" width="420px">
      <el-input v-model="versionLabel" placeholder="版本标签（可选，如：初稿、评审稿）" />
      <template #footer>
        <el-button @click="showSaveVersion = false">取消</el-button>
        <el-button type="primary" @click="doSaveVersion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick, markRaw } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Clock, ArrowDown, DocumentCopy, VideoPlay, List, Download, ChatDotRound,
  Plus, MoreFilled, Close, Promotion, FolderOpen,
} from '@element-plus/icons-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useUserStore } from '@/stores/user';
import { useCollabStore } from '@/stores/collab';
import {
  workspaceApi, folderApi, noteApi, commentApi, notificationApi,
  templateApi, ioApi, tagApi, userApi,
} from '@/api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const collabStore = useCollabStore();

const wsId = computed(() => route.params.wsId);
const noteId = computed(() => route.params.noteId);

const note = ref(null);
const workspace = ref(null);
const tree = ref({ folders: [] });
const blocks = ref([]);
const localTitle = ref('');
const localTags = ref([]);
const versions = ref([]);
const comments = ref([]);
const users = ref({});
const userList = ref([]);
const allTags = ref([]);

const canEdit = ref(true);
const myRole = ref('viewer');
const collabStatus = ref('connecting');
const onlineUsers = ref({});
const collabRoom = ref(null);
const rightPanel = ref(false);
const activeBlockId = ref(null);
const commentFilter = ref('all');
const selectedBlockId = ref(null);

const showTagInput = ref(false);
const newTag = ref('');
const tagInputRef = ref(null);
const newComment = ref('');
const replyingTo = ref(null);
const replyText = ref('');
const expandedReplies = new Set();
const mentionIndex = ref(0);
const showMentions = ref(false);
const versionLabel = ref('');
const showVersions = ref(false);
const showReplay = ref(false);
const showSaveVersion = ref(false);
const replayEvents = ref([]);
const replayIdx = ref(0);
const replayPlaying = ref(false);
let replayTimer = null;
const textareaRefs = {};

const roleLabel = (r) => ({ owner: '所有者', admin: '管理员', editor: '编辑者', viewer: '浏览者', guest: '访客' })[r] || '访客';
const collabStatusColor = computed(() => ({ connecting: '#f59e0b', open: '#10b981', closed: '#ef4444', error: '#ef4444' }[collabStatus.value] || '#94a3b8'));
const collabStatusText = computed(() => ({ connecting: '连接中...', open: '实时协作已连接', closed: '连接已断开', error: '连接出错' }[collabStatus.value] || ''));

const viewComments = computed(() => {
  let list = comments.value.filter(c => !c.parentId);
  if (activeBlockId.value) list = list.filter(c => c.blockId === activeBlockId.value);
  if (commentFilter.value === 'open') list = list.filter(c => !c.resolved);
  else if (commentFilter.value === 'resolved') list = list.filter(c => c.resolved);
  return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
});
const currentFolder = computed(() => tree.value.folders?.find?.(f => f.id === note.value?.folderId) || null);

function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}
function markdown(s) {
  try { return DOMPurify.sanitize(marked.parse(s || '', { breaks: true, gfm: true })); }
  catch (e) { return s || ''; }
}
function shortBlockId(id) { return (id || '').slice(-6); }
function blockCommentCount(id) { return comments.value.filter(c => !c.parentId && c.blockId === id).length; }
function repliesOf(id) { return comments.value.filter(c => c.parentId === id); }
function replyCount(id) { return comments.value.filter(c => c.parentId === id).length; }
function toggleExpandReplies(id) {
  if (expandedReplies.has(id)) expandedReplies.delete(id);
  else expandedReplies.add(id);
}

async function loadAll() {
  if (!noteId.value) return;
  const d = await noteApi.get(noteId.value);
  note.value = d.note;
  blocks.value = (d.note.blocks || [{ id: genId('b_'), type: 'markdown', content: '' }]).map(b => ({ ...b }));
  localTitle.value = d.note.title || '';
  localTags.value = [...(d.note.tags || [])];
  versions.value = d.versions || [];
  comments.value = d.comments || [];
  const c2 = await commentApi.listByNote(noteId.value);
  if (c2) {
    comments.value = c2.items || comments.value;
    users.value = c2.users || {};
  }
  const [ws, t, tags, ul] = await Promise.all([
    workspaceApi.get(wsId.value),
    folderApi.tree(wsId.value),
    tagApi.list(wsId.value),
    userApi.list({ workspaceId: wsId.value }),
  ]);
  workspace.value = ws.workspace;
  tree.value = t || { folders: [] };
  allTags.value = tags.items || [];
  userList.value = ul.items || [];
  const u = { ...(ws.users || {}) };
  for (const x of ul.items || []) u[x.id] = x;
  users.value = u;
  const role = ws.roleMap?.[userStore.user?.id] || null;
  myRole.value = role || 'viewer';
  const editRoles = ['owner', 'admin', 'editor'];
  canEdit.value = editRoles.includes(myRole.value);
  initCollab();
}

function initCollab() {
  if (!noteId.value || !userStore.user) return;
  try {
    const room = collabStore.connectRoom(noteId.value, {
      user: userStore.user,
      onStatus: (s) => { collabStatus.value = s; },
      onAwareness: (states) => {
        const out = {};
        for (const [cid, u] of Object.entries(states)) {
          if (u && u.id !== userStore.user?.id) out[u.id] = u;
        }
        onlineUsers.value = out;
      },
      onCustom: (t, p) => {
        if (t === 1) { replayEvents.value = p.events || []; }
      },
    });
    collabRoom.value = room;
    const meta = room.ydoc.getMap('meta');
    meta.observe(() => {
      const t = meta.get('title');
      if (t && t !== localTitle.value && document.activeElement?.tagName !== 'INPUT') localTitle.value = t;
      const blk = meta.get('blocks');
      if (Array.isArray(blk)) blocks.value = blk;
      const tg = meta.get('tags');
      if (Array.isArray(tg)) localTags.value = tg;
    });
    setTimeout(() => {
      if (collabStatus.value === 'connecting') collabStatus.value = 'open';
    }, 1500);
  } catch (e) {
    console.warn('collab init warn', e);
  }
}

function syncYMeta() {
  if (!collabRoom.value) return;
  try {
    const meta = collabRoom.value.ydoc.getMap('meta');
    meta.set('title', localTitle.value);
    meta.set('blocks', blocks.value);
    meta.set('tags', localTags.value);
  } catch (e) {}
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await noteApi.update(noteId.value, {
        title: localTitle.value,
        tags: localTags.value,
        blocks: blocks.value,
      });
      note.value = { ...note.value, title: localTitle.value, tags: localTags.value, blocks: blocks.value };
    } catch (e) {}
  }, 1500);
}

function saveTitle() { syncYMeta(); scheduleSave(); }
function onBlockChange() { syncYMeta(); scheduleSave(); autoGrow(); }

function setTextareaRef(id, el) {
  if (el) textareaRefs[id] = el;
}
function autoGrow() {
  nextTick(() => {
    for (const el of Object.values(textareaRefs)) {
      if (el && el.style) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
      }
    }
  });
}
watch(() => blocks.value.length, autoGrow);

function genId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function insertBlock(type = 'markdown', idx = -1) {
  if (!canEdit.value) return;
  const block = { id: genId('b_'), type, content: '', checked: false, language: 'javascript' };
  if (idx < 0) blocks.value.push(block);
  else blocks.value.splice(idx, 0, block);
  syncYMeta(); scheduleSave();
  nextTick(() => {
    const el = document.querySelectorAll('.block-wrapper textarea, .block-wrapper input')[Math.max(0, idx < 0 ? blocks.value.length - 1 : idx)];
    el?.focus();
  });
}
function appendBlock() { insertBlock('markdown', blocks.value.length); }
function insertBlockBefore(idx) { insertBlock('markdown', idx); }

function blockCmd(cmd, block, idx) {
  if (!canEdit.value) return;
  if (cmd === 'moveUp' && idx > 0) {
    [blocks.value[idx], blocks.value[idx-1]] = [blocks.value[idx-1], blocks.value[idx]];
  } else if (cmd === 'moveDown' && idx < blocks.value.length - 1) {
    [blocks.value[idx], blocks.value[idx+1]] = [blocks.value[idx+1], blocks.value[idx]];
  } else if (cmd === 'turnType') {
    const types = [
      { value: 'markdown', label: '正文段落' }, { value: 'heading', label: '标题 H1' },
      { value: 'h2', label: '标题 H2' }, { value: 'h3', label: '标题 H3' },
      { value: 'bulleted', label: '无序列表' }, { value: 'numbered', label: '有序列表' },
      { value: 'todo', label: '待办清单' }, { value: 'quote', label: '引用' },
      { value: 'code', label: '代码块' }, { value: 'divider', label: '分割线' },
    ];
    ElMessageBox({
      title: '转换块类型',
      message: () => {
        const { h } = require('vue');
        const options = types;
        return h('div', { style: 'display:flex;flex-direction:column;gap:6px;' },
          options.map(o => h('button', {
            style: 'padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;background:#fff;text-align:left;',
            onClick: () => { window.__blockNewType = o.value; ElMessageBox.close(); },
          }, o.label))
        );
      },
    }).then(() => {}).catch(() => {
      if (window.__blockNewType) {
        blocks.value[idx].type = window.__blockNewType;
        window.__blockNewType = null;
        syncYMeta(); scheduleSave();
      }
    });
  } else if (cmd === 'duplicate') {
    blocks.value.splice(idx + 1, 0, { ...block, id: genId('b_') });
  } else if (cmd === 'delete') {
    blocks.value.splice(idx, 1);
    if (!blocks.value.length) insertBlock('markdown');
  }
  syncYMeta(); scheduleSave();
}

function selectBlock(id) { selectedBlockId.value = id; }
function openCommentsForBlock(id) {
  activeBlockId.value = id;
  rightPanel.value = true;
  loadComments();
}

function startAddTag() {
  showTagInput.value = true;
  newTag.value = '';
  nextTick(() => tagInputRef.value?.focus());
}
function addTagFromInput() {
  const t = newTag.value.trim();
  if (t && !localTags.value.includes(t)) localTags.value.push(t);
  newTag.value = '';
  showTagInput.value = false;
  syncYMeta(); scheduleSave();
}
function removeTag(t) {
  if (!canEdit.value) return;
  localTags.value = localTags.value.filter(x => x !== t);
  syncYMeta(); scheduleSave();
}

function togglePanel() { rightPanel.value = !rightPanel.value; }

async function loadComments() {
  try {
    const params = {};
    if (commentFilter.value === 'resolved') params.resolved = 'true';
    else if (commentFilter.value === 'open') params.resolved = 'false';
    const d = await commentApi.listByNote(noteId.value, params);
    if (d) { comments.value = d.items || []; users.value = { ...users.value, ...(d.users || {}) }; }
  } catch (e) {}
}

function renderMentions(text) {
  let html = markdown(text);
  html = html.replace(/@(\S+)/g, (m, tag) => {
    const t = tag.replace(/[.,:!?，。！？]/g, '');
    const u = userList.value.find(x => x.username === t);
    if (u) return `<span style="background:#eef2ff;color:#4f46e5;padding:1px 6px;border-radius:4px;">@${u.name}</span>`;
    if (['all','everyone','所有人'].includes(t))
      return `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;">@所有人</span>`;
    if (['admin','管理员'].includes(t))
      return `<span style="background:#fff7ed;color:#9a3412;padding:1px 6px;border-radius:4px;">@管理员</span>`;
    return m;
  });
  return html;
}

const mentionCandidates = computed(() => {
  const items = [
    { key: 'everyone', label: '@所有人', desc: '通知所有人', icon: '👥' },
    { key: 'admin', label: '@管理员', desc: '通知所有管理员', icon: '🛡️' },
    { key: 'editor', label: '@编辑者', desc: '通知编辑角色', icon: '✏️' },
  ];
  for (const u of userList.value) {
    items.push({ key: u.username, label: `@${u.name}`, desc: u.username, icon: '👤', userId: u.id });
  }
  return items;
});
let lastAtPos = -1;
function checkMention(text, el) {
  const last = text.lastIndexOf('@');
  if (last === -1 || last < lastAtPos || last < text.length - 15) {
    showMentions.value = false;
    return;
  }
  const after = text.slice(last + 1);
  if (/\s/.test(after)) { showMentions.value = false; return; }
  lastAtPos = last;
  const kw = after.toLowerCase();
  mentionCandidates.value = mentionCandidates.value.filter(m =>
    m.label.toLowerCase().includes(kw) || m.desc.toLowerCase().includes(kw) || m.key.toLowerCase().includes(kw)
  );
  showMentions.value = mentionCandidates.value.length > 0;
  mentionIndex.value = 0;
}
function insertMention(m) {
  const at = newComment.value.lastIndexOf('@');
  if (at === -1) return;
  newComment.value = newComment.value.slice(0, at) + '@' + m.key + ' ';
  showMentions.value = false;
  lastAtPos = -1;
}
async function submitNewComment() {
  const content = newComment.value.trim();
  if (!content) return;
  await commentApi.create({ noteId: noteId.value, blockId: activeBlockId.value, content });
  newComment.value = '';
  ElMessage.success('评论已发送');
  loadComments();
}
function startReply(id) { replyingTo.value = id; replyText.value = ''; nextTick(() => document.querySelector('.reply-input textarea')?.focus()); }
async function submitReply(parentId) {
  const content = replyText.value.trim();
  if (!content) return;
  await commentApi.create({ noteId: noteId.value, parentId, content });
  replyText.value = '';
  replyingTo.value = null;
  expandedReplies.add(parentId);
  ElMessage.success('回复已发送');
  loadComments();
}
async function commentCmd(cmd, c) {
  if (cmd === 'resolve') { await commentApi.resolve(c.id); ElMessage.success(c.resolved ? '已重新打开' : '已标记解决'); loadComments(); }
  else if (cmd === 'delete') {
    try { await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' }); await commentApi.remove(c.id); ElMessage.success('已删除'); loadComments(); } catch (e) {}
  }
}

function cmdIO(cmd) {
  if (cmd === 'import') {
    ElMessage.info('请返回工作空间页面使用导入功能');
    return;
  }
  const map = { md: ioApi.exportMd, html: ioApi.exportHtml, pdf: ioApi.exportPdf };
  const url = map[cmd](noteId.value);
  const token = localStorage.getItem('teamnote_token');
  const a = document.createElement('a');
  const sep = url.includes('?') ? '&' : '?';
  a.href = url + sep + 'token=' + encodeURIComponent(token);
  a.target = '_blank';
  a.download = (note.value.title || 'note') + '.' + cmd;
  a.click();
}

function verCmd(cmd) {
  if (cmd === 'save') { versionLabel.value = ''; showSaveVersion.value = true; }
  else if (cmd === 'list') { showVersions.value = true; loadVersions(); }
  else if (cmd === 'replay') {
    showReplay.value = true;
    replayEvents.value = [];
    replayIdx.value = 0;
    collabRoom.value?.sendCustom(1, {});
  }
}
async function loadVersions() {
  try {
    const d = await noteApi.listVersions(noteId.value);
    versions.value = d.items || [];
    users.value = { ...users.value, ...(d.users || {}) };
  } catch (e) {}
}
async function doSaveVersion() {
  await noteApi.saveVersion(noteId.value, { label: versionLabel.value });
  ElMessage.success('版本已保存');
  showSaveVersion.value = false;
  loadVersions();
}
async function rollbackTo(v) {
  try {
    await ElMessageBox.confirm(`确认回滚到 v${v.version}？当前内容将被快照覆盖。`, '回滚确认', { type: 'warning' });
    const d = await noteApi.rollback(noteId.value, { versionId: v.id });
    blocks.value = d.note.blocks || [];
    localTitle.value = d.note.title || '';
    localTags.value = [...(d.note.tags || [])];
    syncYMeta();
    ElMessage.success('已回滚');
    showVersions.value = false;
    loadVersions();
  } catch (e) {}
}

function replayStep(delta) {
  replayIdx.value = Math.min(Math.max(0, replayIdx.value + delta), replayEvents.value.length - 1);
}
watch(() => replayPlaying.value, (v) => {
  if (v) {
    replayTimer = setInterval(() => {
      if (replayIdx.value < replayEvents.value.length - 1) replayIdx.value++;
      else replayPlaying.value = false;
    }, 300);
  } else {
    clearInterval(replayTimer);
  }
});
onBeforeUnmount(() => clearInterval(replayTimer));

onMounted(async () => {
  await loadAll();
  autoGrow();
});
onBeforeUnmount(() => {
  if (noteId.value) collabStore.disconnectRoom(noteId.value);
});
</script>

<style scoped>
.block-wrapper {
  position: relative;
  padding: 2px 6px 2px 50px;
  margin: 2px -6px;
  border-radius: 6px;
  transition: background 0.15s;
}
.block-wrapper:hover { background: #fafbfc; }
.block-wrapper.is-selected { background: #eef2ff; }
.block-wrapper.has-comment::after {
  content: var(--comment-count);
  position: absolute;
  right: 8px; top: 6px;
  width: 20px; height: 20px;
  background: #4f46e5; color: #fff;
  border-radius: 50%;
  font-size: 11px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.block-toolbar {
  position: absolute;
  left: 0; top: 2px;
  display: flex;
  opacity: 0;
  transition: opacity 0.15s;
}
.block-wrapper:hover .block-toolbar { opacity: 1; }
.block-line { padding: 4px 0; }
.block-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font: inherit;
  color: inherit;
  line-height: 1.75;
  padding: 2px 0;
  overflow: hidden;
}
.block-input:focus { background: rgba(79, 70, 229, 0.04); border-radius: 4px; }
.heading1 { font-size: 30px; font-weight: 700; padding: 10px 0 4px; }
.heading2 { font-size: 24px; font-weight: 600; padding: 8px 0 2px; }
.heading3 { font-size: 19px; font-weight: 600; padding: 6px 0; }
.textarea { min-height: 28px; }
.codearea {
  background: transparent !important;
  color: #e2e8f0 !important;
  min-height: 80px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
}
.list-block { display: flex; gap: 8px; align-items: start; }
.list-bullet {
  width: 20px; flex-shrink: 0; text-align: right;
  color: #94a3b8; padding-top: 4px; user-select: none;
}
.list-bullet.num { font-variant-numeric: tabular-nums; }

.comment-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  transition: opacity 0.2s;
}
.comment-card.resolved { opacity: 0.6; }

.mentions-picker {
  position: absolute;
  bottom: 80px;
  left: 10px;
  right: 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  max-height: 240px;
  overflow-y: auto;
  z-index: 10;
}
.mention-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.mention-item:hover, .mention-item.active { background: #f1f5f9; }
</style>
