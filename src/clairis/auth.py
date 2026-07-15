from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from src.core.config import settings
from src.core.logger import setup_logger
from datetime import datetime
import asyncio

logger = setup_logger(__name__)

class ClairisAuth:
    def __init__(self):
        self.settings = settings
        self.browser: Browser = None
        self.context: BrowserContext = None
        self.page: Page = None
        
    async def connect(self) -> Page:
        try:
            logger.info("Iniciando conexão com Clairis...")
            playwright = await async_playwright().start()
            
            self.browser = await playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context()
            self.page = await self.context.new_page()
            
            # Navigate to login page
            await self.page.goto(f"{self.settings.CLAIRIS_URL}/")
            logger.info("Página de login carregada")
            
            # Perform login
            await self._perform_login()
            
            logger.info("Autenticação bem-sucedida no Clairis")
            return self.page
            
        except Exception as e:
            logger.error(f"Erro ao conectar no Clairis: {str(e)}")
            raise
    
    async def _perform_login(self):
        try:
            # Wait for email input and fill it
            await self.page.wait_for_selector('input[type="email"]', timeout=10000)
            await self.page.fill('input[type="email"]', self.settings.CLAIRIS_EMAIL)
            logger.info(f"Email preenchido: {self.settings.CLAIRIS_EMAIL}")
            
            # Wait for password input and fill it
            await self.page.wait_for_selector('input[type="password"]', timeout=10000)
            await self.page.fill('input[type="password"]', self.settings.CLAIRIS_PASSWORD)
            logger.info("Senha preenchida")
            
            # Click login button
            login_button = await self.page.query_selector('button[type="submit"]')
            if login_button:
                await login_button.click()
                logger.info("Botão de login clicado")
            
            # Wait for navigation to complete
            await self.page.wait_for_load_state("networkidle", timeout=30000)
            
            # Verify login success
            current_url = self.page.url
            if "/start/" in current_url or "/home/" in current_url:
                logger.info("Login realizado com sucesso")
            else:
                raise Exception(f"Login falhou. URL atual: {current_url}")
                
        except Exception as e:
            logger.error(f"Erro durante login: {str(e)}")
            # Save screenshot for debugging
            await self._save_error_screenshot("login_error")
            raise
    
    async def _save_error_screenshot(self, name: str):
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = f"logs/{name}_{timestamp}.png"
            await self.page.screenshot(path=screenshot_path)
            logger.info(f"Screenshot salvo: {screenshot_path}")
        except Exception as e:
            logger.error(f"Erro ao salvar screenshot: {str(e)}")
    
    async def disconnect(self):
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            logger.info("Conexão com Clairis encerrada")
        except Exception as e:
            logger.error(f"Erro ao desconectar: {str(e)}")
