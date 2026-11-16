import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AnalysisReportSidebar from './AnalysisReportSidebar';
import ErrorBoundary from '../common/ErrorBoundary';

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-accent" />
        Loading page…
      </div>
    </div>
  );
}

export default function AnalysisReportLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#060d18] text-slate-200">
      <AnalysisReportSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
