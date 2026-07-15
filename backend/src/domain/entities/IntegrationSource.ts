/**
 * Entidade: Fonte de Dados Integrada
 * Representa um sistema externo conectado ao Executive OS
 * Ex: Pipedrive, Clairis, WhatsApp, ERP
 */

export enum DataSourceType {
  CRM = 'CRM',
  ERP = 'ERP',
  AGENDA = 'AGENDA',
  FINANCE = 'FINANCE',
  MARKETING = 'MARKETING',
  MESSAGING = 'MESSAGING'
}

export interface IntegrationSourceConfig {
  apiKey?: string;
  baseUrl?: string;
  customFields?: Record<string, string>;
  [key: string]: any;
}

export class IntegrationSource {
  id: string;
  name: string;  // "Pipedrive", "Clairis", "WhatsApp", etc
  type: DataSourceType;
  enabled: boolean;
  connectorClass: string;  // Nome da classe do conector (Ex: "PipedriveDataSource")
  config: IntegrationSourceConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
  lastSyncStatus?: 'success' | 'failed' | 'pending';

  constructor(
    id: string,
    name: string,
    type: DataSourceType,
    connectorClass: string,
    config: IntegrationSourceConfig = {}
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.connectorClass = connectorClass;
    this.config = config;
    this.enabled = false;
    this.isActive = true;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static create(
    name: string,
    type: DataSourceType,
    connectorClass: string,
    config?: IntegrationSourceConfig
  ): IntegrationSource {
    const id = `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new IntegrationSource(id, name, type, connectorClass, config);
  }

  enable(): void {
    this.enabled = true;
    this.updatedAt = new Date();
  }

  disable(): void {
    this.enabled = false;
    this.updatedAt = new Date();
  }

  updateConfig(newConfig: Partial<IntegrationSourceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.updatedAt = new Date();
  }

  recordSync(status: 'success' | 'failed', timestamp: Date = new Date()): void {
    this.lastSyncAt = timestamp;
    this.lastSyncStatus = status;
    this.updatedAt = new Date();
  }
}
