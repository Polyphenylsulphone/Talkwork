<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Check, Upload, X } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import { useAuthStore } from '../stores/auth';
import { COLLEGES } from '../constants';
import { DEFAULT_AVATARS } from '../constants/defaultAvatars';
import { toast } from '../stores/toast';

const router = useRouter();
const auth = useAuthStore();

const saving = ref(false);
const editForm = reactive({
  username: '',
  college: 'other',
  bio: '',
});
const avatarPreview = ref('');
const avatarBlob = ref(null);
const avatarMode = ref('default');
const selectedDefaultAvatar = ref('');
const defaultAvatarOptions = ref([...DEFAULT_AVATARS]);
const cropOpen = ref(false);
const cropSrc = ref('');
const cropZoom = ref(1);
const cropX = ref(0);
const cropY = ref(0);

onMounted(async () => {
  const me = unwrap(await http.get('/auth/me'));
  try {
    const avatars = unwrap(await http.get('/auth/default-avatars'));
    if (Array.isArray(avatars) && avatars.length) {
      defaultAvatarOptions.value = avatars.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    /* fallback to local defaults */
  }
  auth.patchUser(me);
  editForm.username = auth.user?.username || '';
  editForm.college = auth.user?.college || 'other';
  editForm.bio = auth.user?.bio || '';
  avatarPreview.value = auth.user?.avatar_url || defaultAvatarOptions.value[0] || '';
  if (defaultAvatarOptions.value.includes(avatarPreview.value)) {
    avatarMode.value = 'default';
    selectedDefaultAvatar.value = avatarPreview.value;
  } else {
    avatarMode.value = 'upload';
  }
});

function goBack() {
  router.push({ name: 'profile' });
}

function openCropper(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return toast.error('请选择图片文件');
  const fr = new FileReader();
  fr.onload = () => {
    cropSrc.value = String(fr.result || '');
    cropZoom.value = 1;
    cropX.value = 0;
    cropY.value = 0;
    cropOpen.value = true;
  };
  fr.readAsDataURL(file);
}

function closeCropper() {
  cropOpen.value = false;
  cropSrc.value = '';
}

async function applyCrop() {
  if (!cropSrc.value) return;
  const img = new Image();
  img.src = cropSrc.value;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  const frame = 280;
  const output = 400;
  const baseScale = Math.max(frame / img.width, frame / img.height) * cropZoom.value;
  const drawW = img.width * baseScale;
  const drawH = img.height * baseScale;
  const dx = (frame - drawW) / 2 + cropX.value;
  const dy = (frame - drawH) / 2 + cropY.value;
  const canvas = document.createElement('canvas');
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, output, output);
  ctx.save();
  ctx.beginPath();
  ctx.arc(output / 2, output / 2, output / 2, 0, Math.PI * 2);
  ctx.clip();
  const ratio = output / frame;
  ctx.drawImage(img, dx * ratio, dy * ratio, drawW * ratio, drawH * ratio);
  ctx.restore();
  const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.92));
  if (!blob) return toast.error('裁剪失败，请重试');
  avatarMode.value = 'upload';
  avatarBlob.value = blob;
  avatarPreview.value = URL.createObjectURL(blob);
  closeCropper();
}

const cropStyle = computed(() => ({
  transform: `translate(${cropX.value}px, ${cropY.value}px) scale(${cropZoom.value})`,
}));

