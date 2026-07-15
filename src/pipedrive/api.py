import httpx
import asyncio
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from src.core.config import settings
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class RateLimiter:
    """Gerenciador de rate limit (2 requisições por segundo)"""
    
    def __init__(self, requests_per_second: int = 2):
        self.requests_per_second = requests_per_second
        self.min_interval = 1.0 / requests_per_second
        self.last_request_time = 0.0
        
    async def wait(self):
        elapsed = asyncio.get_event_loop().time() - self.last_request_time
        if elapsed < self.min_interval:
            await asyncio.sleep(self.min_interval - elapsed)
        self.last_request_time = asyncio.get_event_loop().time()

class PipedriveAPIClient:
    """Client HTTP para Pipedrive API com retry e rate limiting"""
    
    # Constantes
    BASE_URL = settings.PIPEDRIVE_URL
    MAX_RETRIES = 3
    RETRY_DELAY_BASE = 1  # segundos
    REQUEST_TIMEOUT = 30
    
    # Rate limiter compartilhado (2 req/s)
    rate_limiter = RateLimiter(requests_per_second=2)
    
    def __init__(self, api_token: Optional[str] = None):
        self.api_token = api_token or settings.PIPEDRIVE_API_TOKEN
        if not self.api_token:
            raise ValueError("Pipedrive API token não configurado em settings ou parâmetro")
        
        self.client: Optional[httpx.AsyncClient] = None
        logger.info("PipedriveAPIClient inicializado")
    
    async def __aenter__(self):
        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            params={"api_token": self.api_token},
            timeout=self.REQUEST_TIMEOUT,
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
    
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Executa requisição com retry automático e rate limiting"""
        
        url = f"{endpoint}"
        
        for attempt in range(self.MAX_RETRIES):
            try:
                # Aplica rate limit
                await self.rate_limiter.wait()
                
                logger.debug(f"{method} {url} (tentativa {attempt + 1}/{self.MAX_RETRIES})")
                
                response = await self.client.request(method, url, **kwargs)
                
                # Sucesso
                if response.status_code in [200, 201]:
                    try:
                        return response.json()
                    except Exception as e:
                        logger.error(f"Erro ao parsear JSON: {str(e)}")
                        return {"success": True, "data": response.text}
                
                # Erro 404 (não encontrado)
                if response.status_code == 404:
                    logger.warning(f"Recurso não encontrado: {url}")
                    return {"success": False, "error": "Not found"}
                
                # Erro 401 (autenticação)
                if response.status_code == 401:
                    logger.error("Token Pipedrive inválido ou expirado")
                    raise ValueError("Autenticação Pipedrive falhou")
                
                # Erro 429 (rate limit)
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(f"Rate limit atingido. Aguardando {retry_after}s")
                    await asyncio.sleep(retry_after)
                    continue
                
                # Erro 5xx (servidor)
                if 500 <= response.status_code < 600:
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAY_BASE * (2 ** attempt)
                        logger.warning(f"Erro servidor {response.status_code}. Retry em {delay}s")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        logger.error(f"Erro servidor {response.status_code} após {self.MAX_RETRIES} tentativas")
                        raise Exception(f"Server error: {response.status_code}")
                
                # Outros erros
                logger.error(f"Erro na requisição: {response.status_code} - {response.text}")
                return {"success": False, "error": response.text, "status_code": response.status_code}
                
            except httpx.TimeoutException:
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAY_BASE * (2 ** attempt)
                    logger.warning(f"Timeout. Retry em {delay}s")
                    await asyncio.sleep(delay)
                    continue
                else:
                    logger.error("Timeout após todas as tentativas")
                    raise
            
            except Exception as e:
                logger.error(f"Erro na requisição: {str(e)}")
                raise
        
        raise Exception(f"Falha após {self.MAX_RETRIES} tentativas")
    
    # ========== MÉTODOS DE BUSCA ==========
    
    async def get_persons(self, limit: int = 500, start: int = 0) -> List[Dict]:
        """
        Busca pessoas no Pipedrive
        
        Args:
            limit: Máximo de registros (max 500)
            start: Offset para paginação
        
        Returns:
            Lista de pessoas
        """
        logger.info(f"Buscando pessoas (limit={limit}, start={start})")
        
        params = {"limit": min(limit, 500), "start": start}
        response = await self._request("GET", "/persons", params=params)
        
        if response.get("success"):
            persons = response.get("data", [])
            logger.info(f"Retornadas {len(persons)} pessoas")
            return persons
        else:
            logger.warning(f"Erro ao buscar pessoas: {response.get('error')}")
            return []
    
    async def get_persons_by_phone(self, phone: str) -> Optional[Dict]:
        """
        Busca pessoa pelo telefone
        
        Args:
            phone: Telefone normalizado (5548999999999)
        
        Returns:
            Dados da pessoa ou None
        """
        logger.info(f"Buscando pessoa pelo telefone: {phone}")
        
        params = {"search_field": "phone", "search_value": phone}
        response = await self._request("GET", "/persons/find", params=params)
        
        if response.get("success"):
            person = response.get("data")
            if person:
                logger.info(f"Pessoa encontrada: ID={person.get('id')}")
            return person
        else:
            logger.debug(f"Pessoa não encontrada com telefone: {phone}")
            return None
    
    async def get_deals(self, limit: int = 500, start: int = 0) -> List[Dict]:
        """
        Busca negócios (deals) no Pipedrive
        
        Args:
            limit: Máximo de registros (max 500)
            start: Offset para paginação
        
        Returns:
            Lista de negócios
        """
        logger.info(f"Buscando negócios (limit={limit}, start={start})")
        
        params = {"limit": min(limit, 500), "start": start}
        response = await self._request("GET", "/deals", params=params)
        
        if response.get("success"):
            deals = response.get("data", [])
            logger.info(f"Retornados {len(deals)} negócios")
            return deals
        else:
            logger.warning(f"Erro ao buscar negócios: {response.get('error')}")
            return []
    
    async def get_organizations(self, limit: int = 500, start: int = 0) -> List[Dict]:
        """
        Busca organizações no Pipedrive
        
        Args:
            limit: Máximo de registros (max 500)
            start: Offset para paginação
        
        Returns:
            Lista de organizações
        """
        logger.info(f"Buscando organizações (limit={limit}, start={start})")
        
        params = {"limit": min(limit, 500), "start": start}
        response = await self._request("GET", "/organizations", params=params)
        
        if response.get("success"):
            orgs = response.get("data", [])
            logger.info(f"Retornadas {len(orgs)} organizações")
            return orgs
        else:
            logger.warning(f"Erro ao buscar organizações: {response.get('error')}")
            return []
    
    async def get_activities(self, limit: int = 500, start: int = 0) -> List[Dict]:
        """
        Busca atividades no Pipedrive
        
        Args:
            limit: Máximo de registros (max 500)
            start: Offset para paginação
        
        Returns:
            Lista de atividades
        """
        logger.info(f"Buscando atividades (limit={limit}, start={start})")
        
        params = {"limit": min(limit, 500), "start": start}
        response = await self._request("GET", "/activities", params=params)
        
        if response.get("success"):
            activities = response.get("data", [])
            logger.info(f"Retornadas {len(activities)} atividades")
            return activities
        else:
            logger.warning(f"Erro ao buscar atividades: {response.get('error')}")
            return []
    
    # ========== MÉTODOS DE ATUALIZAÇÃO ==========
    
    async def update_person(self, person_id: int, data: Dict[str, Any]) -> bool:
        """
        Atualiza pessoa no Pipedrive
        
        Args:
            person_id: ID da pessoa
            data: Dados a atualizar (ex: {"name": "novo nome", "phone": "5548999999999"})
        
        Returns:
            True se atualizado com sucesso
        """
        logger.info(f"Atualizando pessoa ID={person_id}")
        
        response = await self._request("PUT", f"/persons/{person_id}", json=data)
        
        if response.get("success"):
            logger.info(f"Pessoa ID={person_id} atualizada com sucesso")
            return True
        else:
            logger.error(f"Erro ao atualizar pessoa: {response.get('error')}")
            return False
    
    async def update_deal(self, deal_id: int, data: Dict[str, Any]) -> bool:
        """
        Atualiza negócio no Pipedrive
        
        Args:
            deal_id: ID do negócio
            data: Dados a atualizar
        
        Returns:
            True se atualizado com sucesso
        """
        logger.info(f"Atualizando negócio ID={deal_id}")
        
        response = await self._request("PUT", f"/deals/{deal_id}", json=data)
        
        if response.get("success"):
            logger.info(f"Negócio ID={deal_id} atualizado com sucesso")
            return True
        else:
            logger.error(f"Erro ao atualizar negócio: {response.get('error')}")
            return False
    
    # ========== MÉTODOS DE CRIAÇÃO ==========
    
    async def create_person(self, data: Dict[str, Any]) -> Optional[int]:
        """
        Cria nova pessoa no Pipedrive
        
        Args:
            data: Dados da pessoa (ex: {"name": "João Silva", "phone": "5548999999999"})
        
        Returns:
            ID da pessoa criada ou None se falhar
        """
        logger.info(f"Criando pessoa: {data.get('name')}")
        
        response = await self._request("POST", "/persons", json=data)
        
        if response.get("success"):
            person_id = response.get("data", {}).get("id")
            logger.info(f"Pessoa criada com ID={person_id}")
            return person_id
        else:
            logger.error(f"Erro ao criar pessoa: {response.get('error')}")
            return None
    
    async def create_deal(self, data: Dict[str, Any]) -> Optional[int]:
        """
        Cria novo negócio no Pipedrive
        
        Args:
            data: Dados do negócio
        
        Returns:
            ID do negócio criado ou None se falhar
        """
        logger.info(f"Criando negócio: {data.get('title')}")
        
        response = await self._request("POST", "/deals", json=data)
        
        if response.get("success"):
            deal_id = response.get("data", {}).get("id")
            logger.info(f"Negócio criado com ID={deal_id}")
            return deal_id
        else:
            logger.error(f"Erro ao criar negócio: {response.get('error')}")
            return None
    
    async def create_activity(self, data: Dict[str, Any]) -> Optional[int]:
        """
        Cria nova atividade no Pipedrive
        
        Args:
            data: Dados da atividade
        
        Returns:
            ID da atividade criada ou None se falhar
        """
        logger.info(f"Criando atividade: {data.get('subject')}")
        
        response = await self._request("POST", "/activities", json=data)
        
        if response.get("success"):
            activity_id = response.get("data", {}).get("id")
            logger.info(f"Atividade criada com ID={activity_id}")
            return activity_id
        else:
            logger.error(f"Erro ao criar atividade: {response.get('error')}")
            return None
    
    # ========== MÉTODO DE VERIFICAÇÃO ==========
    
    async def verify_connection(self) -> bool:
        """
        Verifica se a conexão com Pipedrive está funcionando
        
        Returns:
            True se conectado com sucesso
        """
        try:
            logger.info("Verificando conexão com Pipedrive")
            response = await self._request("GET", "/users/me")
            
            if response.get("success"):
                user = response.get("data", {})
                logger.info(f"Conectado ao Pipedrive como: {user.get('name', 'Desconhecido')}")
                return True
            else:
                logger.error("Falha ao conectar ao Pipedrive")
                return False
        except Exception as e:
            logger.error(f"Erro ao verificar conexão: {str(e)}")
            return False
