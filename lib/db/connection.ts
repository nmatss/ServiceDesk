import Database from 'better-sqlite3';
import path from 'path';

// Caminho para o arquivo do banco de dados
const dbPath = path.join(process.cwd(), 'data', 'servicedesk.db');

// Garantir que o diretório data existe
import { mkdirSync } from 'fs';
try {
  mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (error) {
  // Diretório já existe ou erro de permissão
}

// Configurações do banco
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Configurações de performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 1000');
db.pragma('temp_store = MEMORY');

export default db;

