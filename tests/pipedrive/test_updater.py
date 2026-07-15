import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from src.pipedrive.updater import PipedriveUpdater
from src.models import AuditLogStatus


class TestPipedriveUpdater:
    """Testes para PipedriveUpdater"""

    def test_init(self, test_db):
        """Testa inicialização do updater"""
        updater = PipedriveUpdater(test_db, "batch-123")
        assert updater.batch_id == "batch-123"
        assert updater.db is not None
        assert updater.updates_log == []

    def test_allowed_person_fields(self):
        """Testa que campos permitidos para pessoa estão corretos"""
        updater = PipedriveUpdater(None, "batch-123")
        assert "name" in updater.ALLOWED_PERSON_FIELDS
        assert "phone" in updater.ALLOWED_PERSON_FIELDS
        assert "email" in updater.ALLOWED_PERSON_FIELDS
        assert "cpf" not in updater.ALLOWED_PERSON_FIELDS

    def test_allowed_deal_fields(self):
        """Testa que campos permitidos para deal estão corretos"""
        updater = PipedriveUpdater(None, "batch-123")
        assert "title" in updater.ALLOWED_DEAL_FIELDS
        assert "value" in updater.ALLOWED_DEAL_FIELDS
        assert "stage_id" in updater.ALLOWED_DEAL_FIELDS

    def test_detect_differences_identical(self):
        """Testa detecção de diferenças com dados idênticos"""
        updater = PipedriveUpdater(None, "batch-123")

        clairis = {"name": "João", "phone": "5548999999999"}
        pipedrive = {"name": "João", "phone": "5548999999999"}

        differences = updater._detect_differences(clairis, pipedrive)
        assert differences == {}

    def test_detect_differences_name_divergence(self):
        """Testa detecção de diferença em nome"""
        updater = PipedriveUpdater(None, "batch-123")

        clairis = {"name": "João Silva"}
        pipedrive = {"name": "Jose Silva"}

        differences = updater._detect_differences(clairis, pipedrive)
        assert "name" in differences
        assert differences["name"] == ("Jose Silva", "João Silva")

    def test_detect_differences_phone_divergence(self):
        """Testa detecção de diferença em telefone"""
        updater = PipedriveUpdater(None, "batch-123")

        clairis = {"phone": "5548999999999"}
        pipedrive = {"phone": "5548988888888"}

        differences = updater._detect_differences(clairis, pipedrive)
        assert "phone" in differences

    def test_detect_differences_empty_vs_filled(self):
        """Testa diferença entre vazio e preenchido"""
        updater = PipedriveUpdater(None, "batch-123")

        clairis = {"email": "joao@example.com"}
        pipedrive = {"email": ""}

        differences = updater._detect_differences(clairis, pipedrive)
        assert "email" in differences

    def test_filter_allowed_fields(self):
        """Testa filtro de campos permitidos"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {
            "name": "João",
            "phone": "5548999999999",
            "cpf": "12345678900",  # Não permitido
            "email": "joao@example.com"
        }

        result = updater._filter_allowed_fields(data, updater.ALLOWED_PERSON_FIELDS)

        assert "name" in result
        assert "phone" in result
        assert "email" in result
        assert "cpf" not in result

    def test_validate_person_data_valid(self):
        """Testa validação de pessoa válida"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {
            "name": "João Silva",
            "email": "joao@example.com",
            "phone": "5548999999999"
        }

        is_valid, msg = updater._validate_person_data(data)
        assert is_valid is True

    def test_validate_person_data_name_too_short(self):
        """Testa validação com nome muito curto"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {"name": "J"}
        is_valid, msg = updater._validate_person_data(data)
        assert is_valid is False
        assert "2 caracteres" in msg

    def test_validate_person_data_invalid_email(self):
        """Testa validação com email inválido"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {"email": "joaoexample.com"}  # Falta @
        is_valid, msg = updater._validate_person_data(data)
        assert is_valid is False
        assert "Email" in msg

    def test_validate_person_data_invalid_phone(self):
        """Testa validação com telefone inválido"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {"phone": "ABCDEFGHIJ"}
        is_valid, msg = updater._validate_person_data(data)
        assert is_valid is False
        assert "dígitos" in msg

    def test_validate_deal_data_valid(self):
        """Testa validação de deal válido"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {
            "title": "Deal importante",
            "value": 1000.0,
            "probability": 50
        }

        is_valid, msg = updater._validate_deal_data(data)
        assert is_valid is True

    def test_validate_deal_data_title_too_short(self):
        """Testa validação com título muito curto"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {"title": "AB"}
        is_valid, msg = updater._validate_deal_data(data)
        assert is_valid is False
        assert "3 caracteres" in msg

    def test_validate_deal_data_invalid_value(self):
        """Testa validação com valor inválido"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {"value": "abc"}
        is_valid, msg = updater._validate_deal_data(data)
        assert is_valid is False
        assert "numérico" in msg

    def test_validate_deal_data_probability_out_of_range(self):
        """Testa validação com probabilidade fora do range"""
        updater = PipedriveUpdater(None, "batch-123")

        data = {"probability": 150}
        is_valid, msg = updater._validate_deal_data(data)
        assert is_valid is False
        assert "0-100" in msg

    @pytest.mark.asyncio
    async def test_update_person_safe_no_differences(self, test_db):
        """Testa atualização sem diferenças"""
        updater = PipedriveUpdater(test_db, "batch-123")
        api_client = AsyncMock()

        clairis_data = {"name": "João", "phone": "5548999999999"}
        pipedrive_data = {"name": "João", "phone": "5548999999999"}

        success, msg = await updater.update_person_safe(
            42, clairis_data, pipedrive_data, api_client
        )

        assert success is True
        assert "Sem alterações" in msg
        api_client.update_person.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_person_safe_with_update(self, test_db):
        """Testa atualização com diferenças"""
        updater = PipedriveUpdater(test_db, "batch-123")
        api_client = AsyncMock()
        api_client.update_person = AsyncMock(return_value=True)

        clairis_data = {
            "name": "João Silva",
            "phone": "5548999999999",
            "email": "joao@example.com"
        }
        pipedrive_data = {
            "name": "Jose Silva",
            "phone": "5548999999999",
            "email": "joao@example.com"
        }

        success, msg = await updater.update_person_safe(
            42, clairis_data, pipedrive_data, api_client
        )

        assert success is True
        assert "sucesso" in msg.lower()
        api_client.update_person.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_person_safe_validation_fails(self, test_db):
        """Testa atualização com validação falhando"""
        updater = PipedriveUpdater(test_db, "batch-123")
        api_client = AsyncMock()

        clairis_data = {"name": "X"}  # Nome muito curto
        pipedrive_data = {"name": "João"}

        success, msg = await updater.update_person_safe(
            42, clairis_data, pipedrive_data, api_client
        )

        assert success is False
        assert "caracteres" in msg.lower() or "validação" in msg.lower()

    @pytest.mark.asyncio
    async def test_create_person_safe_success(self, test_db):
        """Testa criação de pessoa com sucesso"""
        updater = PipedriveUpdater(test_db, "batch-123")
        api_client = AsyncMock()
        api_client.create_person = AsyncMock(return_value=99)

        person_data = {
            "name": "João Silva",
            "phone": "5548999999999",
            "email": "joao@example.com"
        }

        person_id, msg = await updater.create_person_safe(person_data, api_client)

        assert person_id == 99
        assert "sucesso" in msg.lower()

    @pytest.mark.asyncio
    async def test_create_person_safe_validation_fails(self, test_db):
        """Testa criação com validação falhando"""
        updater = PipedriveUpdater(test_db, "batch-123")
        api_client = AsyncMock()

        person_data = {
            "name": "J",  # Muito curto
            "email": "invalid-email"
        }

        person_id, msg = await updater.create_person_safe(person_data, api_client)

        assert person_id is None
        assert "caracteres" in msg.lower() or "email" in msg.lower()

    @pytest.mark.asyncio
    async def test_detect_duplicates_by_phone_found(self, test_db):
        """Testa detecção de duplicata por telefone"""
        updater = PipedriveUpdater(test_db, "batch-123")
        api_client = AsyncMock()
        api_client.get_persons_by_phone = AsyncMock(
            return_value={"id": 42, "name": "Duplicado"}
        )

        person_data = {"name": "João", "phone": "5548999999999"}

        result = await updater.detect_duplicates(person_data, api_client)

        assert result is not None
        assert result["id"] == 42

    @pytest.mark.asyncio
    async def test_detect_duplicates_not_found(self, test_db):
        """Testa que não há duplicata"""
        updater = PipedriveUpdater(test_db, "batch-123")
        api_client = AsyncMock()
        api_client.get_persons_by_phone = AsyncMock(return_value=None)

        person_data = {"name": "João", "phone": "5548999999999"}

        result = await updater.detect_duplicates(person_data, api_client)

        assert result is None

    def test_create_audit_log(self, test_db):
        """Testa criação de audit log"""
        updater = PipedriveUpdater(test_db, "batch-123")

        audit_log = updater._create_audit_log(
            entity_type="person",
            entity_id="CLR-12345",
            field_name="phone",
            old_value="5548988888888",
            new_value="5548999999999",
            status=AuditLogStatus.IMPORTED,
            confidence_level=95.0
        )

        assert audit_log is not None
        assert audit_log.batch_id == "batch-123"
        assert audit_log.entity_type == "person"
        assert audit_log.field_name == "phone"

        # Verificar que foi persistido
        from src.models import AuditLog
        logs = test_db.query(AuditLog).filter(
            AuditLog.batch_id == "batch-123"
        ).all()
        assert len(logs) == 1
