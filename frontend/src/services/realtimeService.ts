/**
 * Serviço de WebSocket para atualizações em tempo real do dashboard
 */

export type DashboardEventType =
  | 'leads:new'
  | 'sale:closed'
  | 'call:completed'
  | 'noshow:registered'
  | 'cancellation:registered'
  | 'alert:new'
  | 'metrics:update'
  | 'connection:established'
  | 'connection:lost';

export interface DashboardEvent {
  type: DashboardEventType;
  timestamp: number;
  data: Record<string, any>;
}

export type EventCallback = (event: DashboardEvent) => void;

class RealtimeService {
  private static instance: RealtimeService;
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 segundos
  private isManuallyDisconnected = false;
  private listeners: Map<DashboardEventType, Set<EventCallback>> = new Map();
  private generalListeners: Set<EventCallback> = new Set();

  private constructor(wsUrl?: string) {
    // Determinar URL do WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = wsUrl || `${protocol}//${host}/ws`;
  }

  static getInstance(wsUrl?: string): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService(wsUrl);
    }
    return RealtimeService.instance;
  }

  /**
   * Conecta ao WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isManuallyDisconnected = false;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket conectado');
          this.reconnectAttempts = 0;
          this.emit({
            type: 'connection:established',
            timestamp: Date.now(),
            data: { message: 'Conectado ao servidor em tempo real' },
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const dashboardEvent: DashboardEvent = JSON.parse(event.data);
            this.handleEvent(dashboardEvent);
          } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ Erro WebSocket:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket desconectado');
          this.emit({
            type: 'connection:lost',
            timestamp: Date.now(),
            data: { message: 'Desconectado do servidor' },
          });

          if (!this.isManuallyDisconnected) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('Erro ao conectar WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Desconecta do WebSocket
   */
  disconnect(): void {
    this.isManuallyDisconnected = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Tenta reconectar automaticamente
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Backoff exponencial
      console.log(`🔄 Tentando reconectar em ${delay / 1000}s... (tentativa ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Falha ao reconectar:', error);
        });
      }, delay);
    } else {
      console.error('Máximo de tentativas de reconexão atingido');
    }
  }

  /**
   * Registra um listener para um tipo de evento específico
   */
  on(eventType: DashboardEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Retorna função para unsubscribe
    return () => {
      this.off(eventType, callback);
    };
  }

  /**
   * Remove listener para um tipo de evento
   */
  off(eventType: DashboardEventType, callback: EventCallback): void {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.delete(callback);
    }
  }

  /**
   * Registra listener para todos os eventos
   */
  onAny(callback: EventCallback): () => void {
    this.generalListeners.add(callback);

    return () => {
      this.generalListeners.delete(callback);
    };
  }

  /**
   * Envia mensagem para o servidor
   */
  send(type: string, data: Record<string, any>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket não está conectado');
      return;
    }

    this.ws.send(
      JSON.stringify({
        type,
        timestamp: Date.now(),
        data,
      })
    );
  }

  /**
   * Processa evento recebido
   */
  private handleEvent(event: DashboardEvent): void {
    // Chamar listeners específicos do tipo
    if (this.listeners.has(event.type)) {
      this.listeners.get(event.type)!.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Erro ao executar callback para ${event.type}:`, error);
        }
      });
    }

    // Chamar listeners gerais
    this.generalListeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Erro ao executar callback geral:', error);
      }
    });
  }

  /**
   * Emite um evento localmente (para testes)
   */
  private emit(event: DashboardEvent): void {
    this.handleEvent(event);
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Retorna estado da conexão
   */
  getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }
}

export default RealtimeService;
