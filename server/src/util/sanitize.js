import DOMPurify from 'isomorphic-dompurify';

export function sanitizeRichHtml(html) {
  return DOMPurify.sanitize(String(html || ''), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'],
  });
}

/** Plain text / short comment: strip all tags and event handlers. */
export function sanitizePlainText(text) {
  return DOMPurify.sanitize(String(text || ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
