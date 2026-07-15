# Plan: Dashboard de Auditoria (Governance - First Page)

**Status**: 🔵 **AWAITING APPROVAL**  
**Branch**: `claude/reinice-ren84r`  
**Date**: 2026-07-15

---

## 📋 Overview

Implementation of the **Dashboard de Auditoria** - the first page of the Governance section. This dashboard will display audit KPIs, statistics over time, and high-level governance metrics.

---

## 🎨 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  TopBar (Period Selector, Export, Filters)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ SECTION 1: Audit KPIs (8 Cards, 2 Rows) ─────────────────┐ │
│  │                                                              │ │
│  │  [Card] Total Registros   [Card] Novos      [Card] Modificados  [Card] Deletados   │
│  │  [Card] Conflitos         [Card] Duplicatas [Card] Pendentes    [Card] Aprovados   │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ SECTION 2: Audit Stats Chart (30 Days) ─────────────────┐ │
│  │                                                              │ │
│  │  [Line Chart]                                               │ │
│  │  - Total Batches over time                                  │ │
│  │  - Total Changes (stacked)                                  │ │
│  │  - Legend + Tooltip                                         │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ SECTION 3: Additional Metrics (4 Cards) ─────────────────┐ │
│  │                                                              │ │
│  │  [Card] Taxa Aprovação  [Card] Taxa Conflitos              │ │
│  │  [Card] Sincronizações  [Card] Integridade Dados           │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Model & Endpoints

### Backend Endpoints (Already Implemented ✅)

**Primary Endpoints Used:**
1. `GET /api/governance/audit/kpis`
   - Returns: 14 KPIs (totalRecordsAnalyzed, newRecords, modifiedRecords, deletedRecords, conflictsFound, possibleDuplicates, pendingApprovals, approvedChanges, rejectedChanges, executedSyncs, failedSyncs, avgSyncTime, connectedSources, dataIntegrity, approvalRate)

2. `GET /api/governance/audit/stats?days=30`
   - Returns: Aggregated statistics (totalBatches, totalChanges, avgChangesPerBatch, approvalRate, conflictRate, batchesByStatus)

3. `GET /api/governance/health`
   - Returns: Service health status (optional, for loading verification)

---

## 🧩 Components Used

### Existing Components (No Changes Needed)
- ✅ `KPICard` - For displaying audit metrics
- ✅ `Layout` - Main page wrapper
- ✅ `TopBar` - Period selector and export
- ✅ `LineChart` (Recharts) - For audit trends

### New Components (If Needed)
- ⚠️ **`AuditStatsChart`** - Custom wrapper around LineChart for audit-specific formatting (might create if it needs special styling)
- ⚠️ **`MetricsGrid`** - Reusable grid component for displaying multiple KPI cards (might reuse existing patterns)

**Decision**: Likely use existing components without new ones to follow DRY principle.

---

## 📝 Component Structure

### File: `frontend/src/dashboards/AuditDashboard.tsx`

```typescript
// Key features:
// 1. Load KPIs and stats on mount
// 2. Handle loading/error states
// 3. Format numbers for display (K, M suffix)
// 4. Clickable KPI cards for drill-down (future)
// 5. Export functionality
// 6. Responsive grid layout

const AuditDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  // Fetch data from backend
  // Display KPI cards with drill-down capability
  // Display charts with stats
  // Show metrics grid
}
```

### File: `frontend/src/services/governanceDashboardService.ts` (NEW)

```typescript
// Service methods:
// - getAuditKPIs()
// - getAuditStats(days: number)
// - formatKPIValue(value: number)
// - transformStatsForChart(data)
```

### File: `frontend/src/services/api.ts` (UPDATED)

```typescript
// Add new export:
export const governanceAPI = {
  getAuditKPIs: async () => {...},
  getAuditStats: async (days = 30) => {...},
  getPatientJourney: async (patientId) => {...},
  getConflicts: async () => {...},
  // ... other governance endpoints
};
```

---

## 🎯 KPI Cards (Section 1)

| Card | Label | Backend Field | Format | Drill-Down Target |
|------|-------|----------------|--------|-------------------|
| 1 | Total Registros Analisados | totalRecordsAnalyzed | Number | Audit Items List |
| 2 | Registros Novos | newRecords | Number | Created Items |
| 3 | Registros Modificados | modifiedRecords | Number | Updated Items |
| 4 | Registros Deletados | deletedRecords | Number | Deleted Items |
| 5 | Conflitos Encontrados | conflictsFound | Number | Conflicts Page |
| 6 | Possíveis Duplicatas | possibleDuplicates | Number | Duplicates Page |
| 7 | Pendentes de Aprovação | pendingApprovals | Number | Approval Queue |
| 8 | Aprovações | approvedChanges | Number | Approved Items |

