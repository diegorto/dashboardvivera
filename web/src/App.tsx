import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FilterProvider } from '@/lib/FilterContext'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { CampanhasPage } from '@/pages/CampanhasPage'
import { FunilPage } from '@/pages/FunilPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { PacientesPage } from '@/pages/PacientesPage'
import { RecepcaoPage } from '@/pages/RecepcaoPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { SemOrigemPage } from '@/pages/SemOrigemPage'
import { LeadsParadosPage } from '@/pages/LeadsParadosPage'
import { TintimAuditoriaPage } from '@/pages/TintimAuditoriaPage'
import { ReuniaoPage } from '@/pages/ReuniaoPage'

export default function App() {
  return (
    <FilterProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/campanhas" element={<CampanhasPage />} />
            <Route path="/funil" element={<FunilPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/pacientes" element={<PacientesPage />} />
            <Route path="/recepcao" element={<RecepcaoPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/sem-origem" element={<SemOrigemPage />} />
            <Route path="/pipeline/parados" element={<LeadsParadosPage />} />
            <Route path="/auditoria-tintim" element={<TintimAuditoriaPage />} />
          </Route>
          <Route path="/reuniao" element={<ReuniaoPage />} />
        </Routes>
      </BrowserRouter>
    </FilterProvider>
  )
}
