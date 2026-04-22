import { ANONYMOUS_AVATAR_URL } from './defaultAvatar.js';

/** 对外展示时匿名发帖的作者名（与前端展示一致） */
export const ANONYMOUS_AUTHOR_NAME = '匿名用户';

/** 匿名帖在 API 中统一掩码用户名与头像，避免对外暴露真实身份 */
export function applyAnonymousAuthorDisplay(row) {
  if (!row || !Number(row.is_anonymous)) return row;
  return { ...row, username: ANONYMOUS_AUTHOR_NAME, avatar_url: ANONYMOUS_AVATAR_URL };
}
