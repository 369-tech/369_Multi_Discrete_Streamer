import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { FilterBar } from './FilterBar'

export function Layout({ title, showFilters = true, children }: { title: string; showFilters?: boolean; children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        {showFilters && <FilterBar />}
        <main className="flex-1 overflow-y-auto px-6 py-5 fade-in">{children}</main>
      </div>
    </div>
  )
}
