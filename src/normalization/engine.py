import pandas as pd
from pathlib import Path
from src.core.logger import setup_logger
from .phone import PhoneNormalizer
from .name import NameNormalizer
from .cpf import CPFNormalizer
from .date import DateNormalizer
from .status import StatusNormalizer

logger = setup_logger(__name__)

class NormalizationEngine:
    """Motor de normalização de dados antes da comparação"""
    
    def __init__(self):
        self.staging_dir = Path("data/staging")
        self.staging_dir.mkdir(parents=True, exist_ok=True)
        
    def normalize_patients(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normaliza tabela de pacientes"""
        logger.info(f"Normalizando {len(df)} pacientes...")
        
        df = df.copy()
        
        # Normalize phone
        if 'Telefone' in df.columns:
            df['telefone_normalizado'] = df['Telefone'].apply(PhoneNormalizer.normalize)
        
        # Normalize name
        if 'Nome completo' in df.columns:
            df['nome_normalizado'] = df['Nome completo'].apply(NameNormalizer.normalize)
        
        # Normalize CPF if exists
        if 'CPF' in df.columns:
            df['cpf_normalizado'] = df['CPF'].apply(CPFNormalizer.normalize)
        
        # Normalize status
        if 'Status' in df.columns:
            df['status_normalizado'] = df['Status'].apply(StatusNormalizer.normalize)
        
        logger.info(f"Normalização de pacientes concluída")
        return df
    
    def normalize_budgets(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normaliza tabela de orçamentos"""
        logger.info(f"Normalizando {len(df)} orçamentos...")
        
        df = df.copy()
        
        # Normalize status
        if 'Status' in df.columns:
            df['status_normalizado'] = df['Status'].apply(StatusNormalizer.normalize)
        
        # Normalize values to decimal
        if 'Valor Venda' in df.columns:
            df['valor_venda_normalizado'] = pd.to_numeric(df['Valor Venda'], errors='coerce')
        
        if 'Custo' in df.columns:
            df['custo_normalizado'] = pd.to_numeric(df['Custo'], errors='coerce')
        
        # Normalize dates
        if 'Data' in df.columns:
            df['data_normalizada'] = df['Data'].apply(DateNormalizer.normalize)
        
        logger.info(f"Normalização de orçamentos concluída")
        return df
    
    def normalize_appointments(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normaliza tabela de agendamentos"""
        logger.info(f"Normalizando {len(df)} agendamentos...")
        
        df = df.copy()
        
        # Normalize date
        if 'Data' in df.columns:
            df['data_normalizada'] = df['Data'].apply(DateNormalizer.normalize)
        
        # Normalize status
        if 'Status' in df.columns:
            df['status_normalizado'] = df['Status'].apply(StatusNormalizer.normalize)
        
        logger.info(f"Normalização de agendamentos concluída")
        return df
    
    def save_normalized_data(self, df: pd.DataFrame, name: str):
        """Salva dados normalizados no staging"""
        try:
            file_path = self.staging_dir / f"{name}_normalized.csv"
            df.to_csv(file_path, index=False, encoding='utf-8')
            logger.info(f"Dados normalizados salvos: {file_path}")
        except Exception as e:
            logger.error(f"Erro ao salvar dados normalizados: {str(e)}")
