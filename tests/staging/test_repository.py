import pytest
from datetime import datetime, timedelta
from src.staging.repository import StagingRepository
from src.models import StagingPatient, StagingBudget


class TestStagingRepository:
    """Testes para StagingRepository"""

    def test_get_all_patients_empty(self, test_db):
        """Testa retorno vazio quando não há pacientes"""
        repo = StagingRepository(test_db)
        result = repo.get_all_patients()
        assert result == []

    def test_get_all_patients_with_limit(self, test_db, sample_patient):
        """Testa paginação com limite"""
        repo = StagingRepository(test_db)

        # Adicionar 5 pacientes
        for i in range(5):
            patient = StagingPatient(**{**sample_patient, "clairis_id": f"CLR-{i:05d}"})
            test_db.add(patient)
        test_db.commit()

        result = repo.get_all_patients(limit=3)
        assert len(result) == 3

    def test_get_patient_by_clairis_id_found(self, test_db, staging_patient_db):
        """Testa busca de paciente por clairis_id com sucesso"""
        repo = StagingRepository(test_db)
        result = repo.get_patient_by_clairis_id("CLR-12345")

        assert result is not None
        assert result.clairis_id == "CLR-12345"
        assert result.name == "João Silva"

    def test_get_patient_by_clairis_id_not_found(self, test_db):
        """Testa busca de paciente inexistente"""
        repo = StagingRepository(test_db)
        result = repo.get_patient_by_clairis_id("CLR-NOTFOUND")

        assert result is None

    def test_get_patient_by_phone_found(self, test_db, staging_patient_db):
        """Testa busca de paciente por telefone"""
        repo = StagingRepository(test_db)
        result = repo.get_patient_by_phone("5548999999999")

        assert result is not None
        assert result.phone == "5548999999999"

    def test_get_patient_by_phone_not_found(self, test_db):
        """Testa busca de paciente com telefone inexistente"""
        repo = StagingRepository(test_db)
        result = repo.get_patient_by_phone("9999999999999")

        assert result is None

    def test_get_patient_by_email_found(self, test_db, staging_patient_db):
        """Testa busca de paciente por email"""
        repo = StagingRepository(test_db)
        result = repo.get_patient_by_email("joao@example.com")

        assert result is not None
        assert result.email == "joao@example.com"

    def test_get_patients_by_status(self, test_db, sample_patient):
        """Testa filtro por status"""
        repo = StagingRepository(test_db)

        # Adicionar pacientes com diferentes status
        patient1 = StagingPatient(**{**sample_patient, "clairis_id": "CLR-001", "status": "ATIVO"})
        patient2 = StagingPatient(**{**sample_patient, "clairis_id": "CLR-002", "status": "ATIVO"})
        patient3 = StagingPatient(**{**sample_patient, "clairis_id": "CLR-003", "status": "INATIVO"})

        test_db.add_all([patient1, patient2, patient3])
        test_db.commit()

        result = repo.get_patients_by_status("ATIVO")
        assert len(result) == 2

    def test_get_recent_patients(self, test_db, sample_patient):
        """Testa busca de pacientes recentes"""
        repo = StagingRepository(test_db)

        # Paciente recente
        recent = StagingPatient(**{**sample_patient, "clairis_id": "CLR-001", "imported_at": datetime.utcnow()})
        # Paciente antigo
        old = StagingPatient(**{**sample_patient, "clairis_id": "CLR-002", "imported_at": datetime.utcnow() - timedelta(hours=48)})

        test_db.add_all([recent, old])
        test_db.commit()

        result = repo.get_recent_patients(hours=24)
        assert len(result) == 1
        assert result[0].clairis_id == "CLR-001"

    def test_count_patients(self, test_db, sample_patient):
        """Testa contagem de pacientes"""
        repo = StagingRepository(test_db)

        for i in range(5):
            patient = StagingPatient(**{**sample_patient, "clairis_id": f"CLR-{i:05d}"})
            test_db.add(patient)
        test_db.commit()

        count = repo.count_patients()
        assert count == 5

    def test_get_patients_with_phone(self, test_db, sample_patient):
        """Testa busca de pacientes com telefone"""
        repo = StagingRepository(test_db)

        # Com telefone
        with_phone = StagingPatient(**{**sample_patient, "clairis_id": "CLR-001", "phone": "5548999999999"})
        # Sem telefone
        without_phone = StagingPatient(**{**sample_patient, "clairis_id": "CLR-002", "phone": None})

        test_db.add_all([with_phone, without_phone])
        test_db.commit()

        result = repo.get_patients_with_phone()
        assert len(result) == 1
        assert result[0].phone == "5548999999999"

    def test_get_staging_stats(self, test_db, sample_patient):
        """Testa estatísticas gerais de staging"""
        repo = StagingRepository(test_db)

        # Adicionar dados
        for i in range(3):
            patient = StagingPatient(**{**sample_patient, "clairis_id": f"CLR-{i:05d}"})
            test_db.add(patient)
        test_db.commit()

        stats = repo.get_staging_stats()

        assert stats["patients"] == 3
        assert stats["budgets"] == 0
        assert "recent_patients_24h" in stats

    def test_get_budget_statistics(self, test_db):
        """Testa estatísticas de orçamentos"""
        repo = StagingRepository(test_db)

        budget1 = StagingBudget(
            clairis_id="BUD-001",
            sale_value=1000.0,
            cost=600.0,
            net_value=400.0
        )
        budget2 = StagingBudget(
            clairis_id="BUD-002",
            sale_value=2000.0,
            cost=1200.0,
            net_value=800.0
        )

        test_db.add_all([budget1, budget2])
        test_db.commit()

        stats = repo.get_budget_statistics()

        assert stats["total_budgets"] == 2
        assert stats["total_value"] == 3000.0
        assert stats["total_margin"] == 1200.0

    def test_error_handling_invalid_query(self, test_db):
        """Testa tratamento de erros em queries"""
        repo = StagingRepository(test_db)

        # Tentar usar um clairis_id inválido
        result = repo.get_patient_by_clairis_id(None)
        assert result is None