async function saveProfile() {
  if (saving.value) return;
  const username = editForm.username.trim().slice(0, 20);
  if (!username) return toast.error('昵称不能为空');
  const payload = {
    username,
    bio: editForm.bio.trim().slice(0, 200),
    college: editForm.college,
  };
  saving.value = true;
  try {
    if (avatarMode.value === 'default') {
      payload.avatar_url = selectedDefaultAvatar.value || defaultAvatarOptions.value[0] || '';
    } else if (avatarBlob.value) {
      const fd = new FormData();
      fd.append('file', new File([avatarBlob.value], 'avatar.png', { type: 'image/png' }));
      const { url } = unwrap(await http.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
      payload.avatar_url = url;
    }
    const me = unwrap(await http.patch('/auth/me', payload));
    auth.patchUser(me);
    toast.success('资料已更新');
    goBack();
  } finally {
    saving.value = false;
  }
}

function chooseDefaultAvatar(url) {
  avatarMode.value = 'default';
  selectedDefaultAvatar.value = url;
  avatarPreview.value = url;
  avatarBlob.value = null;
}

function switchToDefaultAvatar() {
  const next = selectedDefaultAvatar.value || defaultAvatarOptions.value[0] || '';
  if (!next) return;
  chooseDefaultAvatar(next);
}
</script>

<template>
  <div class="page-wrap">
    <section class="panel tw-card">
      <div class="head">
        <h2>编辑资料</h2>
        <button class="icon-btn" type="button" @click="goBack"><X :size="14" /></button>
      </div>

      <div class="grid">
        <div class="left">
          <div class="lbl">头像</div>
          <div class="crop-preview">
            <img v-if="avatarPreview" :src="avatarPreview" alt="头像预览" />
            <span v-else>{{ editForm.username?.slice(0, 1) || '?' }}</span>
          </div>
          <div class="avatar-actions">
            <button class="tw-btn tw-btn-ghost mode-btn" :class="{ on: avatarMode === 'default' }" type="button" @click="switchToDefaultAvatar">
              默认头像
            </button>
            <label class="tw-btn tw-btn-ghost up-btn mode-btn" :class="{ on: avatarMode === 'upload' }">
              <Upload :size="14" />
              上传头像
              <input type="file" accept="image/*" hidden @change="openCropper" />
            </label>
          </div>
          <div v-if="avatarMode === 'default'" class="avatar-grid">
            <button
              v-for="url in defaultAvatarOptions"
              :key="url"
              type="button"
              class="avatar-item"
              :class="{ on: selectedDefaultAvatar === url }"
              @click="chooseDefaultAvatar(url)"
            >
              <img :src="url" alt="默认头像" loading="lazy" />
            </button>
          </div>
        </div>
        <div class="right">
          <label class="lbl">昵称</label>
          <input v-model="editForm.username" class="tw-input" maxlength="20" placeholder="输入昵称" />
          <label class="lbl">学院</label>
          <select v-model="editForm.college" class="tw-input">
            <option v-for="c in COLLEGES" :key="c.id" :value="c.id">{{ c.label }}</option>
          </select>
          <label class="lbl">简介</label>
          <textarea v-model="editForm.bio" class="tw-input bio-input" maxlength="200" placeholder="介绍一下你自己（最多200字）" />
          <div class="edit-row">
            <span class="muted">{{ editForm.bio.length }}/200</span>
            <div class="grow" />
            <button class="tw-btn tw-btn-ghost" type="button" @click="goBack">取消</button>
            <button class="tw-btn tw-btn-primary" type="button" :disabled="saving" @click="saveProfile">{{ saving ? '保存中…' : '保存资料' }}</button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="cropOpen" class="cropper tw-card">
      <div class="crop-head">
        <b>头像裁剪</b>
        <button class="icon-btn" type="button" @click="closeCropper"><X :size="14" /></button>
      </div>
      <div class="crop-frame">
        <img :src="cropSrc" class="crop-img" :style="cropStyle" alt="裁剪图片" />
      </div>
      <div class="crop-ctrl">
        <label>
          缩放
          <input v-model.number="cropZoom" type="range" min="1" max="2.4" step="0.01" />
        </label>
        <label>
          左右
          <input v-model.number="cropX" type="range" min="-120" max="120" step="1" />
        </label>
        <label>
          上下
          <input v-model.number="cropY" type="range" min="-120" max="120" step="1" />
        </label>
      </div>
      <div class="edit-row">
        <div class="grow" />
        <button class="tw-btn tw-btn-ghost" type="button" @click="closeCropper">取消</button>
        <button class="tw-btn tw-btn-primary" type="button" @click="applyCrop">
          <Check :size="14" />
          使用裁剪结果
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-wrap {
  min-height: calc(100vh - 120px);
  display: grid;
  place-items: center;
  gap: 12px;
  padding: 16px;
}
.panel {
  width: min(760px, 100%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  padding: 14px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.head h2 {
  margin: 0;
  font-size: 18px;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  background: #fff;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}
.grid {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 14px;
}
.left {
  display: grid;
  align-content: start;
  gap: 10px;
}
.right {
  display: grid;
  gap: 8px;
}
.lbl {
  font-size: 12px;
  color: var(--tw-muted);
  font-weight: 800;
}
.crop-preview {
  width: 110px;
  height: 110px;
  border-radius: 999px;
  overflow: hidden;
  border: 2px solid rgba(26, 86, 219, 0.2);
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.7);
  font-size: 36px;
  font-weight: 900;
}
.crop-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.up-btn {
  width: fit-content;
}
.avatar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mode-btn.on {
  border-color: rgba(26, 86, 219, 0.35);
  background: rgba(26, 86, 219, 0.1);
}
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.avatar-item {
  border: 2px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.7);
  padding: 4px;
  cursor: pointer;
}
.avatar-item.on {
  border-color: rgba(26, 86, 219, 0.85);
}
.avatar-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.bio-input {
  min-height: 90px;
  resize: vertical;
}
.edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grow {
  flex: 1;
}
.muted {
  color: var(--tw-muted);
  font-size: 12px;
}
.cropper {
  width: min(760px, 100%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  padding: 12px;
}
.crop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crop-frame {
  margin-top: 10px;
  width: 280px;
  height: 280px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(26, 86, 219, 0.15);
  background: rgba(148, 163, 184, 0.12);
}
.crop-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center;
}
.crop-ctrl {
  margin-top: 12px;
  display: grid;
  gap: 8px;
  max-width: 420px;
}
.crop-ctrl label {
  font-size: 12px;
  color: var(--tw-muted);
  display: grid;
  gap: 4px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .crop-frame {
    width: min(280px, 100%);
    aspect-ratio: 1;
    height: auto;
  }
}
</style>

