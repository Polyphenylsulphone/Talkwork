/** Strip common Markdown so T宝 replies read as plain paragraphs. */
export function stripAssistantMarkdown(s) {
  let t = String(s || '');
  t = t.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim());
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/\*([^*]+)\*/g, '$1');
  t = t.replace(/^>\s?/gm, '');
  t = t.replace(/^\s*[-*+]\s+/gm, '');
  t = t.replace(/^\s*\d+\.\s+/gm, '');
  return t.trim();
}
