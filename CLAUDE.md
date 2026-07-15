# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🏗️ System Architecture: 11-Layer Data Synchronization Pipeline

The Executive OS is an autonomous agent that synchronizes patient and business data from **Clairis** (dental clinic management) to **Pipedrive** (CRM) with mandatory approval gates and complete audit trails. Data flows through 11 distinct layers, each with specific responsibilities:

### Layer Architecture

```
1. CLAIRIS EXPORT
   └─→ Playwright browser automation exports 11 Excel files from Clairis
   └─→ Files: Patients, Budgets, Appointments, Payments, etc.

2. STAGING IMPORT
   └─→ Parse Excel files → SQLite temporary database
   └─→ StagingPatient, StagingBudget, StagingAppointment tables
   └─→ Source-of-truth for raw incoming data

3. NORMALIZATION
   └─→ Standardize phone (→ 55XXXXXXXXXX), CPF, dates, names
   └─→ PhoneNormalizer, CPFValidator, DateParser, NameNormalizer
   └─→ Removes formatting inconsistencies across systems

4. COMPARISON
   └─→ Match Clairis records with existing Pipedrive records
   └─→ 6-priority strategy: ID → Phone → CPF → Email → Name+DOB → Fuzzy
   └─→ Identifies new vs. existing customers

5. RECONCILIATION
   └─→ Field-by-field divergence analysis (phone, email, name, etc.)
   └─→ ReconciliationEngine assigns severity (CRITICAL/HIGH/MEDIUM/LOW)
   └─→ Calculates confidence scores (weighted by field importance)
   └─→ Generates recommendations (SYNC/MANUAL_REVIEW/CONFLICT)

6. CONFLICT DETECTION & AUDIT LOGGING
   └─→ Create immutable audit logs with SHA256 checksums
   └─→ ConflictQueue for divergences exceeding thresholds
   └─→ 4 resolution strategies: CLAIRIS_WINS, PIPEDRIVE_WINS, MANUAL, REJECT

7. APPROVAL QUEUE
   └─→ Web interface for human review of proposed changes
   └─→ ApprovalQueue tracks status (PENDING → APPROVED/REJECTED/CORRECTED)
   └─→ FastAPI REST endpoints: GET/POST queue, approve/reject/correct items

8. CRM UPDATE (Pipedrive)
   └─→ Only after explicit approval, update CRM via Pipedrive API
   └─→ PipedriveAPIClient: 2 req/sec rate limiter + exponential backoff
   └─→ Whitelist-enforced updates (ALLOWED_PERSON_FIELDS, ALLOWED_DEAL_FIELDS)
   └─→ Atomic transactions with full rollback on failure

9. EXECUTIVE OS DATABASE
   └─→ Main production database (PostgreSQL)
   └─→ 10 models: Patient, ClairisSnapshot, PipedriveSnapshot, SyncEvent, etc.
   └─→ Versioning with checksums for data integrity

10. KPI CALCULATION & PATIENT JOURNEY
    └─→ Calculate success rates, sync duration, error counts
    └─→ PatientJourney: track appointment → budget → payment flow
    └─→ Automatic delinquency detection and CRC alerts

11. DASHBOARDS & AI INSIGHTS
    └─→ Grafana dashboards (Prometheus metrics)
    └─→ AI analysis of patterns (referral sources, treatment outcomes)
    └─→ Anomaly detection on sync failures

```

### Data Flow Timing (Daily at 02:00)

- **02:00-02:05**: Clairis login via Playwright + 11 Excel exports
- **02:05-02:20**: Structure validation + format detection
- **02:20-02:30**: Parse into StagingPatient/Budget/Appointment (SQLite)
- **02:30-02:40**: Normalize phone/CPF/dates/names
- **02:40-02:50**: Compare staging vs. Pipedrive (matching)
- **02:50-03:10**: Field-by-field reconciliation + severity scoring
- **03:10-03:20**: Create AuditLog entries + ConflictQueue for disputes
- **03:20**: Human approval gate opens (web interface)
- **~Human reviews**: Approve/reject/correct each change
- **After approval**: Update Pipedrive API (transactional)
- **Post-sync**: Sync to Executive OS database + calculate KPIs
- **Final**: Update dashboards + generate AI insights

