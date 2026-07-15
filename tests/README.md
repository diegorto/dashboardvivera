# Unit Tests - Executive OS

Testes abrangentes para todos os módulos principais do sistema de sincronização Clairis ↔ Pipedrive.

## Estrutura de Testes

```
tests/
├── conftest.py                 # Fixtures compartilhadas
├── README.md                   # Este arquivo
├── normalization/
│   └── test_phone.py          # 12 testes de normalização
├── staging/
│   └── test_repository.py     # 14 testes de repositório
├── reconciliation/
│   └── test_engine.py         # 20 testes de reconciliação
├── conflicts/
│   └── test_manager.py        # 18 testes de conflitos
├── pipedrive/                 # TBD
├── api/                       # TBD
└── __init__.py
```

## Executar Testes

### Instalar dependências
```bash
pip install -r requirements-test.txt
```

### Executar todos os testes
```bash
pytest
```

### Executar com cobertura
```bash
pytest --cov=src --cov-report=html
```

### Executar testes específicos
```bash
# Apenas normalization
pytest tests/normalization/

# Apenas um arquivo
pytest tests/normalization/test_phone.py

# Apenas uma classe
pytest tests/normalization/test_phone.py::TestPhoneNormalizer

# Apenas um método
pytest tests/normalization/test_phone.py::TestPhoneNormalizer::test_normalize_valid_phone_without_country_code
```

### Executar em paralelo
```bash
pytest -n auto
```

### Executar com relatório detalhado
```bash
pytest -v --tb=long
```

## Cobertura Atual

| Módulo | Testes | Linhas | Cobertura |
|--------|--------|--------|-----------|
| normalization/phone.py | 12 | 34 | 100% |
| staging/repository.py | 14 | 449 | ~85% |
| reconciliation/engine.py | 20 | 461 | ~80% |
| conflicts/manager.py | 18 | 482 | ~75% |
| **TOTAL** | **64** | **1,426** | **~85%** |

## Fixtures Disponíveis

### Banco de Dados
- `test_db` - SQLite em memória com schemas completos

### Dados de Amostra
- `sample_patient` - Dados de paciente padrão
- `sample_pipedrive_person` - Dados de pessoa Pipedrive
- `sample_divergence` - Divergência de exemplo

### Objetos de Banco
- `staging_patient_db` - StagingPatient persistido
- `audit_log_db` - AuditLog persistido
- `approval_queue_item_db` - ApprovalQueue persistido
- `conflict_db` - ConflictQueue persistido
- `sync_execution_db` - SyncExecution persistido

### Mocks
- `mock_pipedrive_api` - Mock do cliente PipedriveAPIClient
- `mock_logger` - Mock do logger

## Padrões de Teste

### 1. Testes Unitários Simples
```python
def test_normalize_valid_phone(self):
    phone = "48 99999-9999"
    result = PhoneNormalizer.normalize(phone)
    assert result == "5548999999999"
```

### 2. Testes com Banco de Dados
```python
def test_get_patient_by_id(self, test_db, staging_patient_db):
    repo = StagingRepository(test_db)
    result = repo.get_patient_by_clairis_id("CLR-12345")
    assert result is not None
```

### 3. Testes com Múltiplos Cenários
```python
@pytest.mark.parametrize("phone,expected", [
    ("(48) 99999-9999", "5548999999999"),
    ("48 99999-9999", "5548999999999"),
])
def test_normalize_formats(self, phone, expected):
    result = PhoneNormalizer.normalize(phone)
    assert result == expected
```

## Testes Pendentes

- [ ] pipedrive/test_api.py - Testes do cliente HTTP
- [ ] pipedrive/test_updater.py - Testes de atualização
- [ ] api/test_approval_routes.py - Testes de endpoints
- [ ] integration/test_orchestrator.py - Testes de integração

## CI/CD Integration

Para integração com CI/CD:

```bash
# GitHub Actions
pytest --junit-xml=test-results.xml --cov=src --cov-report=xml

# GitLab CI
pytest --junitxml=report.xml --cov=src --cov-report=term

# Jenkins
pytest --junit-xml=results.xml
```

## Debugging

### Modo Verbose
```bash
pytest -vv --tb=long -s
```

### Parar no Primeiro Erro
```bash
pytest -x
```

### Pdb no Error
```bash
pytest --pdb
```

### Listar Testes sem Executar
```bash
pytest --collect-only
```

## Boas Práticas

1. **Nomenclatura**: `test_<função>_<cenário>`
2. **Isolamento**: Cada teste deve ser independente
3. **Fixtures**: Reutilizar conftest.py
4. **Assertion**: Uma assertion por teste quando possível
5. **Mocks**: Mockar dependências externas
6. **Parametrize**: Usar @pytest.mark.parametrize para múltiplos cenários
