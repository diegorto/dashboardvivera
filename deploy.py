#!/usr/bin/env python3
"""
Deploy Dashboard para Hostinger via SFTP
Script pronto para executar no terminal
"""

import os
import sys
import getpass
import paramiko
from pathlib import Path

def print_header():
    print("\n" + "="*60)
    print("🚀 DEPLOY DASHBOARD - VIVERA ORAL-FACIAL")
    print("="*60 + "\n")

def get_credentials():
    """Coleta credenciais do usuário de forma segura"""
    print("📝 Credenciais Hostinger (encontre no painel de controle)")
    print("-" * 60)

    host = input("Host SFTP (ex: sftp.seudominio.com.br): ").strip()
    username = input("Usuário FTP: ").strip()
    password = getpass.getpass("Senha FTP (não será exibida): ")

    print()
    return host, username, password

def get_paths():
    """Define os caminhos local e remoto"""
    local_file = Path(__file__).parent / "dashboard.html"

    if not local_file.exists():
        print(f"❌ Erro: Arquivo {local_file} não encontrado!")
        sys.exit(1)

    print(f"📂 Arquivo local: {local_file}")
    print(f"   Tamanho: {local_file.stat().st_size / 1024:.2f} KB")

    remote_path = input("\n📂 Caminho remoto (ex: /public_html/crc/): ").strip()
    if not remote_path.endswith('/'):
        remote_path += '/'

    return str(local_file), remote_path

def test_connection(host, username, password):
    """Testa conexão SFTP"""
    print("\n🔗 Testando conexão SFTP...")

    try:
        transport = paramiko.Transport((host, 22))
        transport.connect(username=username, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)

        print("✅ Conexão SFTP estabelecida com sucesso!")
        return sftp, transport

    except paramiko.AuthenticationException:
        print("❌ Erro: Credenciais inválidas!")
        sys.exit(1)
    except paramiko.SSHException as e:
        print(f"❌ Erro de conexão SSH: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Erro: {e}")
        sys.exit(1)

def upload_file(sftp, local_file, remote_path):
    """Faz upload do arquivo"""
    remote_file = remote_path + "dashboard.html"

    print(f"\n📤 Enviando arquivo...")
    print(f"   De: {local_file}")
    print(f"   Para: {remote_file}")

    try:
        # Cria diretório remoto se não existir
        try:
            sftp.stat(remote_path)
        except IOError:
            print(f"📁 Criando diretório: {remote_path}")
            sftp.mkdir(remote_path)

        # Faz upload com callback de progresso
        def progress_callback(transferred, total):
            percent = (transferred / total) * 100
            bar_length = 40
            filled = int(bar_length * transferred / total)
            bar = '█' * filled + '░' * (bar_length - filled)
            sys.stdout.write(f'\r   [{bar}] {percent:.1f}%')
            sys.stdout.flush()

        sftp.put(local_file, remote_file, callback=progress_callback)
        print()  # Nova linha após progresso

        # Verifica se arquivo foi enviado
        remote_stat = sftp.stat(remote_file)
        print(f"\n✅ Upload concluído com sucesso!")
        print(f"   Arquivo remoto: {remote_file}")
        print(f"   Tamanho: {remote_stat.st_size / 1024:.2f} KB")

        return remote_file

    except Exception as e:
        print(f"\n❌ Erro no upload: {e}")
        sys.exit(1)

def set_permissions(sftp, remote_file):
    """Define permissões do arquivo (644)"""
    try:
        sftp.chmod(remote_file, 0o644)
        print(f"🔐 Permissões definidas: 644")
    except Exception as e:
        print(f"⚠️  Não foi possível definir permissões: {e}")

def main():
    print_header()

    # Verifica dependências
    try:
        import paramiko
    except ImportError:
        print("❌ Erro: paramiko não instalado!")
        print("\nInstale com: pip install paramiko")
        sys.exit(1)

    # Coleta informações
    host, username, password = get_credentials()
    local_file, remote_path = get_paths()

    # Confirmação
    print("\n" + "="*60)
    print("📋 Resumo do Deploy:")
    print("="*60)
    print(f"Host: {host}")
    print(f"Usuário: {username}")
    print(f"Arquivo local: {local_file}")
    print(f"Diretório remoto: {remote_path}")
    print("="*60)

    confirm = input("\n✅ Deseja continuar? (s/n): ").strip().lower()
    if confirm != 's':
        print("❌ Deploy cancelado!")
        sys.exit(0)

    # Conecta e faz upload
    sftp, transport = test_connection(host, username, password)

    try:
        remote_file = upload_file(sftp, local_file, remote_path)
        set_permissions(sftp, remote_file)

        # URL final
        print("\n" + "="*60)
        print("🎉 DEPLOY COMPLETO!")
        print("="*60)
        domain = input("Digite seu domínio (ex: viveraorfacial.com.br): ").strip()
        url = f"https://{domain}/crc/dashboard.html"
        print(f"\n🌐 URL do Dashboard: {url}")
        print("="*60)

    finally:
        sftp.close()
        transport.close()

if __name__ == "__main__":
    main()
