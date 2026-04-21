import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useUiStore } from './stores/ui';
import './assets/global.css';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import 'nprogress/nprogress.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
const ui = useUiStore(pinia);
ui.initTheme();
ui.initWallpaper();
ui.initTbotMood();
app.use(router).mount('#app');
