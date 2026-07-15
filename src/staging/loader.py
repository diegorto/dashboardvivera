import pandas as pd
from pathlib import Path
from sqlalchemy.orm import Session
from src.core.logger import setup_logger
from src.models import StagingPatient, StagingBudget, StagingAppointment

logger = setup_logger(__name__)

class StagingLoader:
    """Carrega dados exportados para tabelas de staging"""
    
    def __init__(self, db: Session):
        self.db = db
        self.export_dir = Path("data/exports")
        
    async def load_all_exports(self) -> int:
        """Carrega todas as exportações para staging"""
        total_records = 0
        
        # List all CSV files in export directory
        for export_file in self.export_dir.glob("*.xlsx"):
            try:
                logger.info(f"Carregando {export_file.name}...")
                records = await self._load_file(export_file)
                total_records += records
            except Exception as e:
                logger.error(f"Erro ao carregar {export_file.name}: {str(e)}")
        
        return total_records
    
    async def _load_file(self, file_path: Path) -> int:
        """Carrega um arquivo específico"""
        try:
            df = pd.read_excel(file_path)
            
            file_name = file_path.stem.lower()
            
            if "pacientes" in file_name:
                return await self._load_patients(df)
            elif "orcamentos" in file_name:
                return await self._load_budgets(df)
            elif "agendamentos" in file_name or "agenda" in file_name:
                return await self._load_appointments(df)
            else:
                logger.warning(f"Tipo de arquivo desconhecido: {file_name}")
                return 0
                
        except Exception as e:
            logger.error(f"Erro ao processar {file_path}: {str(e)}")
            return 0
    
    async def _load_patients(self, df: pd.DataFrame) -> int:
        """Carrega pacientes para staging"""
        count = 0
        for idx, row in df.iterrows():
            try:
                patient = StagingPatient(
                    clairis_id=str(row.get("ID", "")),
                    phone=str(row.get("Telefone", "")),
                    name=str(row.get("Nome completo", "")),
                    email=str(row.get("E-mail", "")),
                    cpf=str(row.get("CPF", "")),
                    status=str(row.get("Status", "")),
                    plan=str(row.get("Plano", "")),
                    referred_by=str(row.get("Indicado por", "")),
                    raw_data=row.to_dict()
                )
                self.db.add(patient)
                count += 1
            except Exception as e:
                logger.warning(f"Erro ao carregar paciente: {str(e)}")
        
        self.db.commit()
        logger.info(f"Carregados {count} pacientes")
        return count
    
    async def _load_budgets(self, df: pd.DataFrame) -> int:
        """Carrega orçamentos para staging"""
        count = 0
        for idx, row in df.iterrows():
            try:
                budget = StagingBudget(
                    clairis_id=str(row.get("ID", "")),
                    status=str(row.get("Status", "")),
                    procedure=str(row.get("Procedimento", "")),
                    professional=str(row.get("Profissional", "")),
                    sale_value=float(row.get("Valor Venda", 0)),
                    cost=float(row.get("Custo", 0)),
                    raw_data=row.to_dict()
                )
                self.db.add(budget)
                count += 1
            except Exception as e:
                logger.warning(f"Erro ao carregar orçamento: {str(e)}")
        
        self.db.commit()
        logger.info(f"Carregados {count} orçamentos")
        return count
    
    async def _load_appointments(self, df: pd.DataFrame) -> int:
        """Carrega agendamentos para staging"""
        count = 0
        for idx, row in df.iterrows():
            try:
                appointment = StagingAppointment(
                    clairis_id=str(row.get("ID", "")),
                    professional=str(row.get("Profissional", "")),
                    status=str(row.get("Status", "")),
                    raw_data=row.to_dict()
                )
                self.db.add(appointment)
                count += 1
            except Exception as e:
                logger.warning(f"Erro ao carregar agendamento: {str(e)}")
        
        self.db.commit()
        logger.info(f"Carregados {count} agendamentos")
        return count
