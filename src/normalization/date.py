from datetime import datetime
import pandas as pd
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class DateNormalizer:
    """Normaliza datas para formato ISO (YYYY-MM-DD)"""
    
    @staticmethod
    def normalize(date_value) -> str:
        if not date_value or pd.isna(date_value):
            return None
        
        try:
            # If already datetime object
            if isinstance(date_value, datetime):
                return date_value.strftime("%Y-%m-%d")
            
            # Try to parse string
            date_obj = pd.to_datetime(date_value)
            return date_obj.strftime("%Y-%m-%d")
            
        except Exception as e:
            logger.warning(f"Erro ao normalizar data {date_value}: {str(e)}")
            return None
