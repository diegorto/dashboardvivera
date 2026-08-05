-- Fase 0.4: trigger que captura TODA escrita em chatbot_ai_config,
-- independente de qual arquivo/rota fez o UPDATE (nao depende de
-- disciplina de codigo). So grava quando o valor de fato muda.
DROP TRIGGER IF EXISTS trg_chatbot_ai_config_version;
DELIMITER $$
CREATE TRIGGER trg_chatbot_ai_config_version
BEFORE UPDATE ON chatbot_ai_config
FOR EACH ROW
BEGIN
  IF NOT (OLD.config_value <=> NEW.config_value) THEN
    INSERT INTO chatbot_config_versions (config_key, old_value, new_value, changed_at)
    VALUES (OLD.config_key, OLD.config_value, NEW.config_value, NOW());
  END IF;
END$$
DELIMITER ;
