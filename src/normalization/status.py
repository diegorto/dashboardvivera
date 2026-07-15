from src.core.logger import setup_logger

logger = setup_logger(__name__)

class StatusNormalizer:
    """Normaliza status para valores padrão"""
    
    STATUS_MAP = {
        # Budget Status
        "Pago": "PAGO",
        "PAGAMENTO": "PAGO",
        "Quitado": "PAGO",
        "Recebido": "PAGO",
        "Pagamento": "PAGO",
        
        "Pendente": "PENDENTE",
        "PENDENTE": "PENDENTE",
        "Aguardando": "PENDENTE",
        
        "Aprovado": "APROVADO",
        "APROVADO": "APROVADO",
        "Aprovada": "APROVADO",
        
        "Reprovado": "REPROVADO",
        "REPROVADO": "REPROVADO",
        "Recusado": "REPROVADO",
        
        # Patient Status
        "Ativo": "ATIVO",
        "ATIVO": "ATIVO",
        "Ativa": "ATIVO",
        
        "Inativo": "INATIVO",
        "INATIVO": "INATIVO",
        "Inativa": "INATIVO",
    }
    
    @staticmethod
    def normalize(status: str) -> str:
        if not status:
            return None
        
        status = str(status).strip()
        
        # Lookup in map
        normalized = StatusNormalizer.STATUS_MAP.get(status, status.upper())
        
        return normalized
