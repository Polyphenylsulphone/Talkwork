<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Check, Eye, EyeOff } from 'lucide-vue-next';
import { http, unwrap } from '../api/http';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { COLLEGES } from '../constants';
import { DEFAULT_AVATARS } from '../constants/defaultAvatars';
import siteLogo from '../assets/site-logo.png';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const tab = ref('login');
const username = ref('');
const registerCode = ref('');
const password = ref('');
const password2 = ref('');
const college = ref('');
const showPwd = ref(false);
const showResetPwd = ref(false);
const fieldErr = ref({});
const forgotMode = ref(false);
const resetStep = ref(1);
const resetPhone = ref('');
const resetCode = ref('');
const resetPassword = ref('');
const resetPassword2 = ref('');
const registerCooldown = ref(0);
const resetCooldown = ref(0);
const collegeOptions = ref(
  COLLEGES.map((c) => ({
    id: c.id,
    label: c.label,
    image_url: c.registerImageUrl,
  }))
);
const onboardingOpen = ref(false);
const recommendedInterview = ref(null);
const defaultAvatarOptions = ref([...DEFAULT_AVATARS]);
const registerAvatarMode = ref('default');
const selectedDefaultAvatar = ref(DEFAULT_AVATARS[0] || '');
const registerAvatarBlob = ref(null);
const registerAvatarPreview = ref(DEFAULT_AVATARS[0] || '');
const ONBOARDING_SEEN_KEY = 'tw_onboarding_seen';

const pwdOk = computed(() => {
  const p = password.value;
  return p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);
});
const phoneOk = computed(() => /^1\d{10}$/.test(username.value.trim()));
let registerCooldownTimer = null;
let resetCooldownTimer = null;

const step = ref(1);

onMounted(async () => {
  try {
    const data = unwrap(await http.get('/auth/college-options'));
    if (Array.isArray(data) && data.length) {
      collegeOptions.value = data.map((item) => ({
        id: String(item.id || ''),
        label: String(item.label || ''),
        image_url: String(item.image_url || ''),
      }));
    }
  } catch {
    /* fallback to local placeholders */
  }
  try {
    const avatars = unwrap(await http.get('/auth/default-avatars'));
    if (Array.isArray(avatars) && avatars.length) {
      defaultAvatarOptions.value = avatars.map((item) => String(item || '').trim()).filter(Boolean);
      if (!selectedDefaultAvatar.value) selectedDefaultAvatar.value = defaultAvatarOptions.value[0];
      if (registerAvatarMode.value === 'default') {
        registerAvatarPreview.value = selectedDefaultAvatar.value;
      }
    }
  } catch {
    /* fallback to local avatar list */
  }
});

function onCollegeImgError(e, id) {
  const fallback = COLLEGES.find((c) => c.id === id)?.registerImageUrl || '';
  if (!fallback) return;
  e.target.src = fallback;
}

function validateLogin() {
  fieldErr.value = {};
  let ok = true;
  if (!username.value.trim()) {
    fieldErr.value.username = true;
    ok = false;
  }
  if (!password.value) {
    fieldErr.value.password = true;
    ok = false;
  }
  return ok;
}

async function onLogin() {
  if (!validateLogin()) return;
  try {
    const data = unwrap(await http.post('/auth/login', { username: username.value, password: password.value }));
    auth.setSession({ token: data.token, user: data.user });
    if (shouldShowOnboarding(data.user)) {
      await openOnboarding();
      return;
    }
    toast.success('欢迎回来');
    const r = route.query.redirect;
    router.replace(typeof r === 'string' && r.startsWith('/') ? r : '/');
  } catch {
    /* toast by interceptor */
  }
}

