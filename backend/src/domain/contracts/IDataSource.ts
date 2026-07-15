/**
 * Interface Principal: Data Source
 * Define contrato que TODAS as integrações devem seguir
 * Abstração completa que permite trocar implementações sem impacto
 */

export enum DataSourceType {
  CRM = 'CRM',
  ERP = 'ERP',
  AGENDA = 'AGENDA',
  FINANCE = 'FINANCE',
  MARKETING = 'MARKETING',
  MESSAGING = 'MESSAGING'
}

export enum EntityType {
  PATIENT = 'patient',
  APPOINTMENT = 'appointment',
  DEAL = 'deal',
  ACTIVITY = 'activity',
  CONTACT = 'contact',
  TRANSACTION = 'transaction'
}

export interface ConnectionTestResult {
  isConnected: boolean;
  message: string;
  timestamp: Date;
  latency?: number;
}

export interface PatientData {
  id: string;
  externalId: string;
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birthDate?: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface AppointmentData {
  id: string;
  externalId: string;
  patientId: string;
  title: string;
  description?: string;
  date: Date;
  duration?: number;
  status: 'scheduled' | 'confirmed' | 'attended' | 'missed' | 'cancelled';
  source: string;
  metadata?: Record<string, any>;
}

export interface DealData {
  id: string;
  externalId: string;
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won' | 'lost' | 'cancelled';
  stage: string;
  probability?: number;
  expectedCloseDate?: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  entitiesProcessed: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesDeleted: number;
  errors: Array<{ entity: string; error: string }>;
  duration: number;
  timestamp: Date;
}

export interface FieldMapping {
  externalField: string;
  internalField: string;
  transformation?: 'identity' | 'normalize' | 'custom';
}

export interface SourceSchema {
  entities: EntityType[];
  fields: Record<EntityType, string[]>;
  capabilities: SourceCapabilities;
}

export interface SourceCapabilities {
  supportsRealTimeSync: boolean;
  supportedEntities: EntityType[];
  supportsDelete: boolean;
  supportsUpdate: boolean;
  supportsCreate: boolean;
}

/**
 * Interface Principal que TODAS as fontes de dados devem implementar
 */
export interface IDataSource {
  // === Identificação ===
  getSourceName(): string;
  getSourceType(): DataSourceType;
  getSourceId(): string;

  // === Conectividade ===
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  testConnection(): Promise<ConnectionTestResult>;

  // === CRUD - Pacientes ===
  getPatientById(id: string): Promise<PatientData | null>;
  getPatientByPhone(phone: string): Promise<PatientData | null>;
  getPatientByEmail(email: string): Promise<PatientData | null>;
  getPatientByCPF(cpf: string): Promise<PatientData | null>;
  listPatients(filters?: PatientFilters): Promise<PatientData[]>;
  createPatient(data: Partial<PatientData>): Promise<PatientData>;
  updatePatient(id: string, data: Partial<PatientData>): Promise<PatientData>;
  deletePatient(id: string): Promise<boolean>;

  // === CRUD - Agendamentos ===
  getAppointmentById(id: string): Promise<AppointmentData | null>;
  listAppointments(filters?: AppointmentFilters): Promise<AppointmentData[]>;
  createAppointment(data: Partial<AppointmentData>): Promise<AppointmentData>;
  updateAppointment(id: string, data: Partial<AppointmentData>): Promise<AppointmentData>;
  deleteAppointment(id: string): Promise<boolean>;

  // === CRUD - Negócios ===
  getDealById(id: string): Promise<DealData | null>;
  listDeals(filters?: DealFilters): Promise<DealData[]>;
  createDeal(data: Partial<DealData>): Promise<DealData>;
  updateDeal(id: string, data: Partial<DealData>): Promise<DealData>;
  deleteDeal(id: string): Promise<boolean>;

  // === Sincronização ===
  syncSince(lastSyncDate: Date): Promise<SyncResult>;
  syncEntity(type: EntityType, id: string): Promise<SyncResult>;

  // === Metadados ===
  getSchema(): Promise<SourceSchema>;
  getFieldMappings(): Promise<FieldMapping[]>;
  setFieldMappings(mappings: FieldMapping[]): Promise<void>;

  // === Capacidades ===
  getCapabilities(): SourceCapabilities;
}

/**
 * Filtros para listagem de pacientes
 */
export interface PatientFilters {
  limit?: number;
  offset?: number;
  name?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  createdSince?: Date;
  createdUntil?: Date;
  modifiedSince?: Date;
  [key: string]: any;
}

/**
 * Filtros para listagem de agendamentos
 */
export interface AppointmentFilters {
  limit?: number;
  offset?: number;
  patientId?: string;
  status?: string;
  dateSince?: Date;
  dateUntil?: Date;
  [key: string]: any;
}

/**
 * Filtros para listagem de negócios
 */
export interface DealFilters {
  limit?: number;
  offset?: number;
  status?: string;
  stage?: string;
  minValue?: number;
  maxValue?: number;
  createdSince?: Date;
  createdUntil?: Date;
  [key: string]: any;
}
