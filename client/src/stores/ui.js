import { defineStore } from 'pinia';
import tbotHappy from '../assets/tbot/tbot-happy.png';
import tbotQuestion from '../assets/tbot/tbot-question.png';
import tbotCalm from '../assets/tbot/tbot-calm.png';

/** 供侧栏等使用；换图后重新 build 会生成新 hash，避免浏览器长期缓存旧图 */
export const TBOT_FACE_URLS = { happy: tbotHappy, question: tbotQuestion, calm: tbotCalm };

const KEY = 'tw_sidebar_collapsed';
const THEME_KEY = 'tw_theme';
const WALLPAPER_KEY = 'tw_wallpaper';
const TBOT_MOOD_KEY = 'tw_tbot_mood';

const WALLPAPER_OPTIONS = [
  { id: 'lake', label: '湖面云山', url: '/bg-lake.png' },
  { id: 'beach', label: '海岸沙洲', url: '/bg-beach.png' },
  { id: 'ruins', label: '林间遗迹', url: '/bg-ruins.png' },
  { id: 'flowers-sky', label: '花野晴空', url: '/bg-flowers-sky.png' },
  { id: 'sketch-hills', label: '浅描群山', url: '/bg-sketch-hills.png' },
  { id: 'sunset-field', label: '落日花原', url: '/bg-sunset-field.png' },
  { id: 'cloud-balloons', label: '云海气球', url: '/bg-cloud-balloons.png' },
  { id: 'golden-hills', label: '金色丘陵', url: '/bg-golden-hills.png' },
];

const TBOT_MOODS = [
  { id: 'happy', label: '开心', url: TBOT_FACE_URLS.happy },
  { id: 'question', label: '疑问', url: TBOT_FACE_URLS.question },
  { id: 'calm', label: '平静', url: TBOT_FACE_URLS.calm },
];

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: localStorage.getItem(KEY) === '1',
    fabOpen: false,
    postMenuOpen: false,
    theme: localStorage.getItem(THEME_KEY) || 'light',
    wallpaper: localStorage.getItem(WALLPAPER_KEY) || 'lake',
    wallpaperOptions: WALLPAPER_OPTIONS,
    tbotMood: localStorage.getItem(TBOT_MOOD_KEY) || 'calm',
    tbotMoodOptions: TBOT_MOODS,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem(KEY, this.sidebarCollapsed ? '1' : '0');
    },
    applyTheme(theme = this.theme) {
      this.theme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this.theme);
      localStorage.setItem(THEME_KEY, this.theme);
    },
    toggleTheme() {
      this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
    },
    initTheme() {
      this.applyTheme(localStorage.getItem(THEME_KEY) || this.theme || 'light');
    },
    applyWallpaper(wallpaper = this.wallpaper) {
      const match = WALLPAPER_OPTIONS.find((item) => item.id === wallpaper) || WALLPAPER_OPTIONS[0];
      this.wallpaper = match.id;
      document.documentElement.style.setProperty('--tw-bg-image', `url('${match.url}')`);
      localStorage.setItem(WALLPAPER_KEY, this.wallpaper);
    },
    initWallpaper() {
      this.applyWallpaper(localStorage.getItem(WALLPAPER_KEY) || this.wallpaper || WALLPAPER_OPTIONS[0].id);
    },
    applyTbotMood(mood = this.tbotMood) {
      const match = TBOT_MOODS.find((item) => item.id === mood) || TBOT_MOODS[2];
      this.tbotMood = match.id;
      localStorage.setItem(TBOT_MOOD_KEY, this.tbotMood);
    },
    randomizeTbotMood() {
      if (!TBOT_MOODS.length) return;
      const pool = TBOT_MOODS.filter((item) => item.id !== this.tbotMood);
      const source = pool.length ? pool : TBOT_MOODS;
      const next = source[Math.floor(Math.random() * source.length)];
      this.applyTbotMood(next.id);
    },
    updateTbotMoodByText(text = '') {
      const s = String(text || '').trim().toLowerCase();
      if (!s) {
        this.applyTbotMood('calm');
        return;
      }

      const questionRe = /[?？]|怎么|如何|为啥|为什么|吗|么|呢|what|how|why|can you|could you/;
      if (questionRe.test(s)) {
        this.applyTbotMood('question');
        return;
      }

      const happyRe =
        /谢谢|感谢|太好了|真棒|开心|高兴|满意|解决了|通过|offer|成功|nice|great|awesome|cool|love|开心了/;
      if (happyRe.test(s)) {
        this.applyTbotMood('happy');
        return;
      }

      this.applyTbotMood('calm');
    },
    initTbotMood() {
      this.applyTbotMood(localStorage.getItem(TBOT_MOOD_KEY) || this.tbotMood || 'calm');
    },
  },
});
