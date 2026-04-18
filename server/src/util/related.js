function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenize(text) {
  const src = stripHtml(text);
  const words = src.match(/[a-z0-9_]+/g) || [];
  const zhChars = src.match(/[\u4e00-\u9fa5]/g) || [];
  const grams = [];
  for (let i = 0; i < zhChars.length - 1; i += 1) {
    grams.push(`${zhChars[i]}${zhChars[i + 1]}`);
  }
  return words.concat(grams);
}

function tf(tokens) {
  const map = new Map();
  for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
  return map;
}

export function rankRelatedPosts(targetPost, candidates, limit = 6) {
  const docs = [targetPost, ...candidates];
  const tokenized = docs.map((d) => tokenize(`${d.title || ''} ${d.content || ''}`));
  const df = new Map();
  for (const tokens of tokenized) {
    const uniq = new Set(tokens);
    for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = docs.length;
  const idf = (term) => Math.log((1 + n) / (1 + (df.get(term) || 0))) + 1;
  const baseTf = tf(tokenized[0]);
  const baseNorm = Math.sqrt([...baseTf.entries()].reduce((acc, [term, f]) => acc + (f * idf(term)) ** 2, 0)) || 1;

  const scored = candidates
    .map((post, idx) => {
      const vec = tf(tokenized[idx + 1]);
      let dot = 0;
      let norm = 0;
      for (const [term, f] of vec.entries()) {
        const w = f * idf(term);
        norm += w * w;
        const bf = baseTf.get(term) || 0;
        if (bf) dot += w * (bf * idf(term));
      }
      const score = dot / ((Math.sqrt(norm) || 1) * baseNorm);
      return { ...post, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit);

  if (scored.length >= Math.min(3, limit)) return scored;
  const used = new Set(scored.map((x) => x.id));
  const fallback = candidates
    .filter((x) => !used.has(x.id))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit - scored.length);
  return scored.concat(fallback);
}

