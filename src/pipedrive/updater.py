from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from src.core.logger import setup_logger
from src.pipedrive.api import PipedriveAPIClient
from src.models import AuditLog, AuditLogStatus
from src.core.config import settings

logger = setup_logger(__name__)

class PipedriveUpdater:
    """Gerenciador de atualizações seguras no Pipedrive com auditoria completa"""
    
    # Campos permitidos por tipo de entidade (whitelist)
    ALLOWED_PERSON_FIELDS = {
        "name", "email", "phone", "org_id", "owner_id", "label",
        "notes", "first_name", "last_name", "visible_to"
    }
    
    ALLOWED_DEAL_FIELDS = {
        "title", "value", "currency", "user_id", "person_id", "org_id",
        "stage_id", "status", "probability", "expected_close_date", 
        "lost_reason", "visible_to", "add_time", "won_time", "lost_time"
    }
    
    ALLOWED_ORGANIZATION_FIELDS = {
        "name", "owner_id", "address", "cc_email", "notes", "visible_to"
    }
    
    def __init__(self, db: Session, batch_id: str):
        self.db = db
        self.batch_id = batch_id
        self.updates_log: List[Dict] = []
        logger.info(f"PipedriveUpdater inicializado para batch {batch_id}")
    
    async def update_person_safe(self, 
                                 person_id: int,
                                 person_data_clairis: Dict[str, Any],
                                 person_data_pipedrive: Dict[str, Any],
                                 api_client: PipedriveAPIClient) -> Tuple[bool, str]:
        """
        Atualiza pessoa no Pipedrive de forma segura
        
        Validações:
        - Apenas campos permitidos
        - Nunca apaga registros
        - Sincronização incremental (upsert)
        - Auditoria completa
        
        Args:
            person_id: ID da pessoa no Pipedrive
            person_data_clairis: Dados normalizados do Clairis
            person_data_pipedrive: Dados atuais do Pipedrive
            api_client: Cliente API Pipedrive
        
        Returns:
            Tupla (sucesso: bool, mensagem: str)
        """
        try:
            logger.info(f"Iniciando atualização segura da pessoa ID={person_id}")
            
            # 1. Detectar diferenças
            differences = self._detect_differences(person_data_clairis, person_data_pipedrive)
            
            if not differences:
                logger.info(f"Nenhuma diferença detectada para pessoa ID={person_id}")
                return True, "Sem alterações"
            
            # 2. Filtrar apenas campos permitidos
            update_data = self._filter_allowed_fields(
                differences,
                self.ALLOWED_PERSON_FIELDS
            )
            
            if not update_data:
                logger.warning(f"Nenhum campo permitido para atualizar pessoa ID={person_id}")
                return False, "Nenhum campo permitido"
            
            # 3. Validar dados antes de atualizar
            is_valid, validation_msg = self._validate_person_data(update_data)
            if not is_valid:
                logger.error(f"Validação falhou: {validation_msg}")
                return False, validation_msg
            
            # 4. Executar atualização
            logger.info(f"Atualizando pessoa ID={person_id} com dados: {update_data}")
            success = await api_client.update_person(person_id, update_data)
            
            if not success:
                logger.error(f"Falha ao atualizar pessoa ID={person_id} na API")
                return False, "Erro na API Pipedrive"
            
            # 5. Registrar em auditoria (sucesso)
            for field_name, (old_value, new_value) in differences.items():
                self._create_audit_log(
                    entity_type="person",
                    entity_id=str(person_id),
                    field_name=field_name,
                    old_value=old_value,
                    new_value=new_value,
                    status=AuditLogStatus.IMPORTED,
                    confidence_level=95.0
                )
            
            logger.info(f"Pessoa ID={person_id} atualizada com sucesso")
            return True, "Atualizado com sucesso"
            
        except Exception as e:
            logger.error(f"Erro ao atualizar pessoa: {str(e)}", exc_info=True)
            
            # Registrar erro em auditoria
            self._create_audit_log(
                entity_type="person",
                entity_id=str(person_id),
                field_name="ERROR",
                old_value="",
                new_value=str(e),
                status=AuditLogStatus.REJECTED,
                confidence_level=0.0
            )
            
            return False, f"Exceção: {str(e)}"
    
    async def update_deal_safe(self,
                              deal_id: int,
                              deal_data_clairis: Dict[str, Any],
                              deal_data_pipedrive: Dict[str, Any],
                              api_client: PipedriveAPIClient) -> Tuple[bool, str]:
        """
        Atualiza negócio (deal) no Pipedrive de forma segura
        
        Args:
            deal_id: ID do negócio
            deal_data_clairis: Dados do Clairis
            deal_data_pipedrive: Dados atuais do Pipedrive
            api_client: Cliente API Pipedrive
        
        Returns:
            Tupla (sucesso: bool, mensagem: str)
        """
        try:
            logger.info(f"Iniciando atualização segura do negócio ID={deal_id}")
            
            # 1. Detectar diferenças
            differences = self._detect_differences(deal_data_clairis, deal_data_pipedrive)
            
            if not differences:
                logger.info(f"Nenhuma diferença detectada para negócio ID={deal_id}")
                return True, "Sem alterações"
            
            # 2. Filtrar apenas campos permitidos
            update_data = self._filter_allowed_fields(
                differences,
                self.ALLOWED_DEAL_FIELDS
            )
            
            if not update_data:
                logger.warning(f"Nenhum campo permitido para atualizar negócio ID={deal_id}")
                return False, "Nenhum campo permitido"
            
            # 3. Validar dados
            is_valid, validation_msg = self._validate_deal_data(update_data)
            if not is_valid:
                logger.error(f"Validação falhou: {validation_msg}")
                return False, validation_msg
            
            # 4. Executar atualização
            logger.info(f"Atualizando negócio ID={deal_id} com dados: {update_data}")
            success = await api_client.update_deal(deal_id, update_data)
            
            if not success:
                logger.error(f"Falha ao atualizar negócio ID={deal_id} na API")
                return False, "Erro na API Pipedrive"
            
            # 5. Registrar em auditoria (sucesso)
            for field_name, (old_value, new_value) in differences.items():
                self._create_audit_log(
                    entity_type="deal",
                    entity_id=str(deal_id),
                    field_name=field_name,
                    old_value=old_value,
                    new_value=new_value,
                    status=AuditLogStatus.IMPORTED,
                    confidence_level=95.0
                )
            
            logger.info(f"Negócio ID={deal_id} atualizado com sucesso")
            return True, "Atualizado com sucesso"
            
        except Exception as e:
            logger.error(f"Erro ao atualizar negócio: {str(e)}", exc_info=True)
            
            self._create_audit_log(
                entity_type="deal",
                entity_id=str(deal_id),
                field_name="ERROR",
                old_value="",
                new_value=str(e),
                status=AuditLogStatus.REJECTED,
                confidence_level=0.0
            )
            
            return False, f"Exceção: {str(e)}"
    
    async def create_person_safe(self,
                                 person_data: Dict[str, Any],
                                 api_client: PipedriveAPIClient) -> Tuple[Optional[int], str]:
        """
        Cria nova pessoa no Pipedrive de forma segura
        
        Args:
            person_data: Dados normalizados da pessoa
            api_client: Cliente API Pipedrive
        
        Returns:
            Tupla (ID da pessoa criada ou None, mensagem)
        """
        try:
            logger.info(f"Criando nova pessoa: {person_data.get('name')}")
            
            # 1. Filtrar apenas campos permitidos
            create_data = self._filter_allowed_fields(
                person_data,
                self.ALLOWED_PERSON_FIELDS
            )
            
            # 2. Validar dados
            is_valid, validation_msg = self._validate_person_data(create_data)
            if not is_valid:
                logger.error(f"Validação falhou: {validation_msg}")
                return None, validation_msg
            
            # 3. Executar criação
            person_id = await api_client.create_person(create_data)
            
            if not person_id:
                logger.error("Falha ao criar pessoa na API")
                return None, "Erro na API Pipedrive"
            
            # 4. Registrar em auditoria
            self._create_audit_log(
                entity_type="person",
                entity_id=str(person_id),
                field_name="INSERT",
                old_value="",
                new_value=str(person_data),
                status=AuditLogStatus.IMPORTED,
                confidence_level=100.0
            )
            
            logger.info(f"Pessoa criada com ID={person_id}")
            return person_id, "Criado com sucesso"
            
        except Exception as e:
            logger.error(f"Erro ao criar pessoa: {str(e)}", exc_info=True)
            return None, f"Exceção: {str(e)}"
    
    async def detect_duplicates(self,
                               person_data: Dict[str, Any],
                               api_client: PipedriveAPIClient) -> Optional[Dict]:
        """
        Detecta possíveis duplicatas no Pipedrive
        
        Busca por:
        1. Telefone (principal)
        2. Email
        3. Nome + Telefone
        
        Args:
            person_data: Dados da pessoa com campos normalizados
            api_client: Cliente API Pipedrive
        
        Returns:
            Dados da pessoa duplicata encontrada ou None
        """
        logger.info(f"Verificando duplicatas para: {person_data.get('name')}")
        
        # 1. Buscar por telefone (PRINCIPAL)
        if person_data.get("phone"):
            duplicate = await api_client.get_persons_by_phone(person_data["phone"])
            if duplicate:
                logger.warning(f"Duplicata encontrada pelo telefone: ID={duplicate.get('id')}")
                return duplicate
        
        # 2. Buscar por email (se houver)
        if person_data.get("email"):
            logger.debug(f"Verificando email: {person_data['email']}")
            # Nota: Pipedrive API não tem endpoint direto de busca por email
            # Implementar verificação manualmente se necessário
        
        logger.info("Nenhuma duplicata detectada")
        return None
    
    # ========== MÉTODOS AUXILIARES PRIVADOS ==========
    
    def _detect_differences(self, data_clairis: Dict, data_pipedrive: Dict) -> Dict[str, Tuple]:
        """Detecta diferenças entre dois dicts"""
        differences = {}
        
        for key, clairis_value in data_clairis.items():
            pipedrive_value = data_pipedrive.get(key)
            
            # Normalizar para comparação
            clairis_str = str(clairis_value).strip() if clairis_value else ""
            pipedrive_str = str(pipedrive_value).strip() if pipedrive_value else ""
            
            if clairis_str != pipedrive_str:
                differences[key] = (pipedrive_value, clairis_value)
        
        return differences
    
    def _filter_allowed_fields(self, data: Dict, allowed_fields: set) -> Dict:
        """Filtra apenas campos permitidos"""
        return {k: v for k, v in data.items() if k in allowed_fields}
    
    def _validate_person_data(self, data: Dict) -> Tuple[bool, str]:
        """Valida dados de pessoa"""
        
        # Nome é obrigatório
        if "name" in data:
            name = data["name"]
            if not isinstance(name, str) or len(name.strip()) < 2:
                return False, "Nome deve ter pelo menos 2 caracteres"
        
        # Email deve ser válido
        if "email" in data:
            email = data["email"]
            if email and "@" not in email:
                return False, "Email inválido"
        
        # Telefone deve ser numérico
        if "phone" in data:
            phone = data["phone"]
            if phone and not str(phone).isdigit():
                return False, "Telefone deve conter apenas dígitos"
        
        return True, "Válido"
    
    def _validate_deal_data(self, data: Dict) -> Tuple[bool, str]:
        """Valida dados de negócio"""
        
        # Title é obrigatório
        if "title" in data:
            title = data["title"]
            if not isinstance(title, str) or len(title.strip()) < 3:
                return False, "Título deve ter pelo menos 3 caracteres"
        
        # Value deve ser número
        if "value" in data:
            try:
                float(data["value"])
            except (ValueError, TypeError):
                return False, "Valor deve ser numérico"
        
        # Probability deve estar entre 0-100
        if "probability" in data:
            try:
                prob = int(data["probability"])
                if not (0 <= prob <= 100):
                    return False, "Probabilidade deve estar entre 0-100"
            except (ValueError, TypeError):
                return False, "Probabilidade deve ser numérica"
        
        return True, "Válido"
    
    def _create_audit_log(self, 
                         entity_type: str,
                         entity_id: str,
                         field_name: str,
                         old_value: Any,
                         new_value: Any,
                         status: AuditLogStatus = AuditLogStatus.IMPORTED,
                         confidence_level: float = 100.0):
        """Cria registro de auditoria"""
        
        audit_log = AuditLog(
            batch_id=self.batch_id,
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            old_value=str(old_value),
            new_value=str(new_value),
            source="pipedrive",
            status=status,
            confidence_level=confidence_level,
            reason="Sincronização automática Clairis → Pipedrive",
            created_at=datetime.utcnow(),
            metadata={
                "sync_method": "automatic",
                "entity_type": entity_type
            }
        )
        
        self.db.add(audit_log)
        self.db.commit()
        
        logger.debug(f"Audit log criado: {entity_type}:{entity_id}:{field_name}")
        
        return audit_log
