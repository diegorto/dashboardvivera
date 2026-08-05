-- Rollback: so aplicar depois de garantir que nao ha linhas com owner_user_id/deal_id NULL.
ALTER TABLE owner_notifications
  MODIFY COLUMN owner_user_id INT(11) NOT NULL,
  MODIFY COLUMN deal_id INT(11) NOT NULL;
