import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import logger from '../monitoring/structured-logger';
import {
  AIOperationType,
  AIOperationContext,
  AIFeedbackType,
  AIOperationMetadata
} from './types';

export interface AIAuditEntry {
  id?: number;
  operationType: AIOperationType;
  operationId: string; // Unique identifier for the operation
  entityType: string; // 'ticket', 'comment', 'kb_article', etc.
  entityId?: number;
  userId: number;
  userRole: string;
  sessionId?: string;
  ipAddress?: string;
  requestId?: string;
  organizationId: number;

  // Operation details
  action: string; // 'classify', 'suggest', 'generate_response', 'analyze_sentiment', etc.
  inputData: string; // JSON string with input parameters
  outputData: string; // JSON string with AI response
  metadata: AIOperationMetadata;

  // Results and feedback
  wasSuccessful: boolean;
  errorMessage?: string;
  userFeedback?: {
    type: AIFeedbackType;
    rating?: number; // 1-5 scale
    wasCorrect?: boolean;
    wasHelpful?: boolean;
    comment?: string;
    correctedValue?: string;
  };

  // Compliance and governance
  dataRetentionExpiresAt?: string;
  consentGiven?: boolean;
  processingLegalBasis: string; // 'legitimate_interest', 'consent', 'contract'

  // Timestamps
  createdAt: string;
  feedbackAt?: string;
}

export interface AIAuditQuery {
  operationType?: AIOperationType;
  entityType?: string;
  entityId?: number;
  userId?: number;
  organizationId?: number;
  dateFrom?: string;
  dateTo?: string;
  wasSuccessful?: boolean;
  hasFeedback?: boolean;
  limit?: number;
  offset?: number;
}

export interface AIAuditStats {
  totalOperations: number;
  operationsByType: Record<AIOperationType, number>;
  successRate: number;
  averageProcessingTime: number;
  totalTokensUsed: number;
  estimatedCostUSD: number;
  feedbackRate: number;
  averageFeedbackRating: number;
  userSatisfactionRate: number;
  complianceIssues: number;
}

export class AIAuditTrail {
  constructor(private db: Database<sqlite3.Database, sqlite3.Statement>) {}

  /**
   * Registra uma operação de IA no audit trail
   */
  async logOperation(
    operationType: AIOperationType,
    operationId: string,
    entityType: string,
    action: string,
    inputData: any,
    outputData: any,
    metadata: AIOperationMetadata,
    context: AIOperationContext,
    entityId?: number,
    wasSuccessful: boolean = true,
    errorMessage?: string
  ): Promise<number> {
    // Calcular data de expiração baseada no tipo de operação (LGPD compliance)
    const retentionPeriodMonths = this.getRetentionPeriod(operationType);
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + retentionPeriodMonths);

    const auditEntry = {
      operation_type: operationType,
      operation_id: operationId,
      entity_type: entityType,
      entity_id: entityId,
      user_id: context.userId,
      user_role: context.userRole,
      session_id: context.sessionId,
      ip_address: context.ipAddress,
      request_id: context.requestId,
      organization_id: context.organizationId || 1,
      action,
      input_data: JSON.stringify(inputData),
      output_data: JSON.stringify(outputData),
      metadata: JSON.stringify(metadata),
      was_successful: wasSuccessful,
      error_message: errorMessage,
      processing_legal_basis: this.determineLegalBasis(operationType),
      data_retention_expires_at: expirationDate.toISOString(),
      consent_given: true // Assumindo consentimento para operações do ServiceDesk
    };

