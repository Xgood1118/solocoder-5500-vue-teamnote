<template>
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);padding:20px;">
    <div style="width:420px;background:#fff;border-radius:16px;padding:40px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:12px;">📝</div>
        <h1 style="font-size:26px;margin:0 0 8px 0;color:#111827;">TeamNote</h1>
        <p style="color:#6b7280;margin:0;font-size:14px;">轻量团队协作文档工具</p>
      </div>
      <el-tabs v-model="tab" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-position="top" @submit.prevent="submitLogin">
            <el-form-item label="用户名">
              <el-input v-model="loginForm.username" placeholder="请输入用户名" size="large" autocomplete="username" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" size="large" show-password autocomplete="current-password" />
            </el-form-item>
            <el-button type="primary" size="large" style="width:100%;height:44px;font-size:15px;" :loading="loading" @click="submitLogin">登录</el-button>
          </el-form>
          <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;font-size:12px;color:#6b7280;line-height:1.8;">
            <div style="font-weight:600;color:#374151;margin-bottom:4px;">默认测试账号（密码均为 123456）：</div>
            <div>owner / admin / editor / viewer / guest</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" label-position="top" @submit.prevent="submitRegister">
            <el-form-item label="用户名">
              <el-input v-model="registerForm.username" placeholder="请输入用户名" size="large" />
            </el-form-item>
            <el-form-item label="姓名">
              <el-input v-model="registerForm.name" placeholder="请输入昵称或姓名" size="large" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="registerForm.email" placeholder="选填" size="large" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="registerForm.password" type="password" placeholder="至少6位" size="large" show-password />
            </el-form-item>
            <el-button type="primary" size="large" style="width:100%;height:44px;font-size:15px;" :loading="loading" @click="submitRegister">创建账号</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const tab = ref('login');
const loading = ref(false);
const loginForm = reactive({ username: '', password: '' });
const registerForm = reactive({ username: '', password: '', name: '', email: '' });

async function submitLogin() {
  if (!loginForm.username || !loginForm.password) return ElMessage.warning('请输入用户名和密码');
  loading.value = true;
  try {
    await userStore.login(loginForm);
    ElMessage.success('登录成功');
    const redirect = route.query.redirect || '/home';
    router.replace(redirect);
  } finally {
    loading.value = false;
  }
}
async function submitRegister() {
  if (!registerForm.username || !registerForm.password) return ElMessage.warning('请填写用户名和密码');
  loading.value = true;
  try {
    await userStore.register(registerForm);
    ElMessage.success('注册成功');
    router.replace('/home');
  } finally {
    loading.value = false;
  }
}
</script>
