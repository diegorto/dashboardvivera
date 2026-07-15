import pytest
from src.normalization.phone import PhoneNormalizer


class TestPhoneNormalizer:
    """Testes para normalização de números de telefone"""

    def test_normalize_valid_phone_without_country_code(self):
        """Testa normalização de telefone válido sem código do país"""
        phone = "48 99999-9999"
        result = PhoneNormalizer.normalize(phone)
        assert result == "5548999999999"

    def test_normalize_valid_phone_with_country_code(self):
        """Testa normalização de telefone com código do país"""
        phone = "55 48 99999-9999"
        result = PhoneNormalizer.normalize(phone)
        assert result == "5548999999999"

    def test_normalize_phone_with_parentheses(self):
        """Testa telefone com formatação de parênteses"""
        phone = "(48) 99999-9999"
        result = PhoneNormalizer.normalize(phone)
        assert result == "5548999999999"

    def test_normalize_phone_with_plus_sign(self):
        """Testa telefone com sinal de +"""
        phone = "+55 48 99999-9999"
        result = PhoneNormalizer.normalize(phone)
        assert result == "5548999999999"

    def test_normalize_only_digits(self):
        """Testa telefone apenas com dígitos"""
        phone = "5548999999999"
        result = PhoneNormalizer.normalize(phone)
        assert result == "5548999999999"

    def test_normalize_none_returns_none(self):
        """Testa que None retorna None"""
        result = PhoneNormalizer.normalize(None)
        assert result is None

    def test_normalize_empty_string_returns_none(self):
        """Testa que string vazia retorna None"""
        result = PhoneNormalizer.normalize("")
        assert result is None

    def test_normalize_invalid_length_short(self):
        """Testa telefone muito curto"""
        phone = "48 9999"
        result = PhoneNormalizer.normalize(phone)
        assert result is None

    def test_normalize_invalid_length_long(self):
        """Testa telefone muito longo"""
        phone = "55 48 99999-9999-9999"
        result = PhoneNormalizer.normalize(phone)
        assert result is None

    def test_normalize_with_letters_returns_none(self):
        """Testa telefone contendo letras"""
        phone = "55 48 9999A-9999"
        result = PhoneNormalizer.normalize(phone)
        assert result is None

    def test_normalize_whitespace_handling(self):
        """Testa que espaços em branco são removidos"""
        phone = "  55 48 99999 9999  "
        result = PhoneNormalizer.normalize(phone)
        assert result == "5548999999999"

    def test_normalize_alternative_country_code(self):
        """Testa telefone com código de país duplicado"""
        phone = "5555 48 99999-9999"
        result = PhoneNormalizer.normalize(phone)
        # Comportamento: remove chars especiais, não vai dar 13 dígitos
        assert result is None

    def test_normalize_area_code_without_country(self):
        """Testa sem código de país mas com área válida"""
        phone = "48999999999"
        result = PhoneNormalizer.normalize(phone)
        assert result == "5548999999999"

    @pytest.mark.parametrize("phone,expected", [
        ("(48) 99999-9999", "5548999999999"),
        ("48 99999-9999", "5548999999999"),
        ("+55 (48) 99999-9999", "5548999999999"),
        ("5548999999999", "5548999999999"),
    ])
    def test_normalize_multiple_formats(self, phone, expected):
        """Testa múltiplos formatos de entrada"""
        result = PhoneNormalizer.normalize(phone)
        assert result == expected
