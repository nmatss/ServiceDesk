import db from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../monitoring/structured-logger';

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
    
    logger.info('✅ Database initialized successfully');
    return true;
  } catch (error) {
    logger.error('❌ Error initializing database', error);
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
    logger.error('Error checking database initialization', error);
    return false;
  }
}

/**
 * Fecha a conexão com o banco de dados
 */
export function closeDatabase() {
  try {
    db.close();
    logger.info('✅ Database connection closed');
  } catch (error) {
    logger.error('❌ Error closing database', error);
  }
}

