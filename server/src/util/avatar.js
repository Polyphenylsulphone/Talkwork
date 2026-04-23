export const DEFAULT_AVATAR_URLS = Array.from(
  { length: 10 },
  (_, i) => `/default-avatars/default-${String(i + 1).padStart(2, '0')}.png`
);

export const ANONYMOUS_AVATAR_URL = DEFAULT_AVATAR_URLS[0];

export function isDefaultAvatarUrl(url) {
  return DEFAULT_AVATAR_URLS.includes(String(url || '').trim());
}

export function pickRandomDefaultAvatar() {
  const idx = Math.floor(Math.random() * DEFAULT_AVATAR_URLS.length);
  return DEFAULT_AVATAR_URLS[idx];
}

export function normalizeUserAvatarUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (isDefaultAvatarUrl(raw)) return raw;
  if (raw.startsWith('/uploads/')) return raw;
  return '';
}
