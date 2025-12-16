/**
 * Advanced Connection Pool Management for Enterprise Scale
 * Manages database connections, implements read replicas, and optimizes connection usage
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  reapInterval: number;
  enableReadReplicas: boolean;
  readReplicaUrls?: string[];
  retryAttempts: number;
  retryDelay: number;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  averageAcquireTime: number;
  totalAcquired: number;
  totalReleased: number;
  errors: number;
}

export interface PooledConnection {
  id: string;
  database: Database.Database;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
  queryCount: number;
  averageQueryTime: number;
}

export class ConnectionPool extends EventEmitter {
  private static instance: ConnectionPool;
  private connections: Map<string, PooledConnection> = new Map();
  private readConnections: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<{
    resolve: (connection: PooledConnection) => void;
    reject: (error: Error) => void;
    timestamp: Date;
    isReadOperation: boolean;
  }> = [];

  private config: ConnectionPoolConfig;
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    averageAcquireTime: 0,
    totalAcquired: 0,
    totalReleased: 0,
    errors: 0
  };

  private reapTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  private constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();

    this.config = {
      maxConnections: config.maxConnections || 20,
      minConnections: config.minConnections || 5,
      acquireTimeout: config.acquireTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      reapInterval: config.reapInterval || 60000, // 1 minute
      enableReadReplicas: config.enableReadReplicas || false,
      readReplicaUrls: config.readReplicaUrls || [],
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };

    this.initialize();
  }

  static getInstance(config?: Partial<ConnectionPoolConfig>): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool(config);
    }
    return ConnectionPool.instance;
  }

  /**
   * Initialize the connection pool
   */
  private initialize(): void {
    try {
      // Create minimum connections
      for (let i = 0; i < this.config.minConnections; i++) {
        this.createConnection();
      }

      // Initialize read replicas if enabled
      if (this.config.enableReadReplicas && this.config.readReplicaUrls) {
        for (const replicaUrl of this.config.readReplicaUrls) {
          this.createReadConnection(replicaUrl);
        }
      }

      // Start connection reaper
      this.startConnectionReaper();

      this.emit('pool:initialized', { connections: this.connections.size });
    } catch (error) {
      this.emit('pool:error', error);
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(isReadOperation = false): Promise<PooledConnection> {
    const startTime = Date.now();

    try {
      // Try to get an available connection
      const connection = this.getAvailableConnection(isReadOperation);
      if (connection) {
        this.markConnectionActive(connection);
        this.updateAcquireStats(startTime);
        return connection;
      }

      // Create new connection if under limit
      if (this.connections.size < this.config.maxConnections) {
        const newConnection = this.createConnection();
        this.markConnectionActive(newConnection);
        this.updateAcquireStats(startTime);
        return newConnection;
      }

      // Wait for available connection
      return this.waitForConnection(isReadOperation, startTime);
    } catch (error) {
      this.stats.errors++;
      this.emit('pool:error', error);
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PooledConnection): void {
    try {
      connection.isActive = false;
      connection.lastUsed = new Date();
      this.stats.totalReleased++;
      this.stats.activeConnections--;
      this.stats.idleConnections++;

      // Process waiting queue
      this.processWaitingQueue();

      this.emit('connection:released', { connectionId: connection.id });
    } catch (error) {
      this.emit('pool:error', error);
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async execute<T = any>(
    query: string,
    params: any[] = [],
    isReadOperation = false
  ): Promise<T> {
    const connection = await this.acquire(isReadOperation);
    const startTime = Date.now();

    try {
      let result: T;

      if (query.trim().toUpperCase().startsWith('SELECT')) {
        result = connection.database.prepare(query).all(...params) as T;
      } else {
        result = connection.database.prepare(query).run(...params) as T;
      }

      // Update connection stats
      const queryTime = Date.now() - startTime;
      connection.queryCount++;
      connection.averageQueryTime =
        (connection.averageQueryTime * (connection.queryCount - 1) + queryTime) / connection.queryCount;

      return result;
    } finally {
      this.release(connection);
    }
  }

  /**
   * Execute a transaction with automatic connection management
   */
  async transaction<T>(
    operations: (db: Database.Database) => T
  ): Promise<T> {
    const connection = await this.acquire(false); // Always use write connection for transactions

    try {
      const transaction = connection.database.transaction(operations);
      return transaction(connection.database);
    } finally {
      this.release(connection);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): ConnectionStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get detailed connection information
   */
  getConnectionInfo(): Array<{
    id: string;
    type: 'write' | 'read';
    isActive: boolean;
    createdAt: Date;
    lastUsed: Date;
    queryCount: number;
    averageQueryTime: number;
  }> {
    const info: Array<{
      id: string;
      type: 'write' | 'read';
      isActive: boolean;
      createdAt: Date;
      lastUsed: Date;
      queryCount: number;
      averageQueryTime: number;
    }> = [];

    // Write connections
    for (const connection of this.connections.values()) {
      info.push({
        id: connection.id,
        type: 'write',
        isActive: connection.isActive,
        createdAt: connection.createdAt,
        lastUsed: connection.lastUsed,
        queryCount: connection.queryCount,
        averageQueryTime: connection.averageQueryTime
      });
    }

    // Read connections
    for (const connection of this.readConnections.values()) {
      info.push({
        id: connection.id,
        type: 'read',
        isActive: connection.isActive,
        createdAt: connection.createdAt,
        lastUsed: connection.lastUsed,
        queryCount: connection.queryCount,
        averageQueryTime: connection.averageQueryTime
      });
    }

    return info;
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.reapTimer) {
      clearInterval(this.reapTimer);
    }

    // Close all connections
    const closePromises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      closePromises.push(this.closeConnection(connection));
    }

    for (const connection of this.readConnections.values()) {
      closePromises.push(this.closeConnection(connection));
    }

    await Promise.all(closePromises);

    this.connections.clear();
    this.readConnections.clear();

    this.emit('pool:shutdown');
  }

  /**
   * Health check for the pool
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalConnections: number;
      activeConnections: number;
      averageResponseTime: number;
      errorRate: number;
      readReplicasHealthy: boolean;
    };
  }> {
    const stats = this.getStats();
    const errorRate = stats.totalAcquired > 0 ? (stats.errors / stats.totalAcquired) * 100 : 0;

    // Test connection responsiveness
    const testStartTime = Date.now();
    try {
      await this.execute('SELECT 1', [], true);
      const responseTime = Date.now() - testStartTime;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (errorRate > 10 || responseTime > 1000) {
        status = 'unhealthy';
      } else if (errorRate > 5 || responseTime > 500) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          totalConnections: stats.totalConnections,
          activeConnections: stats.activeConnections,
          averageResponseTime: responseTime,
          errorRate,
          readReplicasHealthy: this.readConnections.size > 0
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          totalConnections: stats.totalConnections,
          activeConnections: stats.activeConnections,
          averageResponseTime: -1,
          errorRate: 100,
          readReplicasHealthy: false
        }
      };
    }
  }

  private createConnection(): PooledConnection {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const database = new Database(process.env.DATABASE_URL || 'servicedesk.db', {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
      });

      // Optimize SQLite settings for performance
      database.pragma('journal_mode = WAL');
      database.pragma('synchronous = NORMAL');
      database.pragma('cache_size = 10000');
      database.pragma('temp_store = MEMORY');
      database.pragma('mmap_size = 268435456'); // 256MB

      const connection: PooledConnection = {
        id: connectionId,
        database,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: false,
        queryCount: 0,
        averageQueryTime: 0
      };

      this.connections.set(connectionId, connection);
      this.stats.totalConnections++;
      this.stats.idleConnections++;

      this.emit('connection:created', { connectionId });

      return connection;
    } catch (error) {
      this.emit('connection:error', { connectionId, error });
      throw error;
    }
  }

  private createReadConnection(url: string): PooledConnection {
    const connectionId = `read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const database = new Database(url, {
        readonly: true,
        fileMustExist: true,
        timeout: 5000
      });

      const connection: PooledConnection = {
        id: connectionId,
        database,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: false,
        queryCount: 0,
        averageQueryTime: 0
      };

      this.readConnections.set(connectionId, connection);

      this.emit('read-connection:created', { connectionId });

      return connection;
    } catch (error) {
      this.emit('read-connection:error', { connectionId, error });
      throw error;
    }
  }

  private getAvailableConnection(isReadOperation: boolean): PooledConnection | null {
    // For read operations, prefer read replicas
    if (isReadOperation && this.config.enableReadReplicas) {
      for (const connection of this.readConnections.values()) {
        if (!connection.isActive) {
          return connection;
        }
      }
    }

    // Fall back to write connections
    for (const connection of this.connections.values()) {
      if (!connection.isActive) {
        return connection;
      }
    }

    return null;
  }

  private markConnectionActive(connection: PooledConnection): void {
    connection.isActive = true;
    connection.lastUsed = new Date();
    this.stats.activeConnections++;
    this.stats.idleConnections--;
  }

  private async waitForConnection(isReadOperation: boolean, startTime: number): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
          this.stats.waitingRequests--;
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({
        resolve: (connection: PooledConnection) => {
          clearTimeout(timeout);
          this.updateAcquireStats(startTime);
          resolve(connection);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: new Date(),
        isReadOperation
      });

      this.stats.waitingRequests++;
    });
  }

  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) return;

    const nextRequest = this.waitingQueue.shift();
    if (!nextRequest) return;

    this.stats.waitingRequests--;

    const connection = this.getAvailableConnection(nextRequest.isReadOperation);
    if (connection) {
      this.markConnectionActive(connection);
      nextRequest.resolve(connection);
    } else {
      // Put it back at the front of the queue
      this.waitingQueue.unshift(nextRequest);
      this.stats.waitingRequests++;
    }
  }

  private updateAcquireStats(startTime: number): void {
    const acquireTime = Date.now() - startTime;
    this.stats.totalAcquired++;
    this.stats.averageAcquireTime =
      (this.stats.averageAcquireTime * (this.stats.totalAcquired - 1) + acquireTime) / this.stats.totalAcquired;
  }

  private updateStats(): void {
    let activeCount = 0;
    let idleCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        activeCount++;
      } else {
        idleCount++;
      }
    }

    for (const connection of this.readConnections.values()) {
      if (connection.isActive) {
        activeCount++;
      } else {
        idleCount++;
      }
    }

    this.stats.activeConnections = activeCount;
    this.stats.idleConnections = idleCount;
    this.stats.totalConnections = this.connections.size + this.readConnections.size;
  }

  private startConnectionReaper(): void {
    this.reapTimer = setInterval(() => {
      this.reapIdleConnections();
    }, this.config.reapInterval);
  }

  private reapIdleConnections(): void {
    if (this.isShuttingDown) return;

    const now = new Date();
    const connectionsToReap: string[] = [];

    // Only reap if we have more than minimum connections
    if (this.connections.size <= this.config.minConnections) return;

    for (const [id, connection] of this.connections.entries()) {
      if (!connection.isActive) {
        const idleTime = now.getTime() - connection.lastUsed.getTime();
        if (idleTime > this.config.idleTimeout) {
          connectionsToReap.push(id);
        }
      }
    }

    // Keep minimum connections
    const canReap = this.connections.size - connectionsToReap.length;
    if (canReap < this.config.minConnections) {
      const keepCount = this.config.minConnections - canReap;
      connectionsToReap.splice(-keepCount);
    }

    for (const id of connectionsToReap) {
      const connection = this.connections.get(id);
      if (connection) {
        this.closeConnection(connection);
        this.connections.delete(id);
        this.stats.totalConnections--;
        this.stats.idleConnections--;
      }
    }

    if (connectionsToReap.length > 0) {
      this.emit('connections:reaped', { count: connectionsToReap.length });
    }
  }

  private async closeConnection(connection: PooledConnection): Promise<void> {
    try {
      connection.database.close();
      this.emit('connection:closed', { connectionId: connection.id });
    } catch (error) {
      this.emit('connection:error', { connectionId: connection.id, error });
    }
  }
}

// Export singleton factory
export function createConnectionPool(config?: Partial<ConnectionPoolConfig>): ConnectionPool {
  return ConnectionPool.getInstance(config);
}

// Default pool instance
export const connectionPool = ConnectionPool.getInstance();