    const result = await this.db.run(`
      INSERT INTO ai_audit_logs (
        operation_type, operation_id, entity_type, entity_id,
        user_id, user_role, session_id, ip_address, request_id, organization_id,
        action, input_data, output_data, metadata,
        was_successful, error_message, processing_legal_basis,
        data_retention_expires_at, consent_given
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      auditEntry.operation_type,
      auditEntry.operation_id,
      auditEntry.entity_type,
      auditEntry.entity_id,
      auditEntry.user_id,
      auditEntry.user_role,
      auditEntry.session_id,
      auditEntry.ip_address,
      auditEntry.request_id,
      auditEntry.organization_id,
      auditEntry.action,
      auditEntry.input_data,
      auditEntry.output_data,
      auditEntry.metadata,
      auditEntry.was_successful,
      auditEntry.error_message,
      auditEntry.processing_legal_basis,
      auditEntry.data_retention_expires_at,
      auditEntry.consent_given
    ]);

    return result.lastID!;
  }

  /**
   * Registra feedback do usuário sobre uma operação de IA
   */
  async logFeedback(
    auditId: number,
    feedbackType: AIFeedbackType,
    rating?: number,
    wasCorrect?: boolean,
    wasHelpful?: boolean,
    comment?: string,
    correctedValue?: string,
    feedbackBy?: number
  ): Promise<void> {
    const feedback = {
      type: feedbackType,
      rating,
      wasCorrect,
      wasHelpful,
      comment,
      correctedValue
    };

    await this.db.run(`
      UPDATE ai_audit_logs
      SET user_feedback = ?, feedback_by = ?, feedback_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [JSON.stringify(feedback), feedbackBy, auditId]);

