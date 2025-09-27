import db from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Inicializa o banco de dados criando as tabelas se elas não existirem
 */
export function initializeDatabase() {
  try {
    // Lê o arquivo de schema
    const schemaPath = join(process.cwd(), 'lib', 'db', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Executa o schema
    db.exec(schema);
    
    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    return false;
  }
}

/**
 * Verifica se o banco de dados está inicializado
 */
export function isDatabaseInitialized(): boolean {
  try {
    // Verifica se a tabela users existe
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='users'
    `).get();
    
    return !!result;
  } catch (error) {
    console.error('Error checking database initialization:', error);
    return false;
  }
}

/**
 * Fecha a conexão com o banco de dados
 */
export function closeDatabase() {
  try {
    db.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

