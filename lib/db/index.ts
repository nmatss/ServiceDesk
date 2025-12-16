// Arquivo principal para gerenciar o banco de dados
import dbConnection from './connection';

// Named exports
export { db, getDb, getDB, getConnection } from './connection';
export { initializeDatabase, isDatabaseInitialized, closeDatabase } from './init';
export { seedDatabase, clearDatabase } from './seed';

// Default export for backward compatibility
export default dbConnection;

// Exportar queries
export * from './queries';

// Re-exportar tipos
export * from '../types/database';
