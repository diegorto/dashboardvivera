import re
import pandas as pd
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class PhoneNormalizer:
    """Normaliza números de telefone para formato único: 5548999999999"""
    
    @staticmethod
    def normalize(phone: str) -> str:
        if not phone or pd.isna(phone):
            return None
        
        phone = str(phone).strip()
        
        # Remove common formatting
        phone = re.sub(r'[\s\-\(\)\+]', '', phone)
        
        # If doesn't start with 55 (BR code), add it
        if not phone.startswith('55'):
            phone = '55' + phone
        
        # Remove if it has non-digits
        if not phone.isdigit():
            logger.warning(f"Telefone inválido: {phone}")
            return None
        
        # Validate length (should be 13 digits: 55 + 2 area + 9 + 8 digits)
        if len(phone) != 13:
            logger.warning(f"Telefone com comprimento inválido: {phone}")
            return None
        
        return phone
