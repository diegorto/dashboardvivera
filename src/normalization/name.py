import re
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class NameNormalizer:
    """Normaliza nomes: capitalização, espaços, caracteres inválidos"""
    
    @staticmethod
    def normalize(name: str) -> str:
        if not name:
            return None
        
        name = str(name).strip()
        
        # Remove extra spaces
        name = re.sub(r'\s+', ' ', name)
        
        # Remove special characters (keep only letters, spaces, hyphens, apostrophes)
        name = re.sub(r'[^a-zA-ZÀ-ÿ\s\-\']', '', name)
        
        # Capitalize each word
        name = ' '.join(word.capitalize() for word in name.split())
        
        return name if name else None
