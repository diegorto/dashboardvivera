from playwright.async_api import Page, Download
from src.core.logger import setup_logger
from pathlib import Path
from datetime import datetime
import asyncio

logger = setup_logger(__name__)

class ClairisExporter:
    def __init__(self, page: Page):
        self.page = page
        self.export_dir = Path("data/exports")
        self.export_dir.mkdir(parents=True, exist_ok=True)
        self.date_str = datetime.now().strftime("%Y%m%d")
        
    async def export_all(self) -> dict:
        """Exporta todas as planilhas mapeadas do Clairis"""
        results = {
            "timestamp": datetime.now().isoformat(),
            "exports": {},
            "errors": []
        }
        
        exports_config = self._get_exports_config()
        
        for export_name, config in exports_config.items():
            try:
                logger.info(f"Iniciando exportação: {export_name}")
                await self._navigate_and_export(config)
                results["exports"][export_name] = {
                    "status": "success",
                    "url": config["url"],
                    "filename": config["filename"]
                }
                logger.info(f"Exportação concluída: {export_name}")
            except Exception as e:
                logger.error(f"Erro ao exportar {export_name}: {str(e)}")
                results["errors"].append({
                    "export": export_name,
                    "error": str(e)
                })
        
        return results
    
    async def _navigate_and_export(self, config: dict):
        """Navega até a URL e exporta a planilha"""
        try:
            # Navigate to the export URL
            await self.page.goto(config["url"], wait_until="networkidle")
            logger.info(f"Navegado para: {config['url']}")
            
            # Apply filters if configured
            if "filters" in config:
                await self._apply_filters(config["filters"])
            
            # Click export button and wait for download
            export_button_selector = config.get("export_button_selector", 'button:has-text("EXPORTAR")')
            
            async with self.page.expect_download() as download_info:
                await self.page.click(export_button_selector)
            
            download = await download_info.value
            
            # Save the file
            file_path = self.export_dir / config["filename"]
            await download.save_as(file_path)
            
            logger.info(f"Arquivo salvo: {file_path}")
            
        except Exception as e:
            logger.error(f"Erro ao exportar: {str(e)}")
            await self._save_error_screenshot(f"export_error_{config['name']}")
            raise
    
    async def _apply_filters(self, filters: list):
        """Aplica filtros conforme configurado"""
        for filter_config in filters:
            try:
                selector = filter_config["selector"]
                value = filter_config["value"]
                
                await self.page.wait_for_selector(selector)
                await self.page.select_option(selector, value)
                await self.page.wait_for_load_state("networkidle")
                
                logger.info(f"Filtro aplicado: {filter_config['name']} = {value}")
            except Exception as e:
                logger.warning(f"Erro ao aplicar filtro: {str(e)}")
    
    async def _save_error_screenshot(self, name: str):
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = f"logs/{name}_{timestamp}.png"
            await self.page.screenshot(path=screenshot_path)
            logger.info(f"Screenshot de erro salvo: {screenshot_path}")
        except Exception as e:
            logger.error(f"Erro ao salvar screenshot: {str(e)}")
    
    def _get_exports_config(self) -> dict:
        """Retorna configuração de todas as exportações"""
        return {
            "pacientes_ativos": {
                "name": "Pacientes Ativos",
                "url": f"{self.settings.CLAIRIS_URL}patient/list/",
                "filename": f"clairis_pacientes_ativos_{self.date_str}.xlsx",
                "export_button_selector": 'button:has-text("EXPORTAR")'
            },
            "pacientes_inativos": {
                "name": "Pacientes Inativos",
                "url": f"{self.settings.CLAIRIS_URL}patient/list/",
                "filename": f"clairis_pacientes_inativos_{self.date_str}.xlsx",
                "filters": [{"name": "Tab", "selector": 'a:has-text("PACIENTES INATIVOS")', "value": ""}]
            },
            "orcamentos_pendentes": {
                "name": "Orçamentos Pendentes",
                "url": f"{self.settings.CLAIRIS_URL}general-budgets/",
                "filename": f"clairis_orcamentos_pendentes_{self.date_str}.xlsx",
                "filters": [{"name": "Tab", "selector": 'a:has-text("PENDENTES")', "value": ""}]
            },
            "orcamentos_pagos": {
                "name": "Orçamentos Pagos",
                "url": f"{self.settings.CLAIRIS_URL}general-budgets/",
                "filename": f"clairis_orcamentos_pagos_{self.date_str}.xlsx",
                "filters": [{"name": "Tab", "selector": 'a:has-text("PAGOS")', "value": ""}]
            },
            "orcamentos_aprovados": {
                "name": "Orçamentos Aprovados",
                "url": f"{self.settings.CLAIRIS_URL}general-budgets/",
                "filename": f"clairis_orcamentos_aprovados_{self.date_str}.xlsx",
                "filters": [{"name": "Tab", "selector": 'a:has-text("APROVADOS")', "value": ""}]
            },
            "orcamentos_reprovados": {
                "name": "Orçamentos Reprovados",
                "url": f"{self.settings.CLAIRIS_URL}rejected-budgets/",
                "filename": f"clairis_orcamentos_reprovados_{self.date_str}.xlsx"
            },
            "retornos_pendentes": {
                "name": "Retornos Pendentes",
                "url": f"{self.settings.CLAIRIS_URL}retornos/",
                "filename": f"clairis_retornos_pendentes_{self.date_str}.xlsx"
            },
            "faturamento": {
                "name": "Faturamento",
                "url": f"{self.settings.CLAIRIS_URL}billing/",
                "filename": f"clairis_faturamento_{self.date_str}.xlsx"
            },
            "insumos": {
                "name": "Insumos",
                "url": f"{self.settings.CLAIRIS_URL}supplies/",
                "filename": f"clairis_insumos_{self.date_str}.xlsx"
            },
            "chat_crm_leads": {
                "name": "Chat CRM Leads",
                "url": f"{self.settings.CLAIRIS_URL}chat/painel-analyctics/",
                "filename": f"clairis_crm_leads_{self.date_str}.xlsx"
            },
            "clairis_bi": {
                "name": "Clairis B.I",
                "url": f"{self.settings.CLAIRIS_URL}clairis-bi/",
                "filename": f"clairis_bi_{self.date_str}.xlsx"
            }
        }
