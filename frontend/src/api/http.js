import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';

const TOKEN_KEY = 'teamnote_token';

const http = axios.create({
  baseURL: '/api',
  timeout: 60000,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => {
    const data = res.data;
    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code === 0) return data.data;
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(data);
    }
    return res.data;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!location.hash.includes('#/login')) router.push('/login');
    } else {
      ElMessage.error(err.response?.data?.message || err.message || '网络错误');
    }
    return Promise.reject(err);
  }
);

export const api = http;
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export default http;
