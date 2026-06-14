<template>
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);padding:20px;">
    <div style="width:440px;background:#fff;border-radius:16px;padding:36px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-size:48px;margin-bottom:12px;">✉️</div>
        <h1 style="font-size:22px;margin:0 0 6px 0;color:#111827;">你被邀请加入团队</h1>
        <p style="color:#6b7280;margin:0;font-size:14px;">使用邀请链接创建账号并加入</p>
      </div>
      <el-form :model="form" label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" size="large" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.name" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%;height:44px;" :loading="loading" @click="submit">接受邀请并加入</el-button>
      </el-form>
      <div style="margin-top:16px;text-align:center;">
        <router-link to="/login" style="color:#4f46e5;font-size:13px;">已有账号？直接登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);
const form = reactive({ token: '', username: '', password: '', name: '' });
onMounted(() => { form.token = route.params.token; });
async function submit() {
  if (!form.username || !form.password) return ElMessage.warning('请填写用户名和密码');
  loading.value = true;
  try {
    await userStore.loginWithInvite(form);
    ElMessage.success('加入成功');
    router.replace('/home');
  } finally { loading.value = false; }
}
</script>
