const DEFAULT_WORDS = [
  '法轮功',
  '台独',
  '藏独',
  '疆独',
  '恐怖组织',
  '爆炸物',
  '枪支弹药',
  '色情',
  '赌博',
  '毒品',
  '自杀教程',
  '代开发票',
  '办证',
];

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function findSensitiveWord(text, extra = []) {
  const raw = String(text || '');
  const flat = normalize(raw);
  const list = [...DEFAULT_WORDS, ...extra].filter(Boolean);
  for (const w of list) {
    const nw = normalize(w);
    if (!nw) continue;
    if (raw.includes(w) || flat.includes(nw)) return w;
  }
  return null;
}

export function assertNoSensitive(text, extra) {
  const hit = findSensitiveWord(text, extra);
  if (hit) {
    const err = new Error('内容包含不当词汇，请修改后发布');
    err.code = 400;
    err.hit = hit;
    throw err;
  }
}