---

## 📦 Key Components & Their Responsibilities

### **src/clairis/** — Clairis Export
- `exporter.py`: Playwright automation to navigate Clairis, export 11 Excel files
- `auth.py`: Login handling with email/password from environment
- `validator.py`: Verify Excel structure (headers, row counts, date formats)

**Key Classes**: `ClairisExporter`, `ClairisAuth`, `ClairisValidator`

### **src/staging/** — Temporary Database
- `repository.py`: Centralized ORM queries (get_all_patients, get_by_phone, etc.)
- Models: `StagingPatient`, `StagingBudget`, `StagingAppointment`

**Pattern**: All data access through StagingRepository to isolate database logic

### **src/normalization/** — Data Standardization
- `phone.py`: Strip formatting, add country code (55) → `5548999999999`
- `cpf.py`: Remove dots/dashes → `12345678900`
- `date.py`: Parse multiple formats → ISO 8601 datetime
- `name.py`: Titlecase, remove extra spaces
- `engine.py`: Orchestrate all normalizers

**Key Classes**: `PhoneNormalizer`, `CPFValidator`, `DateParser`, `NameNormalizer`

### **src/reconciliation/** — Divergence Analysis
- `engine.py`: Compare staging vs. Pipedrive field-by-field
- Severity levels: CRITICAL (phone/cpf/email), HIGH (name/birth_date), MEDIUM (status), LOW (other)
- Confidence scoring: weighted by FIELD_WEIGHTS dictionary
- Recommendations: sync if confidence ≥80%, manual review if conflicts

**Key Classes**: `ReconciliationEngine`, `FieldDivergence`, `ReconciliationReport`

### **src/conflicts/** — Conflict Resolution
- `manager.py`: Manage quarantined conflicts with 4 strategies
- Auto-select values for CLAIRIS_WINS (use Clairis value) or PIPEDRIVE_WINS (use Pipedrive)
- Bulk operations, statistics, audit trails

**Key Classes**: `ConflictQueueManager`

### **src/pipedrive/** — CRM Integration
- `api.py`: HTTP client with RateLimiter (2 req/sec), exponential backoff retry (1s/2s/4s)
- Handles Pipedrive API responses: 200/201 (success), 404 (not found), 429 (rate limit), 500 (retry)
- `updater.py`: Safe update operations with validation + whitelist enforcement
- Validates person (name ≥2 chars, email format, phone digits) and deal data (title ≥3 chars, value numeric)

**Key Classes**: `PipedriveAPIClient`, `RateLimiter`, `PipedriveUpdater`

### **src/api/** — REST Approval Interface
- `main.py`: FastAPI server (0.0.0.0:8000)
- `approval_routes.py`: 8 endpoints (list/get/approve/reject/correct queue items, bulk approve, stats, batch summary)
- Pydantic models for request/response validation

**Key Classes**: `FastAPI` app with router for approval queue

### **src/executive_os/** — Main Database
- `database.py`: 10 SQLAlchemy models with composite indexes
- Patient, ClairisPatientSnapshot, PipedrivePeopleSnapshot, SyncEvent, AuditLogArchive, etc.
- `sync.py`: ExecutiveOSSyncEngine coordinates patient sync, snapshot creation, audit archival

**Key Classes**: `ExecutiveOSSyncEngine`

### **src/models.py** — Staging Database
- AuditLog (batch_id, entity_type, field_name, old/new value, status, confidence_level)
- ApprovalQueue (batch_id, status, assigned_to, action, notes)
- SyncExecution (batch_id, status, files_exported, records_imported, errors)

