'use client';

/**
 * useRealtimeNotifications - Real-time Notifications Hook
 *
 * Uses Server-Sent Events (SSE) for real-time notifications instead of polling.
 * Falls back to polling if SSE is not supported or connection fails.
 *
 * PERFORMANCE: SSE is more efficient than polling as it:
 * - Maintains a single long-lived connection
 * - Only receives data when there are new notifications
 * - Reduces network overhead and battery drain
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface Notification {
  id: number;
  user_id: number;
  type: 'info' | 'warning' | 'error' | 'success' | 'ticket_update' | 'sla_breach';
  title: string;
  message: string;
  link?: string;
  read_at?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UseRealtimeNotificationsOptions {
  userId?: number;
  enabled?: boolean;
  pollingFallbackInterval?: number;
  onNewNotification?: (notification: Notification) => void;
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const {
    userId,
    enabled = true,
    pollingFallbackInterval = 30000, // 30 seconds fallback
    onNewNotification
  } = options;

  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    isConnected: false,
    isLoading: true,
    error: null
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUsingSSE = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectDelayRef = useRef(1000); // Start with 1 second

  // Fetch notifications via REST API
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/notifications?limit=50', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setState(prev => ({
            ...prev,
            notifications: data.notifications || [],
            unreadCount: data.unreadCount || 0,
            isLoading: false,
            error: null
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Falha ao carregar notificações'
      }));
    }
  }, [userId]);

  // Connect to SSE endpoint
  const connectSSE = useCallback(() => {
    if (!userId || !enabled) return;

    // Check if SSE is supported
    if (typeof EventSource === 'undefined') {
      console.warn('SSE not supported, falling back to polling');
      return false;
    }

    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`/api/notifications/sse?userId=${userId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        isUsingSSE.current = true;
        setState(prev => ({ ...prev, isConnected: true, error: null }));

        // Reset reconnection tracking on successful connection
        reconnectAttemptsRef.current = 0;
        reconnectDelayRef.current = 1000;

        // Clear polling interval if SSE connected successfully
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'notification') {
            const newNotification = data.notification as Notification;

            setState(prev => ({
              ...prev,
              notifications: [newNotification, ...prev.notifications].slice(0, 50),
              unreadCount: prev.unreadCount + 1
            }));

            onNewNotification?.(newNotification);
          } else if (data.type === 'sync') {
            // Full sync of notifications
            setState(prev => ({
              ...prev,
              notifications: data.notifications || [],
              unreadCount: data.unreadCount || 0
            }));
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        isUsingSSE.current = false;
        eventSource.close();
        eventSourceRef.current = null;

        setState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Conexão perdida, reconectando...'
        }));

        // Fall back to polling
        startPolling();

        // Implement exponential backoff with max retries
        const MAX_RETRIES = 10;
        const MAX_DELAY = 30000; // 30 seconds

        if (reconnectAttemptsRef.current < MAX_RETRIES) {
          reconnectAttemptsRef.current += 1;

          // Calculate delay with exponential backoff
          const delay = Math.min(reconnectDelayRef.current, MAX_DELAY);
          reconnectDelayRef.current = Math.min(delay * 2, MAX_DELAY);

          console.log(`Attempting SSE reconnection ${reconnectAttemptsRef.current}/${MAX_RETRIES} in ${delay}ms`);

          // Clear any existing reconnection timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            if (enabled) {
              connectSSE();
            }
          }, delay);
        } else {
          console.error('Max SSE reconnection attempts reached. Using polling only.');
          setState(prev => ({
            ...prev,
            error: 'Não foi possível estabelecer conexão em tempo real. Usando atualização periódica.'
          }));
        }
      };

      return true;
    } catch (error) {
      console.error('Failed to connect SSE:', error);
      return false;
    }
  }, [userId, enabled, onNewNotification]);

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    // Initial fetch
    fetchNotifications();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(() => {
      if (!isUsingSSE.current) {
        fetchNotifications();
      }
    }, pollingFallbackInterval);
  }, [fetchNotifications, pollingFallbackInterval]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          notifications: prev.notifications.map(n =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1)
        }));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          notifications: prev.notifications.map(n => ({
            ...n,
            read_at: n.read_at || new Date().toISOString()
          })),
          unreadCount: 0
        }));
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setState(prev => {
          const notification = prev.notifications.find(n => n.id === notificationId);
          const wasUnread = notification && !notification.read_at;

          return {
            ...prev,
            notifications: prev.notifications.filter(n => n.id !== notificationId),
            unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount
          };
        });
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, []);

  // Initialize connection
  useEffect(() => {
    if (!enabled || !userId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Try SSE first, fall back to polling if it fails
    const sseConnected = connectSSE();
    if (!sseConnected) {
      startPolling();
    }

    // Also do an initial fetch
    fetchNotifications();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Reset reconnection tracking
      reconnectAttemptsRef.current = 0;
      reconnectDelayRef.current = 1000;
    };
  }, [enabled, userId, connectSSE, startPolling, fetchNotifications]);

  return {
    ...state,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications
  };
}

export default useRealtimeNotifications;
