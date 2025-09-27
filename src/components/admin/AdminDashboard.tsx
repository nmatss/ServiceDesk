'use client'

import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

interface AdminDashboardProps {
  children: React.ReactNode
}

export default function AdminDashboard({ children }: AdminDashboardProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-full">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="lg:pl-72">
        <Header setSidebarOpen={setSidebarOpen} />

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}