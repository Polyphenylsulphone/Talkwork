-- 匿名发帖：对外不展示真实头像与用户名
ALTER TABLE posts ADD COLUMN is_anonymous TINYINT(1) NOT NULL DEFAULT 0 AFTER is_private;
