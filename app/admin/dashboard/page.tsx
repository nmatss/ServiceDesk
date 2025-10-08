import AdminDashboard from '@/src/components/admin/AdminDashboard'

export default function AdminDashboardPage() {
  return (
    <AdminDashboard>
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Visão geral do sistema ServiceDesk
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 - Total de Tickets */}
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Total de Tickets</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">1,234</dd>
            <div className="mt-2 flex items-center text-sm text-green-600">
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              12% este mês
            </div>
          </div>

          {/* Card 2 - Tickets Abertos */}
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Tickets Abertos</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">342</dd>
            <div className="mt-2 flex items-center text-sm text-yellow-600">
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              Estável
            </div>
          </div>

          {/* Card 3 - Tempo Médio de Resposta */}
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Tempo Médio</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">2.4h</dd>
            <div className="mt-2 flex items-center text-sm text-green-600">
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              8% mais rápido
            </div>
          </div>

          {/* Card 4 - Satisfação */}
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Satisfação</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">94%</dd>
            <div className="mt-2 flex items-center text-sm text-green-600">
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              3% este mês
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Atividade Recente</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Últimos tickets criados</p>
          </div>
          <div className="border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Ticket
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Prioridade
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Criado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    #1234 - Problema de login
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">
                      Em Andamento
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">
                      Alta
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    Há 5 minutos
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    #1233 - Erro no dashboard
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">
                      Aberto
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex rounded-full bg-orange-100 px-2 text-xs font-semibold leading-5 text-orange-800">
                      Média
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    Há 12 minutos
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    #1232 - Solicitação de acesso
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">
                      Resolvido
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">
                      Baixa
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    Há 25 minutos
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminDashboard>
  )
}