async function onRegister() {
  fieldErr.value = {};
  if (!phoneOk.value) fieldErr.value.username = true;
  if (!registerCode.value.trim()) fieldErr.value.code = true;
  if (!pwdOk.value) fieldErr.value.password = true;
  if (password.value !== password2.value) fieldErr.value.password2 = true;
  if (Object.keys(fieldErr.value).length) return;
  if (step.value === 1) {
    await http.post('/auth/register/verify-code', {
      phone: username.value.trim(),
      code: registerCode.value.trim(),
    });
    step.value = 2;
    return;
  }
  if (!college.value) {
    toast.error('请选择你的学院');
    return;
  }
  try {
    let avatarUrl = '';
    if (registerAvatarMode.value === 'default') {
      avatarUrl = selectedDefaultAvatar.value;
    } else if (registerAvatarBlob.value) {
      const fd = new FormData();
      fd.append('file', new File([registerAvatarBlob.value], 'avatar.png', { type: registerAvatarBlob.value.type || 'image/png' }));
      const { url } = unwrap(await http.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
      avatarUrl = url;
    }
    if (!avatarUrl) {
      toast.error('请选择默认头像或上传头像');
      return;
    }
    await http.post('/auth/register', {
      username: username.value.trim(),
      code: registerCode.value.trim(),
      password: password.value,
      college: college.value,
      avatar_url: avatarUrl,
    });
    const data = unwrap(await http.post('/auth/login', { username: username.value.trim(), password: password.value }));
    auth.setSession({ token: data.token, user: data.user });
    await openOnboarding();
    toast.success('注册成功');
    tab.value = 'login';
    step.value = 1;
    registerCode.value = '';
  } catch {
    /* */
  }
}

function getOnboardingSeenKey(user) {
  return `${ONBOARDING_SEEN_KEY}:${user?.id || user?.username || 'guest'}`;
}

function shouldShowOnboarding(user) {
  return !localStorage.getItem(getOnboardingSeenKey(user));
}

function markOnboardingSeen(user = auth.user) {
  localStorage.setItem(getOnboardingSeenKey(user), '1');
}

async function openOnboarding() {
  await loadRecommendedInterview();
  onboardingOpen.value = true;
}

async function loadRecommendedInterview() {
  try {
    const data = unwrap(
      await http.get('/posts', {
        params: {
          page: 1,
          pageSize: 20,
          college: college.value || undefined,
        },
      })
    );
    recommendedInterview.value = (data?.list || []).find((item) => item.post_type !== 'question') || null;
  } catch {
    recommendedInterview.value = null;
  }
}

async function onSendRegisterCode() {
  const phone = username.value.trim();
  fieldErr.value = {};
  if (!/^1\d{10}$/.test(phone)) {
    fieldErr.value.username = true;
    toast.error('请输入正确手机号');
    return;
  }
  if (registerCooldown.value > 0) {
    toast.error(`${registerCooldown.value}秒后可重新发送验证码`);
    return;
  }
  const data = unwrap(await http.post('/auth/register/send-code', { phone }));
  startRegisterCooldown(Number(data?.retry_after_seconds || 60));
  toast.success('验证码已发送（5分钟内有效）');
}

function startRegisterCooldown(seconds = 60) {
  registerCooldown.value = seconds;
  if (registerCooldownTimer) clearInterval(registerCooldownTimer);
  registerCooldownTimer = setInterval(() => {
    if (registerCooldown.value <= 1) {
      registerCooldown.value = 0;
      clearInterval(registerCooldownTimer);
      registerCooldownTimer = null;
      return;
    }
    registerCooldown.value -= 1;
  }, 1000);
}

function switchTab(t) {
  tab.value = t;
  fieldErr.value = {};
  step.value = 1;
  forgotMode.value = false;
  resetStep.value = 1;
  registerCode.value = '';
  registerAvatarMode.value = 'default';
  selectedDefaultAvatar.value = defaultAvatarOptions.value[0] || DEFAULT_AVATARS[0] || '';
  registerAvatarBlob.value = null;
  registerAvatarPreview.value = selectedDefaultAvatar.value;
}

function selectRegisterDefaultAvatar(url) {
  selectedDefaultAvatar.value = url;
  registerAvatarMode.value = 'default';
  registerAvatarBlob.value = null;
  registerAvatarPreview.value = url;
}

function onRegisterAvatarUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast.error('请选择图片文件');
    return;
  }
  registerAvatarMode.value = 'upload';
  registerAvatarBlob.value = file;
  registerAvatarPreview.value = URL.createObjectURL(file);
}

