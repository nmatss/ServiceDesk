// Configurações do banco de dados

export const dbConfig = {
  // Configurações do SQLite (desenvolvimento)
  sqlite: {
    path: './data/servicedesk.db',
    options: {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    },
    pragmas: {
      foreign_keys: 'ON',
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: 1000,
      temp_store: 'MEMORY',
    },
  },

  // Configurações do Neon (produção)
  neon: {
    connectionString: process.env.DATABASE_URL,
    ssl: true,
    max: 20, // máximo de conexões
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Configurações gerais
  general: {
    // Tamanho máximo de upload de arquivo (em bytes)
    maxFileSize: 10 * 1024 * 1024, // 10MB
    
    // Tipos de arquivo permitidos
    allowedFileTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-rar-compressed',
    ],

    // Configurações de paginação
    defaultPageSize: 20,
    maxPageSize: 100,

    // Configurações de cache
    cache: {
      enabled: true,
      ttl: 300, // 5 minutos
    },
  },
};

// Função para determinar qual banco usar
export function getDatabaseType(): 'sqlite' | 'neon' {
  if (process.env.DATABASE_URL) {
    return 'neon';
  }
  return 'sqlite';
}

// Função para obter configurações do banco atual
export function getCurrentDbConfig() {
  const dbType = getDatabaseType();
  return {
    type: dbType,
    config: dbConfig[dbType],
  };
}

