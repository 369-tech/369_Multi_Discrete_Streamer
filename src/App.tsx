import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import AnalysisReportLayout from './components/analysis-report/AnalysisReportLayout';
import { AppProvider } from './context/AppContext';

// Lazy-loaded pages — each becomes its own JS chunk, fetched on first visit.
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'));
const RatiosPage = lazy(() => import('./pages/RatiosPage.tsx'));
const ATMStraddlePage = lazy(() => import('./pages/ATMStraddlePage.tsx'));
const RulesPage = lazy(() => import('./pages/RulesPage.tsx'));
const SLMonitoringPage = lazy(() => import('./pages/SLMonitoringPage.tsx'));
const DTDMonitorPage = lazy(() => import('./pages/DTDMonitorPage.tsx'));
const DTDSLMonitorPage = lazy(() => import('./pages/DTDSLMonitorPage.tsx'));
const CASPage = lazy(() => import('./pages/CASPage.tsx'));
const ArbProxyPage = lazy(() => import('./pages/ArbProxyPage.tsx'));

// Analysis Report pages
const OverviewPage = lazy(() => import('./pages/analysis-report/OverviewPage.tsx'));
const ClientAnalysisPage = lazy(() => import('./pages/analysis-report/ClientAnalysisPage.tsx'));
const ClientDetailPage = lazy(() => import('./pages/analysis-report/ClientDetailPage.tsx'));

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="ratios" element={<RatiosPage />} />
          <Route path="atm-straddle" element={<ATMStraddlePage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="sl-monitoring" element={<SLMonitoringPage />} />
          <Route path="dtd-monitor" element={<DTDMonitorPage />} />
          <Route path="dtd-sl-monitoring" element={<DTDSLMonitorPage />} />
          <Route path="cas" element={<CASPage />} />
          <Route path="arb_proxy" element={<ArbProxyPage />} />
        </Route>
        <Route path="/analysis-report" element={<AnalysisReportLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="client-analysis" element={<ClientAnalysisPage />} />
          <Route path="client-analysis/:clientId" element={<ClientDetailPage />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}