function skipOnboarding() {
  markOnboardingSeen();
  onboardingOpen.value = false;
  router.replace('/');
}

function goOnboardingProfile() {
  markOnboardingSeen();
  onboardingOpen.value = false;
  router.push({ name: 'profile-edit', query: { onboard: 'profile' } });
}

function goOnboardingCollege() {
  markOnboardingSeen();
  onboardingOpen.value = false;
  router.push({ name: 'home', query: { college: college.value || undefined } });
}

function goOnboardingInterview() {
  markOnboardingSeen();
  onboardingOpen.value = false;
  if (recommendedInterview.value?.id) {
    router.push({ name: 'post', params: { id: recommendedInterview.value.id } });
    return;
  }
  router.push({ name: 'home', query: { college: college.value || undefined } });
}

onBeforeUnmount(() => {
  if (registerCooldownTimer) clearInterval(registerCooldownTimer);
  if (resetCooldownTimer) clearInterval(resetCooldownTimer);
});

function openForgot() {
  forgotMode.value = true;
  fieldErr.value = {};
  resetStep.value = 1;
  resetPhone.value = username.value.trim();
  resetCode.value = '';
  resetPassword.value = '';
  resetPassword2.value = '';
}

function closeForgot() {
  forgotMode.value = false;
  resetStep.value = 1;
  resetCode.value = '';
  resetPassword.value = '';
  resetPassword2.value = '';
}

async function sendResetCode() {
  const phone = resetPhone.value.trim();
  if (!/^1\d{10}$/.test(phone)) {
    toast.error('请输入注册手机号');
    return;
  }
  if (resetCooldown.value > 0) {
    toast.error(`${resetCooldown.value}秒后可重新发送验证码`);
    return;
  }
  const data = unwrap(await http.post('/auth/password-reset/send-code', { phone }));
  resetPhone.value = phone;
  resetStep.value = 2;
  startResetCooldown(Number(data?.retry_after_seconds || 60));
  toast.success('验证码已发送（5分钟内有效）');
}

async function submitReset() {
  const phone = resetPhone.value.trim();
  if (!phone || !resetCode.value.trim() || !resetPassword.value || !resetPassword2.value) {
    toast.error('请完整填写信息');
    return;
  }
  if (resetPassword.value !== resetPassword2.value) {
    toast.error('两次输入的新密码不一致');
    return;
  }
  await http.post('/auth/password-reset/verify', {
    phone,
    code: resetCode.value.trim(),
    newPassword: resetPassword.value,
  });
  toast.success('密码重置成功，请重新登录');
  closeForgot();
  switchTab('login');
}

function startResetCooldown(seconds = 60) {
  resetCooldown.value = seconds;
  if (resetCooldownTimer) clearInterval(resetCooldownTimer);
  resetCooldownTimer = setInterval(() => {
    if (resetCooldown.value <= 1) {
      resetCooldown.value = 0;
      clearInterval(resetCooldownTimer);
      resetCooldownTimer = null;
      return;
    }
    resetCooldown.value -= 1;
  }, 1000);
}
</script>

