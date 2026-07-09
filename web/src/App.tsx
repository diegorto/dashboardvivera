import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FilterProvider } from '@/lib/FilterContext'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { CampanhasPage } from '@/pages/CampanhasPage'
import { FunilPage } from '@/pages/FunilPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { PacientesPage } from '@/pages/PacientesPage'
import { InsightsPage } from '@/pages/InsightsPage'
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
            <Route path="/insights" element={<InsightsPage />} />
          </Route>
          <Route path="/reuniao" element={<ReuniaoPage />} />
        </Routes>
      </BrowserRouter>
    </FilterProvider>
  )
}
