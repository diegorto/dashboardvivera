-- Fase 0.6: leads fora do allowlist geram alerta interno sem deal/owner ainda existente.
ALTER TABLE owner_notifications
  MODIFY COLUMN owner_user_id INT(11) NULL,
  MODIFY COLUMN deal_id INT(11) NULL;