**Important**: Use `meta_data` column (not `metadata` — reserved in SQLAlchemy)

### **src/orchestrator.py** — Main Orchestrator
- `SyncOrchestrator`: Coordinates all 11 layers
- 12 `_step_*` methods for each layer + overall flow

---

## 🛠️ Common Development Commands

### Setup & Dependencies
```bash
# Install all dependencies (main + test)
pip install -r requirements.txt -r requirements-test.txt

# Quick dependency check
pip list | grep -E "sqlalchemy|httpx|pytest|fastapi"
```

### Testing
```bash
# Run all 147 tests (~9 seconds)
pytest tests/

# Run specific test module
pytest tests/pipedrive/test_api.py
pytest tests/pipedrive/test_updater.py
pytest tests/staging/test_repository.py

# Run single test
pytest tests/reconciliation/test_engine.py::TestReconciliationEngine::test_normalize_value_phone -v

# Run with coverage report
pytest tests/ --cov=src --cov-report=html

# Run tests matching pattern
pytest -k "person" -v

# Run with output showing print statements
pytest -s
```

### Code Quality
```bash
# Format code
black src/ tests/

# Check formatting without changing
black --check src/

# Lint (flake8)
flake8 src/ tests/
```

### Database & Migrations
```bash
# Initialize database from migrations/
psql -U executive_os -d executive_os -f migrations/init.sql

# Check current database state
psql -U executive_os -d executive_os -c "\dt"
```

### Local Development
```bash
# Run orchestrator once (manual sync)
python -m src.main

# Start FastAPI server for approval queue
python -m uvicorn src.api.main:app --reload

# Check environment variables
env | grep -E "CLAIRIS|PIPEDRIVE|DATABASE"
```

### Docker
```bash
# Build and run all services
docker-compose up -d

# View agent logs in real-time
docker-compose logs -f agent

# Execute command in running container
docker-compose exec agent pytest tests/

# Rebuild after code changes
docker-compose up -d --build
```

---

## 📐 Key Architectural Patterns

### **Async/Await Pattern**
The system uses Python `asyncio` for concurrent operations:
- `PipedriveAPIClient` uses `httpx.AsyncClient`
- `PipedriveUpdater.update_person_safe()` is async
- `ExecutiveOSSyncEngine.sync_patients()` processes multiple patients concurrently
- Tests use `@pytest.mark.asyncio` decorator

**Example**:
```python
async def update_person_safe(self, person_id, clairis_data, pipedrive_data, api_client):
    differences = self._detect_differences(clairis_data, pipedrive_data)
    # Extract new values from tuples BEFORE validation
    update_values = {k: v[1] if isinstance(v, tuple) else v for k, v in update_data.items()}
    is_valid, msg = self._validate_person_data(update_values)
    if is_valid:
        success = await api_client.update_person(person_id, update_values)
```

### **Difference Detection as Tuples**
`_detect_differences()` returns differences as `{field: (old_value, new_value)}` tuples. Before validation/API calls, extract the new value (second element of tuple):

```python
# This is what _detect_differences returns:
differences = {"name": ("Jose Silva", "João Silva"), "phone": ("5548988888888", "5548999999999")}

# Extract new values before using:
update_values = {k: v[1] if isinstance(v, tuple) else v for k, v in differences.items()}
# Now: {"name": "João Silva", "phone": "5548999999999"}
```

### **Whitelist Enforcement**
All Pipedrive updates are validated against whitelists:
- `ALLOWED_PERSON_FIELDS`: name, email, phone, org_id, owner_id, label, notes, first_name, last_name, visible_to
- `ALLOWED_DEAL_FIELDS`: title, value, currency, user_id, person_id, org_id, stage_id, status, probability, expected_close_date, etc.

**Pattern**: Never pass user input directly to API; always filter through whitelist first.

