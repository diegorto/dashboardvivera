import re
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class CPFNormalizer:
    """Normaliza CPF sem máscara"""
    
    @staticmethod
    def normalize(cpf: str) -> str:
        if not cpf:
            return None
        
        cpf = str(cpf).strip()
        
        # Remove mask characters
        cpf = re.sub(r'[\s\-\.]', '', cpf)
        
        # Keep only digits
        cpf = re.sub(r'[^\d]', '', cpf)
        
        # Validate length
        if len(cpf) != 11:
            logger.warning(f"CPF com comprimento inválido: {cpf}")
            return None
        
        return cpf
