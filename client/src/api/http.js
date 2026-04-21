import axios from 'axios';
import { toast } from '../stores/toast';

const TOKEN_KEY = 'tw_token';

export const http = axios.create({
  baseURL: '/api/v1',
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && typeof body.code === 'number' && body.code !== 200) {
      return Promise.reject(new Error(body.message || '请求失败'));
    }
    return res;
  },
  (err) => {
    const msg = err.response?.data?.message || err.message || '网络异常，请稍后重试';
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('tw_user');
    }
    toast.error(msg);
    return Promise.reject(err);
  }
);

export function unwrap(res) {
  return res.data?.data;
}
