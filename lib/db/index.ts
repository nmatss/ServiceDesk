// Arquivo principal para gerenciar o banco de dados
export { default as db } from './connection';
export { initializeDatabase, isDatabaseInitialized, closeDatabase } from './init';
export { seedDatabase, clearDatabase } from './seed';

// Função de conveniência para obter a conexão do banco
import db from './connection';
export const getDb = () => db;

// Exportar queries
export * from './queries';

// Re-exportar tipos
export * from '../types/database';
