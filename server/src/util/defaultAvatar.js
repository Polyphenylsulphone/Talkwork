export const DEFAULT_AVATAR_URLS = [
  '/default-avatars/fox-01.png',
  '/default-avatars/fox-02.png',
  '/default-avatars/fox-03.png',
  '/default-avatars/fox-04.png',
  '/default-avatars/fox-05.png',
  '/default-avatars/fox-06.png',
  '/default-avatars/fox-07.png',
  '/default-avatars/fox-08.png',
  '/default-avatars/fox-09.png',
  '/default-avatars/fox-10.png',
];

export const ANONYMOUS_AVATAR_URL = DEFAULT_AVATAR_URLS[0];

export function isAllowedAvatarUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return false;
  if (DEFAULT_AVATAR_URLS.includes(value)) return true;
  if (value.startsWith('/uploads/')) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return false;
}
