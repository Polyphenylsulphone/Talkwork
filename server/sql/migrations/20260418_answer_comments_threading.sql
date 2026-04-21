-- 问答回答评论支持两级回复
ALTER TABLE answer_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id INT NULL AFTER content,
  ADD COLUMN IF NOT EXISTS reply_to_user_id INT NULL AFTER parent_comment_id;

ALTER TABLE answer_comments
  ADD INDEX IF NOT EXISTS idx_answer_parent (answer_id, parent_comment_id);
