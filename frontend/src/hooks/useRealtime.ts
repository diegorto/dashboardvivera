import { useEffect, useCallback, useRef } from 'react';
import RealtimeService, { DashboardEvent, DashboardEventType } from '../services/realtimeService';

/**
 * Hook para usar o serviço de tempo real
 */
export const useRealtime = (autoConnect = true) => {
  const serviceRef = useRef(RealtimeService.getInstance());
  const unsubscribersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const service = serviceRef.current;

    if (autoConnect) {
      service.connect().catch((error) => {
        console.error('Erro ao conectar ao WebSocket:', error);
      });
    }

    return () => {
      // Cleanup: remover todos os listeners
      unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribersRef.current = [];
    };
  }, [autoConnect]);

  const subscribe = useCallback(
    (eventType: DashboardEventType, callback: (event: DashboardEvent) => void) => {
      const unsubscribe = serviceRef.current.on(eventType, callback);
      unsubscribersRef.current.push(unsubscribe);
      return unsubscribe;
    },
    []
  );

  const subscribeAll = useCallback((callback: (event: DashboardEvent) => void) => {
    const unsubscribe = serviceRef.current.onAny(callback);
    unsubscribersRef.current.push(unsubscribe);
    return unsubscribe;
  }, []);

  const send = useCallback((type: string, data: Record<string, any>) => {
    serviceRef.current.send(type, data);
  }, []);

  const connect = useCallback(() => {
    return serviceRef.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    serviceRef.current.disconnect();
  }, []);

  const isConnected = useCallback(() => {
    return serviceRef.current.isConnected();
  }, []);

  const getConnectionState = useCallback(() => {
    return serviceRef.current.getConnectionState();
  }, []);

  return {
    subscribe,
    subscribeAll,
    send,
    connect,
    disconnect,
    isConnected,
    getConnectionState,
    service: serviceRef.current,
  };
};

/**
 * Hook para escutar um tipo específico de evento
 */
export const useRealtimeEvent = (eventType: DashboardEventType, onEvent: (event: DashboardEvent) => void) => {
  const service = RealtimeService.getInstance();

  useEffect(() => {
    const unsubscribe = service.on(eventType, onEvent);
    return unsubscribe;
  }, [eventType, onEvent, service]);
};

/**
 * Hook para escutar todos os eventos
 */
export const useRealtimeEvents = (onEvent: (event: DashboardEvent) => void) => {
  const service = RealtimeService.getInstance();

  useEffect(() => {
    const unsubscribe = service.onAny(onEvent);
    return unsubscribe;
  }, [onEvent, service]);
};