**Additional KPIs (Section 3):**
| 9 | Taxa de Aprovação | approvalRate | Percentage | - |
| 10 | Taxa de Conflitos | - (calculated) | Percentage | - |
| 11 | Sincronizações Executadas | executedSyncs | Number | - |
| 12 | Integridade dos Dados | dataIntegrity | Percentage | - |

---

## 📈 Chart: Audit Stats (Section 2)

**Chart Type**: LineChart (Recharts)

**Data Series:**
- X-axis: Last 30 days (date)
- Y-axis: Count
- Lines:
  - Total Batches (primary)
  - Total Changes (secondary)
  - Approval Rate % (optional)

**Derived from**: `/api/governance/audit/stats?days=30`

---

## 🔌 Integration Points

### State Management
- ✅ Use React `useState` for component state
- ✅ Use `useFilters()` context for global filters (period, date range)
- ✅ Use `useAppStore()` for notifications (errors, success)

### Global Filters
- Period selector (Today, Week, Month, Year)
- These affect which data range is queried
- Implementation: Depends on `filters.period` from context

### Error Handling
- Display error banner if API fails
- "Try Again" button to retry request
- Log errors to console

### Loading State
- Skeleton loaders for KPI cards (optional)
- Show "Loading..." message (simple approach)

---

## ✅ Implementation Checklist

**Phase 1: Setup (Before Implementation)**
- [ ] Approval of this plan
- [ ] Create `governanceDashboardService.ts`
- [ ] Update `api.ts` with `governanceAPI`

**Phase 2: Core Implementation**
- [ ] Update `AuditDashboard.tsx` with actual implementation
- [ ] Fetch KPIs from `/api/governance/audit/kpis`
- [ ] Fetch stats from `/api/governance/audit/stats`
- [ ] Display all KPI cards
- [ ] Display audit stats chart

**Phase 3: Enhancements**
- [ ] Add drill-down functionality (click card → navigate to detail)
- [ ] Add export functionality (CSV, XLSX)
- [ ] Add filtering capabilities
- [ ] Add loading skeletons

**Phase 4: Testing & Documentation**
- [ ] Manual testing with backend mock data
- [ ] Verify responsive design (desktop/tablet/mobile)
- [ ] Update `/docs/screens/GOVERNANCE-AUDIT-DASHBOARD.md` with final implementation details
- [ ] Document components, dependencies, TODOs

---

## 🚀 Sequence of Implementation

1. **Update API Service** (5 min)
   - Add `governanceAPI` to `api.ts`

2. **Create Dashboard Service** (10 min)
   - Create `governanceDashboardService.ts`
   - Add helper functions for formatting, transformations

3. **Update AuditDashboard Component** (30 min)
   - Replace placeholder with real implementation
   - Add state management
   - Add data fetching
   - Add error handling
   - Add KPI cards
   - Add chart rendering

4. **Verification** (10 min)
   - Test with backend
   - Verify data displays correctly
   - Check responsive design

5. **Documentation** (5 min)
   - Create final documentation in `/docs/screens/`

**Total Estimated Time**: ~60 minutes

---

## 📋 Known Dependencies

- ✅ Backend: All governance endpoints are ready
- ✅ Components: KPICard, Layout, TopBar are ready
- ✅ Charting: Recharts already in dependencies
- ✅ Context: FilterContext and appStore already available
- ⚠️ Types: May need to create TypeScript interfaces for API responses

---

## 🎓 Next Pages (After Approval)

After this page is approved and complete, next pages will be:
1. **Jornada do Paciente** (Patient Journey)
2. **Comparação entre Sistemas** (System Comparison)
3. **Normalização de Dados** (Data Normalization)
4. **Conflitos** (Conflicts)
5. **Fila de Aprovação** (Approval Queue)
6. **Histórico** (History)
7. **Logs** (Logs)

---

## ❓ Questions for Approval

1. ✅ Should KPI cards be clickable for drill-down? (Assuming YES based on CLAUDE.md)
2. ✅ Should the chart show 30 days or allow user selection? (Assuming 30 days as default)
3. ✅ Should export include only visible data or all data? (Assuming visible)
4. ✅ Any specific styling/color preferences beyond existing design system?

---

**Ready for implementation upon approval. Waiting for feedback before proceeding.**
