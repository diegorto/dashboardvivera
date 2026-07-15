import pytest
from datetime import datetime
from src.reconciliation.engine import ReconciliationEngine, FieldDivergence, ReconciliationReport
from src.models import StagingPatient
from src.executive_os.database import Patient


class TestReconciliationEngine:
    """Testes para ReconciliationEngine"""

    def test_normalize_value_phone(self):
        """Testa normalização de telefone"""
        engine = ReconciliationEngine(None)
        result = engine._normalize_value("(48) 99999-9999", "phone")
        assert result == "48999999999"

    def test_normalize_value_cpf(self):
        """Testa normalização de CPF"""
        engine = ReconciliationEngine(None)
        result = engine._normalize_value("123.456.789-00", "cpf")
        assert result == "12345678900"

    def test_normalize_value_name_case_insensitive(self):
        """Testa normalização de nome (case insensitive)"""
        engine = ReconciliationEngine(None)
        result = engine._normalize_value("João Silva", "name")
        assert result == "joão silva"

    def test_normalize_value_empty_string(self):
        """Testa normalização de string vazia"""
        engine = ReconciliationEngine(None)
        result = engine._normalize_value("", "name")
        assert result == ""

    def test_normalize_value_none(self):
        """Testa normalização de None"""
        engine = ReconciliationEngine(None)
        result = engine._normalize_value(None, "name")
        assert result == ""

    def test_assess_severity_critical_field(self):
        """Testa avaliação de severidade para campos críticos"""
        engine = ReconciliationEngine(None)
        severity = engine._assess_severity("phone", "5548999999999", "5548988888888")
        assert severity == "CRITICAL"

    def test_assess_severity_high_field(self):
        """Testa avaliação de severidade para campos altos"""
        engine = ReconciliationEngine(None)
        severity = engine._assess_severity("name", "João", "Jose")
        assert severity == "HIGH"

    def test_assess_severity_medium_field(self):
        """Testa avaliação de severidade para status"""
        engine = ReconciliationEngine(None)
        severity = engine._assess_severity("status", "ATIVO", "INATIVO")
        assert severity == "MEDIUM"

    def test_assess_severity_low_field(self):
        """Testa avaliação de severidade para campos baixos"""
        engine = ReconciliationEngine(None)
        severity = engine._assess_severity("referred_by", "John", "Jane")
        assert severity == "LOW"

    def test_calculate_similarity_identical(self):
        """Testa similaridade de strings idênticas"""
        engine = ReconciliationEngine(None)
        score = engine._calculate_similarity("João Silva", "joão silva")
        assert score == 1.0

    def test_calculate_similarity_very_different(self):
        """Testa similaridade de strings muito diferentes"""
        engine = ReconciliationEngine(None)
        score = engine._calculate_similarity("João", "Maria")
        assert score < 0.5

    def test_calculate_similarity_similar(self):
        """Testa similaridade de strings similares"""
        engine = ReconciliationEngine(None)
        score = engine._calculate_similarity("João Silva", "Joao Silva")
        assert 0.8 < score < 1.0

    def test_recommend_field_value_cpf(self, sample_divergence):
        """Testa recomendação para CPF"""
        engine = ReconciliationEngine(None)
        divergence = FieldDivergence(
            field_name="cpf",
            clairis_value="12345678900",
            pipedrive_value="98765432100",
            executive_os_value=None,
            confidence_level=0.0,
            recommended_value=None,
            recommendation_reason="",
            severity="CRITICAL",
            impact="Identificação única"
        )

        engine._recommend_field_value(divergence)

        assert divergence.recommended_value == "12345678900"
        assert divergence.confidence_level == 95.0
        assert "CPF" in divergence.recommendation_reason

    def test_recommend_field_value_phone(self):
        """Testa recomendação para telefone"""
        engine = ReconciliationEngine(None)
        divergence = FieldDivergence(
            field_name="phone",
            clairis_value="5548999999999",
            pipedrive_value="5548988888888",
            executive_os_value=None,
            confidence_level=0.0,
            recommended_value=None,
            recommendation_reason="",
            severity="CRITICAL",
            impact="Matching de pacientes"
        )

        engine._recommend_field_value(divergence)

        assert divergence.recommended_value == "5548999999999"
        assert divergence.confidence_level >= 75.0

    def test_calculate_confidence_empty_list(self):
        """Testa cálculo de confiança com lista vazia"""
        engine = ReconciliationEngine(None)
        confidence = engine._calculate_confidence([])
        assert confidence == 100.0

    def test_calculate_confidence_single_divergence(self):
        """Testa cálculo de confiança com uma divergência"""
        engine = ReconciliationEngine(None)
        divergence = FieldDivergence(
            field_name="phone",
            clairis_value="5548999999999",
            pipedrive_value="5548988888888",
            executive_os_value=None,
            confidence_level=85.0,
            recommended_value="5548999999999",
            recommendation_reason="",
            severity="HIGH",
            impact="Impact"
        )

        confidence = engine._calculate_confidence([divergence])
        # Telefone tem weight 0.25, então confiança = 85 * 0.25 / 0.25 = 85
        assert confidence == 85.0

    def test_determine_recommendation_no_conflicts(self):
        """Testa recomendação quando não há conflitos"""
        engine = ReconciliationEngine(None)
        recommendation = engine._determine_recommendation([], 100.0)
        assert recommendation == "OK"

    def test_determine_recommendation_critical_conflict(self):
        """Testa recomendação com conflito crítico"""
        engine = ReconciliationEngine(None)
        divergence = FieldDivergence(
            field_name="cpf",
            clairis_value="123",
            pipedrive_value="456",
            executive_os_value=None,
            confidence_level=50.0,
            recommended_value="123",
            recommendation_reason="",
            severity="CRITICAL",
            impact="Impact"
        )

        recommendation = engine._determine_recommendation([divergence], 50.0)
        assert recommendation == "CONFLICT"

    def test_determine_recommendation_manual_review(self):
        """Testa recomendação para revisão manual"""
        engine = ReconciliationEngine(None)
        divergence1 = FieldDivergence(
            field_name="name",
            clairis_value="João",
            pipedrive_value="Jose",
            executive_os_value=None,
            confidence_level=70.0,
            recommended_value="João",
            recommendation_reason="",
            severity="HIGH",
            impact="Impact"
        )
        divergence2 = FieldDivergence(
            field_name="email",
            clairis_value="joao@example.com",
            pipedrive_value="jose@example.com",
            executive_os_value=None,
            confidence_level=70.0,
            recommended_value="joao@example.com",
            recommendation_reason="",
            severity="HIGH",
            impact="Impact"
        )

        recommendation = engine._determine_recommendation([divergence1, divergence2], 60.0)
        assert recommendation == "MANUAL_REVIEW"

    def test_determine_recommendation_sync_ok(self):
        """Testa recomendação para sincronização"""
        engine = ReconciliationEngine(None)
        divergence = FieldDivergence(
            field_name="plan",
            clairis_value="Premium",
            pipedrive_value="Basic",
            executive_os_value=None,
            confidence_level=80.0,
            recommended_value="Premium",
            recommendation_reason="",
            severity="LOW",
            impact="Impact"
        )

        recommendation = engine._determine_recommendation([divergence], 85.0)
        assert recommendation == "SYNC"

    def test_generate_next_steps_conflict(self):
        """Testa geração de próximos passos para conflito"""
        engine = ReconciliationEngine(None)
        divergence = FieldDivergence(
            field_name="cpf",
            clairis_value="123",
            pipedrive_value="456",
            executive_os_value=None,
            confidence_level=50.0,
            recommended_value="123",
            recommendation_reason="",
            severity="CRITICAL",
            impact="Impact"
        )

        steps = engine._generate_next_steps([divergence], "CONFLICT")
        assert len(steps) > 0
        assert any("manual" in step.lower() for step in steps)

    def test_generate_next_steps_sync(self):
        """Testa geração de próximos passos para sincronização"""
        engine = ReconciliationEngine(None)
        divergence = FieldDivergence(
            field_name="plan",
            clairis_value="Premium",
            pipedrive_value="Basic",
            executive_os_value=None,
            confidence_level=85.0,
            recommended_value="Premium",
            recommendation_reason="",
            severity="LOW",
            impact="Impact"
        )

        steps = engine._generate_next_steps([divergence], "SYNC")
        assert len(steps) > 0
        assert any("sincronização" in step.lower() or "sync" in step.lower() for step in steps)