    // Se feedback indica erro, criar entrada de treinamento
    if (wasCorrect === false || rating && rating <= 2) {
      await this.createTrainingDataFromFeedback(auditId, feedback);
    }
  }

  /**
   * Busca entradas do audit trail com filtros
   */
  async queryAuditTrail(query: AIAuditQuery): Promise<AIAuditEntry[]> {
    let sql = `
      SELECT * FROM ai_audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query.operationType) {
      sql += ` AND operation_type = ?`;
      params.push(query.operationType);
    }

    if (query.entityType) {
      sql += ` AND entity_type = ?`;
      params.push(query.entityType);
    }

    if (query.entityId) {
      sql += ` AND entity_id = ?`;
      params.push(query.entityId);
    }

    if (query.userId) {
      sql += ` AND user_id = ?`;
      params.push(query.userId);
    }

    if (query.organizationId) {
      sql += ` AND organization_id = ?`;
      params.push(query.organizationId);
    }

    if (query.dateFrom) {
      sql += ` AND created_at >= ?`;
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      sql += ` AND created_at <= ?`;
      params.push(query.dateTo);
    }

    if (query.wasSuccessful !== undefined) {
      sql += ` AND was_successful = ?`;
      params.push(query.wasSuccessful);
    }

    if (query.hasFeedback !== undefined) {
      sql += query.hasFeedback ? ` AND user_feedback IS NOT NULL` : ` AND user_feedback IS NULL`;
    }

    sql += ` ORDER BY created_at DESC`;

    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);

      if (query.offset) {
        sql += ` OFFSET ?`;
        params.push(query.offset);
      }
    }

    const rows = await this.db.all(sql, params);

    return rows.map(row => ({
      id: row.id,
      operationType: row.operation_type,
      operationId: row.operation_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      userId: row.user_id,
      userRole: row.user_role,
      sessionId: row.session_id,
      ipAddress: row.ip_address,
      requestId: row.request_id,
      organizationId: row.organization_id,
      action: row.action,
      inputData: row.input_data,
      outputData: row.output_data,
      metadata: JSON.parse(row.metadata || '{}'),
      wasSuccessful: row.was_successful,
      errorMessage: row.error_message,
      userFeedback: row.user_feedback ? JSON.parse(row.user_feedback) : undefined,
      dataRetentionExpiresAt: row.data_retention_expires_at,
      consentGiven: row.consent_given,
      processingLegalBasis: row.processing_legal_basis,
      createdAt: row.created_at,
      feedbackAt: row.feedback_at
    }));
  }

  /**
   * Obtém estatísticas do audit trail
   */
  async getAuditStats(
    dateFrom?: string,
    dateTo?: string,
    organizationId?: number
  ): Promise<AIAuditStats> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (dateFrom) {
      whereClause += ' AND created_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND created_at <= ?';
      params.push(dateTo);
    }

    if (organizationId) {
      whereClause += ' AND organization_id = ?';
      params.push(organizationId);
    }

    // Estatísticas básicas
    const basicStats = await this.db.get(`
      SELECT
        COUNT(*) as total_operations,
        AVG(CASE WHEN was_successful THEN 1.0 ELSE 0.0 END) as success_rate,
        COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as feedback_count
      FROM ai_audit_logs
      ${whereClause}
    `, params);

    // Operações por tipo
    const operationsByType = await this.db.all(`
      SELECT operation_type, COUNT(*) as count
      FROM ai_audit_logs
      ${whereClause}
      GROUP BY operation_type
    `, params);

    // Métricas de performance
    const performanceStats = await this.db.get(`
      SELECT
        AVG(JSON_EXTRACT(metadata, '$.processingTimeMs')) as avg_processing_time,
        SUM(JSON_EXTRACT(metadata, '$.inputTokens')) as total_input_tokens,
        SUM(JSON_EXTRACT(metadata, '$.outputTokens')) as total_output_tokens,
        SUM(JSON_EXTRACT(metadata, '$.estimatedCost')) as total_estimated_cost
      FROM ai_audit_logs
      ${whereClause}
    `, params);

    // Feedback e satisfação
    const feedbackStats = await this.db.get(`
      SELECT
        AVG(JSON_EXTRACT(user_feedback, '$.rating')) as avg_rating,
        AVG(CASE WHEN JSON_EXTRACT(user_feedback, '$.wasHelpful') = true THEN 1.0 ELSE 0.0 END) as satisfaction_rate
      FROM ai_audit_logs
      ${whereClause}
        AND user_feedback IS NOT NULL
    `, params);

    // Issues de compliance
    const complianceIssues = await this.db.get(`
      SELECT COUNT(*) as issues
      FROM ai_audit_logs
      ${whereClause}
        AND (consent_given = false OR data_retention_expires_at < datetime('now'))
    `, params);

    const operationsByTypeMap: Record<AIOperationType, number> = {
      classification: 0,
      suggestion: 0,
      response_generation: 0,
      sentiment_analysis: 0,
      duplicate_detection: 0,
      embedding_generation: 0,
      vector_search: 0
    };

    operationsByType.forEach(row => {
      operationsByTypeMap[row.operation_type as AIOperationType] = row.count;
    });

    return {
      totalOperations: basicStats.total_operations,
      operationsByType: operationsByTypeMap,
      successRate: basicStats.success_rate || 0,
      averageProcessingTime: performanceStats.avg_processing_time || 0,
      totalTokensUsed: (performanceStats.total_input_tokens || 0) + (performanceStats.total_output_tokens || 0),
      estimatedCostUSD: performanceStats.total_estimated_cost || 0,
      feedbackRate: basicStats.feedback_count / basicStats.total_operations || 0,
      averageFeedbackRating: feedbackStats.avg_rating || 0,
      userSatisfactionRate: feedbackStats.satisfaction_rate || 0,
      complianceIssues: complianceIssues.issues
    };
  }

  /**
   * Exporta dados de audit para compliance (LGPD)
   */
  async exportUserData(
    userId: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<AIAuditEntry[]> {
    return await this.queryAuditTrail({
      userId,
      dateFrom,
      dateTo
    });
  }

  /**
   * Remove dados expirados conforme LGPD
   */
  async cleanupExpiredData(): Promise<number> {
    const result = await this.db.run(`
      DELETE FROM ai_audit_logs
      WHERE data_retention_expires_at < datetime('now')
    `);

    return result.changes || 0;
  }

  /**
   * Obtém operações com problemas de compliance
   */
  async getComplianceIssues(): Promise<AIAuditEntry[]> {
    return await this.queryAuditTrail({
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Last 30 days
    });
  }

  /**
   * Gera relatório de uso de IA para auditoria
   */
  async generateAuditReport(
    organizationId: number,
    periodStart: string,
    periodEnd: string
  ): Promise<{
    summary: AIAuditStats;
    operationDetails: AIAuditEntry[];
    complianceStatus: {
      isCompliant: boolean;
      issues: string[];
      recommendations: string[];
    };
  }> {
    const summary = await this.getAuditStats(periodStart, periodEnd, organizationId);
    const operationDetails = await this.queryAuditTrail({
      organizationId,
      dateFrom: periodStart,
      dateTo: periodEnd,
      limit: 1000
    });

    const complianceIssues: string[] = [];
    const recommendations: string[] = [];

    if (summary.complianceIssues > 0) {
      complianceIssues.push(`${summary.complianceIssues} operações com problemas de retenção de dados`);
      recommendations.push('Revisar políticas de retenção de dados');
    }

    if (summary.feedbackRate < 0.1) {
      complianceIssues.push('Taxa de feedback muito baixa para validação de qualidade');
      recommendations.push('Implementar coleta automática de feedback');
    }

    if (summary.successRate < 0.9) {
      complianceIssues.push('Taxa de sucesso abaixo do esperado');
      recommendations.push('Revisar e retreinar modelos de IA');
    }

    return {
      summary,
      operationDetails,
      complianceStatus: {
        isCompliant: complianceIssues.length === 0,
        issues: complianceIssues,
        recommendations
      }
    };
  }

  /**
   * Determina o período de retenção baseado no tipo de operação
   */
  private getRetentionPeriod(operationType: AIOperationType): number {
    const retentionPeriods: Record<AIOperationType, number> = {
      classification: 24, // 2 anos
      suggestion: 12, // 1 ano
      response_generation: 6, // 6 meses
      sentiment_analysis: 12, // 1 ano (dados sensíveis)
      duplicate_detection: 6, // 6 meses
      embedding_generation: 24, // 2 anos (dados de treinamento)
      vector_search: 3 // 3 meses
    };

    return retentionPeriods[operationType] || 12;
  }

  /**
   * Determina a base legal para processamento dos dados
   */
  private determineLegalBasis(operationType: AIOperationType): string {
    // Para um sistema de ServiceDesk, geralmente é interesse legítimo
    // ou execução de contrato
    const legalBasisMap: Record<AIOperationType, string> = {
      classification: 'legitimate_interest',
      suggestion: 'legitimate_interest',
      response_generation: 'contract',
      sentiment_analysis: 'legitimate_interest',
      duplicate_detection: 'legitimate_interest',
      embedding_generation: 'legitimate_interest',
      vector_search: 'legitimate_interest'
    };

    return legalBasisMap[operationType] || 'legitimate_interest';
  }

  /**
   * Cria dados de treinamento a partir de feedback negativo
   */
  private async createTrainingDataFromFeedback(
    auditId: number,
    feedback: any
  ): Promise<void> {
    try {
      const auditEntry = await this.db.get(`
        SELECT * FROM ai_audit_logs WHERE id = ?
      `, [auditId]);

      if (!auditEntry) return;

      const inputData = JSON.parse(auditEntry.input_data);
      const outputData = JSON.parse(auditEntry.output_data);

      // Determinar o output correto baseado no feedback
      let correctedOutput = outputData;
      if (feedback.correctedValue) {
        correctedOutput = feedback.correctedValue;
      }

      await this.db.run(`
        INSERT INTO ai_training_data (
          input, output, feedback, model_version, data_type,
          quality_score, source_entity_type, source_entity_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        JSON.stringify(inputData),
        JSON.stringify(correctedOutput),
        JSON.stringify(feedback),
        '1.0',
        auditEntry.operation_type,
        feedback.rating ? feedback.rating / 5.0 : 0.5,
        auditEntry.entity_type,
        auditEntry.entity_id
      ]);
    } catch (error) {
      logger.error('Failed to create training data from feedback', error);
    }
  }
}

// Criar tabela de audit logs se não existir
export async function createAIAuditTable(db: Database<sqlite3.Database, sqlite3.Statement>): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      user_id INTEGER NOT NULL,
      user_role TEXT NOT NULL,
      session_id TEXT,
      ip_address TEXT,
      request_id TEXT,
      organization_id INTEGER DEFAULT 1,
      action TEXT NOT NULL,
      input_data TEXT NOT NULL,
      output_data TEXT NOT NULL,
      metadata TEXT,
      was_successful BOOLEAN DEFAULT TRUE,
      error_message TEXT,
      user_feedback TEXT, -- JSON
      feedback_by INTEGER,
      feedback_at DATETIME,
      processing_legal_basis TEXT NOT NULL,
      data_retention_expires_at DATETIME,
      consent_given BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (feedback_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_operation_type ON ai_audit_logs(operation_type);
    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_entity ON ai_audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user ON ai_audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_organization ON ai_audit_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created ON ai_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_retention ON ai_audit_logs(data_retention_expires_at);
    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_operation_id ON ai_audit_logs(operation_id);
  `);
}

export default AIAuditTrail;