### **Rate Limiting with Exponential Backoff**
```python
class RateLimiter:
    def __init__(self, requests_per_second=2):
        self.min_interval = 1 / requests_per_second  # 0.5 seconds for 2 req/sec
    
    async def wait(self):
        # Enforces minimum interval between requests
```

Retry logic on 429/500 errors with delays: 1s → 2s → 4s

### **Audit Trail Immutability**
Every change creates an `AuditLog` entry with:
- `batch_id`: Which sync run this belongs to
- `entity_type`: "person", "budget", "deal"
- `field_name`: The specific field changed
- `old_value`, `new_value`: Before/after values
- `status`: AuditLogStatus.IMPORTED (from Clairis) or .UPDATED (approved change)
- `confidence_level`: 95.0 for updates, 100.0 for inserts

**Never modified or deleted** — audit trail is permanent.

### **Test Fixtures & Isolation**
All tests use `test_db` fixture (SQLite in-memory) with fresh schema for each test:

```python
@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    ExecutiveOSBase.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()
```

**Important**: `sample_patient` fixture has no hardcoded `id` to allow auto-increment across tests.

---

## 🔑 Critical Files & When to Modify Them

| File | When to Modify | Example |
|------|---|---|
| `src/models.py` | Add new staging table (new export from Clairis) | Add `StagingInvoice` model for invoices |
| `src/executive_os/database.py` | Add new executive OS model or index | Add `CompetitorTracking` model |
| `src/pipedrive/api.py` | Change API endpoint, auth, or rate limit | Support Pipedrive custom fields |
| `src/pipedrive/updater.py` | Add/remove allowed fields, validation rules | Add "custom_field_123" to ALLOWED_PERSON_FIELDS |
| `src/normalization/*.py` | Adjust normalization rules | Change CPF format from 11 to 14 digits |
| `src/reconciliation/engine.py` | Adjust field weights, thresholds, or recommendations | Increase confidence_level threshold from 80% to 85% |
| `src/conflicts/manager.py` | Change resolution strategies or bulk operations | Add new strategy "MERGE_VALUES" |
| `tests/conftest.py` | Add new fixture or change database setup | Add `sample_budget` fixture |
| `requirements.txt` | Add new dependency | Add new library for fuzzy matching |

---

## 🧪 Testing Strategy & Coverage

**Current Status**: 147 tests, 8 modules, ~90% coverage

### Test Organization
- **Unit Tests**: Test individual functions in isolation (phone normalization, validation, difference detection)
- **Integration Tests**: Test data flow through multiple layers (reconciliation + conflict + approval)
- **Database Tests**: Test ORM queries and constraints (test_db fixture with SQLite in-memory)

### Module Coverage
- `pipedrive/test_api.py`: 20 tests for HTTP client, rate limiter, retry logic
- `pipedrive/test_updater.py`: 24 tests for safe updates, validation, whitelist enforcement
- `staging/test_repository.py`: 14 tests for all CRUD queries
- `reconciliation/test_engine.py`: 22 tests for divergence analysis and recommendations
- `conflicts/test_manager.py`: 21 tests for resolution strategies and statistics
- `normalization/test_phone.py`: 17 tests for phone normalization edge cases
- `api/test_approval_routes.py`: 18 tests for approval queue model operations
- `integration/test_orchestrator.py`: 11 tests for sync flow and data integrity

### Running Tests Efficiently
```bash
# Run only fast unit tests (skip integration)
pytest tests/ -m "not integration" --durations=0

# Run tests in parallel (faster)
pytest tests/ -n auto

# Run failing tests first
pytest tests/ --failed-first

# Stop after first failure
pytest tests/ -x
```

---

## 🚨 Common Pitfalls & Solutions

### Issue: UNIQUE constraint failed on staging_patients.id
**Cause**: Multiple tests creating StagingPatient with same id
**Fix**: Don't include `id` in sample_patient fixture; let SQLAlchemy auto-increment

