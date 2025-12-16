'use client';

/**
 * Real-Time Analytics Hook - Client-Side Only
 *
 * React hook for real-time analytics data subscription and updates.
 * Uses WebSocket connection for live data streaming.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  RealtimeMetrics,
  AlertData,
  ConnectionQuality,
} from '../analytics/realtime-engine';
import logger from '../monitoring/logger';

export interface RealtimeEngineConfig {
  refreshInterval: number;
  autoReconnect: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableForecasting?: boolean;
  enableAnomalyDetection?: boolean;
}

export function useRealtimeEngine(config: RealtimeEngineConfig) {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPingMonitoring = useCallback(() => {
    if (pingIntervalRef.current) return;

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        const startTime = Date.now();
        socketRef.current.emit('ping', startTime);
      }
    }, 5000); // Ping every 5 seconds
  }, []);

  const updateConnectionQuality = useCallback((latency: number) => {
    if (latency < 100) {
      setConnectionQuality('excellent');
    } else if (latency < 300) {
      setConnectionQuality('good');
    } else {
      setConnectionQuality('poor');
    }
  }, []);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    try {
      socketRef.current = io('/api/realtime', {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        autoConnect: true
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        setConnectionQuality('excellent');
        setLastError(null);
        reconnectAttemptsRef.current = 0;

        // Start ping monitoring
        startPingMonitoring();

        logger.info('Real-time engine connected');
      });

      socketRef.current.on('disconnect', (reason) => {
        setIsConnected(false);
        setConnectionQuality('disconnected');
        logger.info('Real-time engine disconnected');

        if (config.autoReconnect && reason === 'io server disconnect') {
          scheduleReconnect();
        }
      });

      socketRef.current.on('connect_error', (error) => {
        setLastError(error.message);
        setConnectionQuality('disconnected');

        if (config.autoReconnect) {
          scheduleReconnect();
        }
      });

      // Listen for real-time data updates
      socketRef.current.on('metrics_update', (data: RealtimeMetrics) => {
        setMetrics({
          ...data,
          timestamp: new Date()
        });
      });

      socketRef.current.on('alert', (alert: AlertData) => {
        setMetrics(prev => prev ? {
          ...prev,
          alerts: [alert, ...(prev.alerts || [])].slice(0, 50) // Keep last 50 alerts
        } : null);
      });

      socketRef.current.on('pong', (latency: number) => {
        updateConnectionQuality(latency);
      });

    } catch (error) {
      setLastError((error as Error).message);
      setConnectionQuality('disconnected');
    }
  }, [config.autoReconnect, startPingMonitoring, updateConnectionQuality]);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    setConnectionQuality('disconnected');
  }, []);

  const scheduleReconnect = useCallback(() => {
    const maxAttempts = config.maxReconnectAttempts || 5;
    const delay = config.reconnectDelay || 1000;

    if (reconnectAttemptsRef.current < maxAttempts) {
      reconnectAttemptsRef.current++;

      setTimeout(() => {
        logger.info(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxAttempts})`);
        connect();
      }, delay * Math.pow(2, reconnectAttemptsRef.current - 1)); // Exponential backoff
    }
  }, [config.maxReconnectAttempts, config.reconnectDelay, connect]);

  const subscribe = useCallback((dataType: string) => {
    if (!subscriptions.has(dataType)) {
      setSubscriptions(prev => new Set(prev.add(dataType)));

      if (socketRef.current?.connected) {
        socketRef.current.emit('subscribe', { dataType });
      }
    }
  }, [subscriptions]);

  const unsubscribe = useCallback((dataType: string) => {
    if (subscriptions.has(dataType)) {
      setSubscriptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(dataType);
        return newSet;
      });

      if (socketRef.current?.connected) {
        socketRef.current.emit('unsubscribe', { dataType });
      }
    }
  }, [subscriptions]);

  const refreshData = useCallback(async (forceRefresh = false) => {
    try {
      const params = new URLSearchParams({
        subscriptions: Array.from(subscriptions).join(','),
        enableForecasting: String(config.enableForecasting || false),
        enableAnomalyDetection: String(config.enableAnomalyDetection || false),
        forceRefresh: String(forceRefresh)
      });

      const response = await fetch(`/api/analytics/realtime?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setMetrics({
        ...data,
        timestamp: new Date()
      });

      setLastError(null);
    } catch (error) {
      setLastError((error as Error).message);
      logger.error('Failed to refresh data', error);
    }
  }, [subscriptions, config.enableForecasting, config.enableAnomalyDetection]);

  // Initialize connection
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle subscription changes
  useEffect(() => {
    if (socketRef.current?.connected) {
      Array.from(subscriptions).forEach(dataType => {
        socketRef.current?.emit('subscribe', { dataType });
      });
    }
  }, [subscriptions]);

  // Auto-refresh data
  useEffect(() => {
    if (!isConnected && subscriptions.size > 0) {
      const interval = setInterval(() => {
        refreshData();
      }, config.refreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [isConnected, subscriptions.size, config.refreshInterval, refreshData]);

  // Initial data load
  useEffect(() => {
    if (subscriptions.size > 0) {
      refreshData(true);
    }
  }, [subscriptions.size, refreshData]);

  return {
    metrics,
    isConnected,
    connectionQuality,
    lastError,
    subscribe,
    unsubscribe,
    refreshData,
    connect,
    disconnect
  };
}

export default useRealtimeEngine;