<template>
  <div class="wrap">
    <div class="card tw-card">
      <div class="head">
        <img class="logo" :src="siteLogo" alt="TalkWork logo" />
        <div>
          <div class="title page-title">TalkWork</div>
          <div class="hint">像阳光晒过的被子一样，把求职路走得暖一点。</div>
        </div>
      </div>

      <div class="tabs">
        <button type="button" :class="{ on: tab === 'login' }" @click="switchTab('login')">登录</button>
        <button type="button" :class="{ on: tab === 'register' }" @click="switchTab('register')">注册</button>
      </div>

      <div v-if="tab === 'login'" class="form">
        <template v-if="forgotMode">
          <template v-if="resetStep === 1">
            <label class="lbl">注册手机号</label>
            <input v-model="resetPhone" class="tw-input" placeholder="请输入注册时使用的手机号" />
            <div class="hint-line">将发送 6 位短信验证码，5 分钟内有效</div>
            <button class="tw-btn tw-btn-primary full" type="button" :disabled="resetCooldown > 0" @click="sendResetCode">
              {{ resetCooldown > 0 ? `${resetCooldown}s后重试` : '发送验证码' }}
            </button>
            <button class="tw-btn tw-btn-ghost full" type="button" @click="closeForgot">返回登录</button>
          </template>
          <template v-else>
            <label class="lbl">验证码</label>
            <input v-model="resetCode" class="tw-input" placeholder="请输入短信验证码" />
            <label class="lbl">新密码</label>
            <div class="pwd">
              <input
                v-model="resetPassword"
                class="tw-input"
                :type="showResetPwd ? 'text' : 'password'"
                placeholder="至少8位，含字母+数字"
              />
              <button type="button" class="eye" @click="showResetPwd = !showResetPwd">
                <EyeOff v-if="showResetPwd" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
            <label class="lbl">确认新密码</label>
            <input
              v-model="resetPassword2"
              class="tw-input"
              :type="showResetPwd ? 'text' : 'password'"
              placeholder="请再次输入新密码"
            />
            <div class="hint-line">验证码 5 分钟有效，重置成功后将返回登录</div>
            <button class="tw-btn tw-btn-primary full" type="button" @click="submitReset">确认重置密码</button>
            <button class="tw-btn tw-btn-ghost full" type="button" @click="resetStep = 1">重新获取验证码</button>
          </template>
        </template>
        <template v-else>
        <label class="lbl">账号</label>
        <input v-model="username" class="tw-input" :class="{ err: fieldErr.username }" placeholder="请输入手机号" />
        <label class="lbl">密码</label>
        <div class="pwd">
          <input v-model="password" class="tw-input" :class="{ err: fieldErr.password }" :type="showPwd ? 'text' : 'password'" />
          <button type="button" class="eye" @click="showPwd = !showPwd">
            <EyeOff v-if="showPwd" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
        <div class="row">
          <span />
          <a class="link" href="#" @click.prevent="openForgot">忘记密码？</a>
        </div>
        <button class="tw-btn tw-btn-primary full" type="button" @click="onLogin">登录</button>
        <div class="foot">
          还没有账号？
          <a href="#" @click.prevent="switchTab('register')">去注册</a>
        </div>
        </template>
      </div>

      <div v-else class="form">
        <template v-if="step === 1">
          <label class="lbl">手机号</label>
          <input
            v-model="username"
            class="tw-input"
            :class="{ err: fieldErr.username }"
            placeholder="请输入11位手机号"
          />
          <div class="hint-line">手机号将作为你的登录账号</div>
          <label class="lbl">短信验证码</label>
          <div class="row code-row">
            <input v-model="registerCode" class="tw-input" :class="{ err: fieldErr.code }" placeholder="6位验证码" />
            <button
              class="tw-btn tw-btn-ghost code-btn"
              type="button"
              :disabled="registerCooldown > 0"
              @click="onSendRegisterCode"
            >
              {{ registerCooldown > 0 ? `${registerCooldown}s后重试` : '发送验证码' }}
            </button>
          </div>
          <div class="hint-line">验证码 5 分钟内有效，1 分钟内不可重复发送</div>
          <label class="lbl">密码</label>
          <input v-model="password" class="tw-input" :class="{ err: fieldErr.password }" type="password" placeholder="至少8位，含字母+数字" />
          <label class="lbl">确认密码</label>
          <input v-model="password2" class="tw-input" :class="{ err: fieldErr.password2 }" type="password" />
          <button class="tw-btn tw-btn-primary full" type="button" :disabled="!pwdOk" @click="onRegister">下一步</button>
        </template>

        <template v-else>
          <div class="step-hint">选择你的学院（单选）</div>
          <div class="cols">
            <button
              v-for="it in collegeOptions"
              :key="it.id"
              type="button"
              class="col"
              :class="{ on: college === it.id }"
              @click="college = it.id"
            >
              <img class="col-img" :src="it.image_url" :alt="`${it.label}插画`" loading="lazy" @error="onCollegeImgError($event, it.id)" />
              <div class="cn">{{ it.label }}</div>
              <div v-if="college === it.id" class="check"><Check :size="12" /></div>
            </button>
          </div>
          <div class="step-hint avatar-step">选择头像</div>
          <div class="avatar-mode">
            <button type="button" class="tw-btn tw-btn-ghost" :class="{ on: registerAvatarMode === 'default' }" @click="registerAvatarMode = 'default'">
              默认头像
            </button>
            <label class="tw-btn tw-btn-ghost" :class="{ on: registerAvatarMode === 'upload' }">
              上传头像
              <input type="file" accept="image/*" hidden @change="onRegisterAvatarUpload" />
            </label>
          </div>
          <div v-if="registerAvatarMode === 'default'" class="avatar-grid">
            <button
              v-for="url in defaultAvatarOptions"
              :key="url"
              type="button"
              class="avatar-item"
              :class="{ on: selectedDefaultAvatar === url }"
              @click="selectRegisterDefaultAvatar(url)"
            >
              <img :src="url" alt="默认头像" loading="lazy" />
            </button>
          </div>
          <div v-else class="upload-preview">
            <img v-if="registerAvatarPreview" :src="registerAvatarPreview" alt="上传头像预览" />
            <span v-else>请上传头像</span>
          </div>
          <button class="tw-btn tw-btn-primary full" type="button" @click="onRegister">完成注册</button>
          <button class="tw-btn tw-btn-ghost full" type="button" @click="step = 1">返回上一步</button>
        </template>

        <div class="foot">
          已有账号？
          <a href="#" @click.prevent="switchTab('login')">去登录</a>
        </div>
      </div>
    </div>

    <div v-if="onboardingOpen" class="guide-mask" @click.self="skipOnboarding">
      <section class="guide tw-card">
        <div class="guide-head">
          <div>
            <div class="guide-title">欢迎加入 TalkWork</div>
            <div class="guide-sub">先用 3 步把首页内容调成更适合你的样子。</div>
          </div>
          <button type="button" class="guide-skip" @click="skipOnboarding">跳过</button>
        </div>

        <div class="guide-list">
          <article class="guide-item">
            <div class="guide-no">01</div>
            <div class="guide-body">
              <div class="guide-item-title">补充学院 / 专业 / 求职阶段</div>
              <div class="guide-item-desc">完善你的基础信息，后续推荐会更贴近你的求职方向。</div>
            </div>
            <button class="tw-btn tw-btn-primary" type="button" @click="goOnboardingProfile">去完善</button>
          </article>

          <article class="guide-item">
            <div class="guide-no">02</div>
            <div class="guide-body">
              <div class="guide-item-title">关注感兴趣的学院圈子</div>
              <div class="guide-item-desc">先从你所在学院开始，也可以顺手逛逛其他学院的讨论。</div>
            </div>
            <button class="tw-btn tw-btn-primary" type="button" @click="goOnboardingCollege">去逛逛</button>
          </article>

          <article class="guide-item">
            <div class="guide-no">03</div>
            <div class="guide-body">
              <div class="guide-item-title">看一篇推荐面经</div>
              <div class="guide-item-desc">
                {{ recommendedInterview?.title || '先给你挑一篇适合入门的经验分享，快速感受这里的内容氛围。' }}
              </div>
            </div>
            <button class="tw-btn tw-btn-primary" type="button" @click="goOnboardingInterview">
              {{ recommendedInterview ? '立即查看' : '去看看' }}
            </button>
          </article>
        </div>

        <button class="tw-btn tw-btn-ghost full" type="button" @click="skipOnboarding">暂时跳过</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 28px 14px;
  position: relative;
}
.card {
  width: min(520px, 100%);
  padding: 18px 18px 16px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.head {
  display: flex;
  gap: clamp(10px, 3vw, 14px);
  align-items: center;
  margin-bottom: 12px;
  min-width: 0;
}
.head > div:last-child {
  min-width: 0;
  flex: 1;
}
.logo {
  width: clamp(44px, min(18vw, 12vh), 80px);
  height: auto;
  max-width: 100%;
  aspect-ratio: 1024 / 807;
  border-radius: 12px;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
}
.title {
  font-size: clamp(18px, 4.5vw, 22px);
  font-weight: 900;
}
.hint {
  margin-top: 4px;
  color: var(--tw-muted);
  font-size: 12px;
  line-height: 1.45;
}
.hint-line {
  color: var(--tw-muted);
  font-size: 12px;
}
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 12px 0 14px;
}
.tabs button {
  border: 1px solid rgba(26, 86, 219, 0.12);
  background: rgba(255, 255, 255, 0.55);
  padding: 10px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 900;
}
.tabs button.on {
  border-color: rgba(26, 86, 219, 0.35);
  background: rgba(26, 86, 219, 0.1);
}
.form {
  display: grid;
  gap: 10px;
}
.lbl {
  font-size: 12px;
  color: var(--tw-muted);
  font-weight: 700;
}
.pwd {
  position: relative;
}
.pwd .tw-input {
  padding-right: 44px;
}
.eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  cursor: pointer;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.code-row {
  gap: 8px;
}
.code-row .tw-input {
  flex: 1;
}
.code-btn {
  white-space: nowrap;
  margin-top: 0;
}
.link {
  font-size: 12px;
}
.full {
  width: 100%;
  margin-top: 6px;
}
.foot {
  text-align: center;
  color: var(--tw-muted);
  font-size: 13px;
  margin-top: 10px;
}
.cols {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.col {
  position: relative;
  border-radius: 16px;
  padding: 8px;
  border: 2px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  text-align: left;
}
.col.on {
  border-color: rgba(26, 86, 219, 0.85);
  box-shadow: 0 10px 24px rgba(26, 86, 219, 0.12);
}
.col-img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 12px;
  background: rgba(148, 163, 184, 0.14);
}
.cn {
  margin-top: 6px;
  font-weight: 900;
  padding: 0 4px 4px;
}
.check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #1a56db;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
}
.step-hint {
  font-weight: 800;
}
.avatar-step {
  margin-top: 4px;
}
.avatar-mode {
  display: flex;
  gap: 8px;
}
.avatar-mode .tw-btn.on {
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
  border-radius: 12px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
}
.avatar-item.on {
  border-color: rgba(26, 86, 219, 0.8);
}
.avatar-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 10px;
  display: block;
}
.upload-preview {
  width: 90px;
  height: 90px;
  border-radius: 999px;
  border: 2px solid rgba(26, 86, 219, 0.2);
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--tw-muted);
  font-size: 12px;
}
.upload-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.guide-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}
.guide {
  width: min(720px, 100%);
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.guide-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.guide-title {
  font-size: 22px;
  font-weight: 900;
}
.guide-sub {
  margin-top: 6px;
  color: var(--tw-muted);
  font-size: 13px;
  line-height: 1.5;
}
.guide-skip {
  border: none;
  background: transparent;
  color: var(--tw-muted);
  cursor: pointer;
  font-size: 13px;
}
.guide-list {
  display: grid;
  gap: 12px;
}
.guide-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.72);
}
.guide-no {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 900;
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.12);
}
.guide-body {
  min-width: 0;
}
.guide-item-title {
  font-weight: 900;
}
.guide-item-desc {
  margin-top: 4px;
  color: var(--tw-muted);
  font-size: 13px;
  line-height: 1.5;
}
@media (max-width: 720px) {
  .guide-item {
    grid-template-columns: 1fr;
    align-items: start;
  }
  .guide-no {
    width: 36px;
    height: 36px;
  }
}
</style>
