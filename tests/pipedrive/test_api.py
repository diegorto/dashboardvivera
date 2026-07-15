import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
import httpx

from src.pipedrive.api import PipedriveAPIClient, RateLimiter


class TestRateLimiter:
    """Testes para RateLimiter"""

    def test_init_default_rate(self):
        """Testa inicialização com taxa padrão"""
        limiter = RateLimiter()
        assert limiter.requests_per_second == 2
        assert limiter.min_interval == 0.5

    def test_init_custom_rate(self):
        """Testa inicialização com taxa customizada"""
        limiter = RateLimiter(requests_per_second=5)
        assert limiter.requests_per_second == 5
        assert limiter.min_interval == 0.2

    @pytest.mark.asyncio
    async def test_wait_first_request(self):
        """Testa wait no primeiro request (sem delay)"""
        limiter = RateLimiter()
        import asyncio
        start = asyncio.get_event_loop().time()
        await limiter.wait()
        end = asyncio.get_event_loop().time()

        # Primeiro request não deve ter delay
        assert (end - start) < 0.1

    @pytest.mark.asyncio
    async def test_wait_respects_interval(self):
        """Testa que wait respeita intervalo mínimo"""
        limiter = RateLimiter(requests_per_second=2)
        import asyncio

        # Primeiro request
        await limiter.wait()

        # Segundo request deve ter delay
        start = asyncio.get_event_loop().time()
        await limiter.wait()
        end = asyncio.get_event_loop().time()

        # Deve ter esperado pelo menos 0.4s (um pouco menos que 0.5s)
        assert (end - start) >= 0.4


class TestPipedriveAPIClient:
    """Testes para PipedriveAPIClient"""

    def test_init_with_token(self):
        """Testa inicialização com token"""
        client = PipedriveAPIClient(api_token="test-token-123")
        assert client.api_token == "test-token-123"
        assert client.client is None

    def test_init_without_token_raises_error(self):
        """Testa que init sem token levanta erro"""
        with patch("src.core.config.settings.PIPEDRIVE_API_TOKEN", None):
            with pytest.raises(ValueError):
                PipedriveAPIClient()

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Testa uso como context manager"""
        async with PipedriveAPIClient(api_token="test-token") as client:
            assert client.client is not None
            assert isinstance(client.client, httpx.AsyncClient)

    @pytest.mark.asyncio
    async def test_request_success_200(self):
        """Testa request com sucesso (200)"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": True, "data": {"id": 42}}

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client._request("GET", "/persons/1")

        assert result["success"] is True
        assert result["data"]["id"] == 42

    @pytest.mark.asyncio
    async def test_request_success_201(self):
        """Testa request com sucesso (201)"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True, "data": {"id": 99}}

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client._request("POST", "/persons", json={"name": "João"})

        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_request_not_found_404(self):
        """Testa request com 404"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 404

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client._request("GET", "/persons/99999")

        assert result["success"] is False
        assert "Not found" in result["error"]

    @pytest.mark.asyncio
    async def test_request_unauthorized_401(self):
        """Testa request com 401"""
        client = PipedriveAPIClient(api_token="invalid-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 401

        client.client.request = AsyncMock(return_value=mock_response)

        with pytest.raises(ValueError):
            await client._request("GET", "/persons")

    @pytest.mark.asyncio
    async def test_request_rate_limit_429_retry(self):
        """Testa que 429 faz retry com Retry-After"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        # Primeira chamada: 429
        mock_response_429 = MagicMock()
        mock_response_429.status_code = 429
        mock_response_429.headers.get.return_value = "1"

        # Segunda chamada: 200
        mock_response_200 = MagicMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"success": True}

        client.client.request = AsyncMock(side_effect=[mock_response_429, mock_response_200])

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await client._request("GET", "/persons")

        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_request_server_error_500_retry(self):
        """Testa que 500 faz retry"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        # Primeira chamada: 500
        mock_response_500 = MagicMock()
        mock_response_500.status_code = 500

        # Segunda chamada: 200
        mock_response_200 = MagicMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"success": True}

        client.client.request = AsyncMock(side_effect=[mock_response_500, mock_response_200])

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await client._request("GET", "/persons")

        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_get_persons(self):
        """Testa busca de pessoas"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "data": [
                {"id": 1, "name": "João"},
                {"id": 2, "name": "Maria"}
            ]
        }

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.get_persons(limit=100, start=0)

        assert len(result) == 2
        assert result[0]["name"] == "João"

    @pytest.mark.asyncio
    async def test_get_persons_by_phone(self):
        """Testa busca de pessoa por telefone"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "data": {"id": 42, "name": "João", "phone": "5548999999999"}
        }

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.get_persons_by_phone("5548999999999")

        assert result is not None
        assert result["id"] == 42

    @pytest.mark.asyncio
    async def test_get_persons_by_phone_not_found(self):
        """Testa busca de pessoa inexistente"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "data": None
        }

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.get_persons_by_phone("9999999999999")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_deals(self):
        """Testa busca de negócios"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "data": [
                {"id": 1, "title": "Deal 1", "value": 1000},
                {"id": 2, "title": "Deal 2", "value": 2000}
            ]
        }

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.get_deals()

        assert len(result) == 2
        assert result[0]["title"] == "Deal 1"

    @pytest.mark.asyncio
    async def test_update_person_success(self):
        """Testa atualização de pessoa"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": True}

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.update_person(42, {"name": "João Silva"})

        assert result is True

    @pytest.mark.asyncio
    async def test_update_person_failure(self):
        """Testa falha na atualização de pessoa"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": False, "error": "Invalid data"}

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.update_person(42, {"name": ""})

        assert result is False

    @pytest.mark.asyncio
    async def test_create_person_success(self):
        """Testa criação de pessoa"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "success": True,
            "data": {"id": 99, "name": "Nova Pessoa"}
        }

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.create_person({"name": "Nova Pessoa", "phone": "5548999999999"})

        assert result == 99

    @pytest.mark.asyncio
    async def test_create_person_failure(self):
        """Testa falha na criação de pessoa"""
        client = PipedriveAPIClient(api_token="test-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": False}

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.create_person({"name": ""})

        assert result is None

    @pytest.mark.asyncio
    async def test_verify_connection_success(self):
        """Testa verificação de conexão bem-sucedida"""
        client = PipedriveAPIClient(api_token="valid-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "data": {"id": 1, "name": "Test User"}
        }

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.verify_connection()

        assert result is True

    @pytest.mark.asyncio
    async def test_verify_connection_failure(self):
        """Testa verificação de conexão com falha"""
        client = PipedriveAPIClient(api_token="invalid-token")
        client.client = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"success": False}

        client.client.request = AsyncMock(return_value=mock_response)

        result = await client.verify_connection()

        assert result is False
