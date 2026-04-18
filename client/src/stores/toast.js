import { reactive } from 'vue';

const state = reactive({
  items: [],
});

let id = 1;

export const toast = {
  success(msg) {
    push('success', msg, 2000);
  },
  error(msg) {
    push('error', msg, 2800);
  },
  info(msg) {
    push('info', msg, 2200);
  },
  warn(msg) {
    push('warn', msg, 2400);
  },
};

function push(type, message, ttl) {
  const nid = id++;
  state.items.push({ id: nid, type, message });
  setTimeout(() => {
    state.items = state.items.filter((x) => x.id !== nid);
  }, ttl);
}

export function useToastState() {
  return state;
}
