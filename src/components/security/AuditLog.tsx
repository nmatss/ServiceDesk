'use client';

import { useState, useEffect } from 'react';
// import { useUser } from '@stackframe/stack'; // TODO: Install @stackframe/stack if needed
import { logger } from '@/lib/monitoring/logger';

// Temporary user hook replacement
const useUser = () => ({ id: '' });

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  path?: string;
  data?: any;
  ip_address?: string;
  timestamp: string;
}

export default function AuditLog() {
  const user = useUser();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Verificar se é admin - simplificado para demo
    const isAdmin = (user as any)?.serverMetadata?.isAdmin || user.id === 'admin';
    if (isAdmin) {
      fetchAuditLogs();
    }
  }, [user, filter]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/audit/logs?filter=${filter}`);
      const data = await response.json();
      setLogs(data.logs);
    } catch (error) {
      logger.error('Erro ao buscar logs', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = (user as any)?.serverMetadata?.isAdmin || user.id === 'admin';
  if (!isAdmin) {
    return <div>Acesso negado</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Logs de Auditoria
        </h3>
        
        {/* Filtros */}
        <div className="mb-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todas as ações</option>
            <option value="access">Acessos</option>
            <option value="create">Criações</option>
            <option value="update">Atualizações</option>
            <option value="delete">Exclusões</option>
            <option value="login_success">Logins bem-sucedidos</option>
            <option value="login_failed">Tentativas de login falhadas</option>
          </select>
        </div>

        {/* Tabela de logs */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detalhes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Carregando logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Nenhum log encontrado
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.action === 'delete' ? 'bg-red-100 text-red-800' :
                        log.action === 'create' ? 'bg-green-100 text-green-800' :
                        log.action === 'update' ? 'bg-yellow-100 text-yellow-800' :
                        log.action === 'login_failed' ? 'bg-red-100 text-red-800' :
                        log.action === 'login_success' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.path || (log.data ? JSON.stringify(log.data) : '-')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
