import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

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

export default function MainLayout() {
  const { pathname } = useLocation();
  const hideSidebar = ['/ratios', '/atm-straddle', '/rules', '/cas', '/arb_proxy'].includes(pathname);

  return (
    <div className="flex h-screen flex-col bg-surface">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && <Sidebar />}
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_72%_0%,rgba(15,62,91,0.18),transparent_34%),#081321] p-5 lg:p-6">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
