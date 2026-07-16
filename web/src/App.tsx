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
import { OutrasFontesPage } from '@/pages/OutrasFontesPage'
import { LeadsParadosPage } from '@/pages/LeadsParadosPage'
import { TintimAuditoriaPage } from '@/pages/TintimAuditoriaPage'
import { ReuniaoPage } from '@/pages/ReuniaoPage'
import { Suspense } from 'react'

const appRoutes = [
  { path: '/', element: HomePage },
  { path: '/campanhas', element: CampanhasPage },
  { path: '/funil', element: FunilPage },
  { path: '/pipeline', element: PipelinePage },
  { path: '/pacientes', element: PacientesPage },
  { path: '/recepcao', element: RecepcaoPage },
  { path: '/insights', element: InsightsPage },
  { path: '/sem-origem', element: SemOrigemPage },
  { path: '/outras-fontes', element: OutrasFontesPage },
  { path: '/pipeline/parados', element: LeadsParadosPage },
  { path: '/auditoria-tintim', element: TintimAuditoriaPage },
]

export default function App() {
  return (
    <FilterProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="p-4">Carregando...</div>}>
          <Routes>
            <Route element={<Layout />}>
              {appRoutes.map(route => (
                <Route key={route.path} path={route.path} element={<route.element />} />
              ))}
            </Route>
            <Route path="/reuniao" element={<ReuniaoPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </FilterProvider>
  )
}
