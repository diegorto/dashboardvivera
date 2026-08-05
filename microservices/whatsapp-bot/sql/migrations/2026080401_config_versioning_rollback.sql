-- Rollback de 2026080401_config_versioning.sql + 2026080402_config_versioning_trigger.sql
DROP TRIGGER IF EXISTS trg_chatbot_ai_config_version;
DROP TABLE IF EXISTS prompt_proposals;
DROP TABLE IF EXISTS chatbot_config_versions;
