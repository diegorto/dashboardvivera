#!/usr/bin/env python3
"""
Upload automático para Hostinger - Versão não-interativa
"""

import sys
import os
import paramiko

print("\n" + "="*70)
print("🚀 UPLOAD AUTOMÁTICO - VIVERA ORAL-FACIAL CRC")
print("="*70 + "\n")

# Configurações
HOST = "sftp.seudominio.com.br"
USERNAME = "diegorto"
LOCAL_FILE = "/home/user/dashboardvivera/dashboard.html"
REMOTE_PATH = "/public_html/crc/"
REMOTE_FILE = REMOTE_PATH + "dashboard.html"

# Pegar senha de argumento ou variável de ambiente
if len(sys.argv) > 1:
    PASSWORD = sys.argv[1]
elif 'SFTP_PASSWORD' in os.environ:
    PASSWORD = os.environ['SFTP_PASSWORD']
else:
    print("❌ Erro: Senha não fornecida!")
    print("\nUso:")
    print("  python3 upload_auto.py sua_senha")
    print("  ou")
    print("  SFTP_PASSWORD=sua_senha python3 upload_auto.py")
    sys.exit(1)

# Verificar arquivo local
if not os.path.exists(LOCAL_FILE):
    print(f"❌ Erro: Arquivo {LOCAL_FILE} não encontrado!")
    sys.exit(1)

file_size = os.path.getsize(LOCAL_FILE) / 1024
print(f"📂 Arquivo local: {LOCAL_FILE}")
print(f"   Tamanho: {file_size:.2f} KB")
print(f"\n📍 Destino: {HOST}{REMOTE_FILE}")
print(f"👤 Usuário: {USERNAME}\n")

print("="*70)
print("Conectando...")
print("="*70 + "\n")

try:
    # Conectar
    transport = paramiko.Transport((HOST, 22))
    transport.connect(username=USERNAME, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    print("✅ Conectado com sucesso ao SFTP!\n")

    # Criar diretório se não existir
    try:
        sftp.stat(REMOTE_PATH)
        print(f"📁 Diretório já existe: {REMOTE_PATH}")
    except IOError:
        print(f"📁 Criando diretório: {REMOTE_PATH}")
        sftp.mkdir(REMOTE_PATH)

    # Fazer upload com barra de progresso
    print(f"\n📤 Enviando arquivo...")
    print(f"   De: {LOCAL_FILE}")
    print(f"   Para: {REMOTE_FILE}\n")

    def progress(transferred, total):
        percent = (transferred / total) * 100
        bar_length = 50
        filled = int(bar_length * transferred / total)
        bar = '█' * filled + '░' * (bar_length - filled)
        print(f'\r   [{bar}] {percent:.1f}% ({transferred}/{total} bytes)', end='', flush=True)

    sftp.put(LOCAL_FILE, REMOTE_FILE, callback=progress)
    print("\n")

    # Verificar upload
    remote_stat = sftp.stat(REMOTE_FILE)
    print(f"✅ Upload concluído com sucesso!")
    print(f"   Arquivo remoto: {REMOTE_FILE}")
    print(f"   Tamanho: {remote_stat.st_size / 1024:.2f} KB\n")

    # Definir permissões
    try:
        sftp.chmod(REMOTE_FILE, 0o644)
        print(f"🔐 Permissões definidas: 644\n")
    except:
        print(f"⚠️  Não foi possível definir permissões (pode estar ok)\n")

    sftp.close()
    transport.close()

    # Resultado final
    print("="*70)
    print("🎉 DEPLOY COMPLETO!")
    print("="*70)
    print(f"\n🌐 Seu dashboard está disponível em:")
    print(f"   https://viveraorfacial.com.br/crc/dashboard.html\n")
    print("="*70 + "\n")

except paramiko.AuthenticationException:
    print("❌ Erro: Credenciais inválidas!")
    print("   Verifique usuário e senha\n")
    sys.exit(1)
except paramiko.SSHException as e:
    print(f"❌ Erro de conexão SSH: {e}\n")
    sys.exit(1)
except Exception as e:
    print(f"❌ Erro: {e}\n")
    sys.exit(1)