### Issue: "Attribute name 'metadata' is reserved"
**Cause**: SQLAlchemy 2.0+ reserves "metadata" as column name
**Fix**: Use `meta_data` column instead (both AuditLog and AuditLogArchive models)

### Issue: Update fails with "Validação falhou"
**Cause**: Passing difference tuple `(old, new)` instead of new value to validation
**Fix**: Extract value before validation: `v[1] if isinstance(v, tuple) else v`

### Issue: Pipedrive API returns 429 (rate limited)
**Cause**: Making requests faster than 2/sec
**Fix**: RateLimiter enforces min_interval; wait in queue

### Issue: Phone normalization removes leading zero
**Cause**: Brazilian phones have leading 0 in domestic format (e.g., `(48) 9999-9999`)
**Fix**: PhoneNormalizer strips formatting then adds country code 55

### Issue: Test passes locally but fails in CI
**Cause**: Database state shared between tests
**Fix**: Use `test_db` fixture (fresh SQLite per test), not production database

---

## 📊 Data Models Quick Reference

### Staging (src/models.py)
```python
StagingPatient(clairis_id, name, phone, email, cpf, birth_date, status, plan, referred_by)
StagingBudget(clairis_id, patient_id, value, status, created_date)
StagingAppointment(clairis_id, patient_id, scheduled_date, attended, dentist)
AuditLog(batch_id, entity_type, entity_id, field_name, old_value, new_value, status, confidence_level)
ApprovalQueue(batch_id, audit_log_id, status, assigned_to, action, notes)
```

### Executive OS (src/executive_os/database.py)
```python
Patient(clairis_id, pipedrive_id, phone, cpf, email, ...)  # Consolidated
ClairisPatientSnapshot(batch_id, clairis_id, data_json, snapshot_date)  # Versioned
PipedriveSnapshot(batch_id, pipedrive_id, data_json, ...)  # Versioned
SyncEvent(batch_id, status, exported, imported, updated, created, failed)  # Metrics
AuditLogArchive(...)  # Permanent record from staging.AuditLog
```

---

## 🔍 Debugging Tips

### View logs with filtering
```bash
grep "ERROR\|CRITICAL" logs/*.log
grep "batch-123" logs/*.log  # Filter by batch ID
```

### Inspect database state
```bash
# List all tables
psql -U executive_os -d executive_os -c "\dt"

# Query recent sync executions
psql -U executive_os -d executive_os -c "SELECT * FROM sync_execution ORDER BY started_at DESC LIMIT 5;"

# Count records by status
psql -U executive_os -d executive_os -c "SELECT status, COUNT(*) FROM audit_logs GROUP BY status;"
```

### Debug async operations
```python
import asyncio
import logging
logging.basicConfig(level=logging.DEBUG)

# Add to test or script:
async def debug_sync():
    updater = PipedriveUpdater(db, "debug-batch")
    api_client = PipedriveAPIClient(api_token="...")
    success, msg = await updater.update_person_safe(42, clairis_data, pipedrive_data, api_client)
    print(f"Result: {success}, Message: {msg}")

asyncio.run(debug_sync())
```

### Check rate limiter state
```python
limiter = RateLimiter(requests_per_second=2)
print(f"Min interval: {limiter.min_interval}s")
print(f"Requests/sec: {limiter.requests_per_second}")
```

---

## 🚀 Next Steps for Enhancement

1. **Security Hardening**: Add RBAC to REST API, encrypt sensitive fields at rest
2. **CI/CD**: GitHub Actions pipeline with automated testing on every push
3. **Performance**: Redis cache for fuzzy matching results, connection pooling, async batch processing
4. **Monitoring**: Custom Prometheus metrics for sync duration, error rates, approval backlog
5. **Documentation**: Architecture diagrams (11-layer flow), API OpenAPI schema, runbook for operations team

