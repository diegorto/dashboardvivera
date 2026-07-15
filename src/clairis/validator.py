from pathlib import Path
from datetime import datetime
import pandas as pd
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class ExportValidator:
    def __init__(self):
        self.export_dir = Path("data/exports")
        self.min_file_size = 1024  # 1KB minimum
        
    def validate_all_exports(self, export_results: dict) -> dict:
        """Valida todas as exportações"""
        validation_results = {
            "timestamp": datetime.now().isoformat(),
            "total_files": 0,
            "valid_files": 0,
            "invalid_files": 0,
            "validations": {},
            "errors": []
        }
        
        for export_name, export_info in export_results.get("exports", {}).items():
            try:
                file_path = self.export_dir / export_info["filename"]
                is_valid = self._validate_file(file_path, export_name)
                
                validation_results["total_files"] += 1
                if is_valid:
                    validation_results["valid_files"] += 1
                    validation_results["validations"][export_name] = {"status": "valid"}
                else:
                    validation_results["invalid_files"] += 1
                    validation_results["validations"][export_name] = {"status": "invalid"}
                    
            except Exception as e:
                logger.error(f"Erro ao validar {export_name}: {str(e)}")
                validation_results["errors"].append({
                    "export": export_name,
                    "error": str(e)
                })
        
        return validation_results
    
    def _validate_file(self, file_path: Path, export_name: str) -> bool:
        """Valida um arquivo individual"""
        try:
            # Check if file exists
            if not file_path.exists():
                raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")
            
            # Check file size
            file_size = file_path.stat().st_size
            if file_size < self.min_file_size:
                raise ValueError(f"Arquivo muito pequeno: {file_size} bytes")
            
            logger.info(f"Arquivo {export_name}: {file_size} bytes")
            
            # Try to read as Excel
            try:
                df = pd.read_excel(file_path)
                
                # Check if dataframe is empty
                if df.empty:
                    raise ValueError("Planilha vazia")
                
                # Check expected columns
                expected_columns = self._get_expected_columns(export_name)
                if expected_columns:
                    missing_columns = set(expected_columns) - set(df.columns)
                    if missing_columns:
                        raise ValueError(f"Colunas faltantes: {missing_columns}")
                
                logger.info(f"Validação bem-sucedida: {export_name} - {len(df)} registros")
                return True
                
            except Exception as e:
                logger.error(f"Erro ao ler arquivo {export_name}: {str(e)}")
                raise
                
        except Exception as e:
            logger.error(f"Validação falhou para {export_name}: {str(e)}")
            return False
    
    def _get_expected_columns(self, export_name: str) -> list:
        """Retorna colunas esperadas para cada tipo de exportação"""
        columns_map = {
            "pacientes_ativos": ["Nome completo", "Telefone", "Plano", "Indicado por", "Status"],
            "pacientes_inativos": ["Nome completo", "Telefone", "Plano", "Status"],
            "orcamentos_pendentes": ["Paciente", "Status", "Procedimento", "Profissional", "Valor Venda"],
            "orcamentos_pagos": ["Paciente", "Status", "Procedimento", "Profissional", "Valor Venda"],
            "orcamentos_aprovados": ["Paciente", "Status", "Procedimento", "Profissional", "Valor Venda"],
            "orcamentos_reprovados": ["Paciente", "Tratamentos Recusados", "Valor Total", "Status"],
            "retornos_pendentes": ["Data do retorno", "Paciente", "Tratamento"],
            "faturamento": ["Data", "Paciente", "Descrição", "Tipo", "Valor"],
            "insumos": ["Profissional", "Descrição Insumo", "Preço de Venda", "Qtd. Usada"],
            "chat_crm_leads": ["Status da oportunidade", "Valor das oportunidades"],
            "clairis_bi": ["Taxa de Agendamento", "Taxa de Conversão de Orçamentos"]
        }
        
        return columns_map.get(export_name, [])
