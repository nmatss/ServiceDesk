/**
 * Comprehensive Workflow Engine Types
 * State-of-the-art workflow system with visual builder support
 */

export interface WorkflowDefinition {
  id: number;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  isTemplate: boolean;
  category: 'ticket_automation' | 'notification' | 'escalation' | 'approval' | 'integration' | 'ml_optimization';
  priority: number;
  triggerType: WorkflowTriggerType;
  triggerConditions: TriggerConditions;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  metadata: WorkflowMetadata;
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecutedAt?: Date;
  createdBy: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkflowTriggerType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'status_changed'
  | 'sla_warning'
  | 'time_based'
  | 'manual'
  | 'comment_added'
  | 'assignment_changed'
  | 'priority_changed'
  | 'category_changed'
  | 'webhook'
  | 'api_call'
  | 'user_action';

export interface TriggerConditions {
  filters: FilterCondition[];
  timeConstraints?: TimeConstraints;
  userConstraints?: UserConstraints;
  entityConstraints?: EntityConstraints;
  customScript?: string;
}

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'regex';
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
}

export interface TimeConstraints {
  businessHoursOnly?: boolean;
  allowedDaysOfWeek?: number[]; // 0-6, Sunday = 0
  allowedTimeRange?: {
    startHour: number;
    endHour: number;
  };
  timezone?: string;
  delay?: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks';
  };
}

export interface UserConstraints {
  roles?: string[];
  departments?: number[];
  permissions?: string[];
  excludeUsers?: number[];
  includeUsers?: number[];
}

export interface EntityConstraints {
  categories?: number[];
  priorities?: number[];
  statuses?: number[];
  assignees?: number[];
  reporters?: number[];
  customFields?: Record<string, any>;
}

// Workflow Nodes
export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'action'
  | 'condition'
  | 'approval'
  | 'delay'
  | 'parallel'
  | 'webhook'
  | 'script'
  | 'notification'
  | 'integration'
  | 'ml_prediction'
  | 'human_task'
  | 'loop'
  | 'subworkflow';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  position: { x: number; y: number };
  configuration: NodeConfiguration;
  timeout?: number; // minutes
  retryConfig?: RetryConfiguration;
  isOptional?: boolean;
  metadata?: Record<string, any>;
}

export interface NodeConfiguration {
  // Base configuration that all nodes have
  [key: string]: any;
}

// Specific Node Configurations
export interface StartNodeConfig extends NodeConfiguration {
  triggerType: WorkflowTriggerType;
  conditions: TriggerConditions;
  inputSchema?: Record<string, any>;
}

export interface ActionNodeConfig extends NodeConfiguration {
  actionType: 'assign' | 'update_status' | 'add_comment' | 'send_notification' | 'update_priority' | 'add_tag' | 'remove_tag' | 'escalate' | 'close_ticket' | 'create_subtask' | 'custom_script';
  parameters: Record<string, any>;
  outputMapping?: Record<string, string>;
}

export interface ConditionNodeConfig extends NodeConfiguration {
  conditionType: 'if_else' | 'switch' | 'expression';
  conditions: FilterCondition[];
  logicalOperator?: 'AND' | 'OR';
  customExpression?: string;
  outputPaths: {
    condition: string;
    targetNode: string;
  }[];
  defaultPath?: string;
}

export interface ApprovalNodeConfig extends NodeConfiguration {
  approvalType: 'single' | 'multiple' | 'majority' | 'unanimous';
  approvers: ApprovalTarget[];
  escalationConfig?: EscalationConfig;
  autoApproveAfter?: number; // hours
  allowDelegation?: boolean;
  requireComments?: boolean;
  customApprovalForm?: Record<string, any>;
}

export interface ApprovalTarget {
  type: 'user' | 'role' | 'department' | 'dynamic';
  value: string | number;
  order?: number;
  isOptional?: boolean;
}

export interface EscalationConfig {
  levels: EscalationLevel[];
  timeoutBehavior: 'auto_approve' | 'auto_reject' | 'escalate' | 'notify';
}

export interface EscalationLevel {
  timeoutHours: number;
  approvers: ApprovalTarget[];
  notificationTemplate?: string;
}

export interface NotificationNodeConfig extends NodeConfiguration {
  notificationType: 'email' | 'sms' | 'slack' | 'teams' | 'whatsapp' | 'push' | 'in_app';
  recipients: NotificationRecipient[];
  template: NotificationTemplate;
  deliveryOptions: DeliveryOptions;
}

export interface NotificationRecipient {
  type: 'user' | 'role' | 'email' | 'phone' | 'dynamic';
  value: string | number;
}

export interface NotificationTemplate {
  subject?: string;
  body: string;
  format: 'text' | 'html' | 'markdown';
  variables?: string[];
  attachments?: string[];
}

export interface DeliveryOptions {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryAttempts: number;
  retryDelay: number; // minutes
  deliveryWindow?: TimeConstraints;
}

export interface WebhookNodeConfig extends NodeConfiguration {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Record<string, string>;
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2';
    credentials: Record<string, string>;
  };
  payload?: Record<string, any>;
  expectedResponseCodes: number[];
  responseMapping?: Record<string, string>;
}

export interface ScriptNodeConfig extends NodeConfiguration {
  scriptType: 'javascript' | 'python' | 'sql' | 'custom';
  code: string;
  environment?: 'sandbox' | 'secure' | 'trusted';
  inputVariables: string[];
  outputVariables: string[];
  libraries?: string[];
  timeout?: number; // seconds
}

export interface MLPredictionNodeConfig extends NodeConfiguration {
  modelType: 'classification' | 'regression' | 'clustering' | 'recommendation';
  modelName: string;
  inputFeatures: string[];
  outputMapping: Record<string, string>;
  confidenceThreshold?: number;
  fallbackBehavior: 'continue' | 'skip' | 'fail' | 'default_value';
}

export interface HumanTaskNodeConfig extends NodeConfiguration {
  taskType: 'review' | 'data_entry' | 'verification' | 'decision' | 'custom';
  assignees: ApprovalTarget[];
  instructions: string;
  formSchema?: Record<string, any>;
  timeoutHours?: number;
  escalationConfig?: EscalationConfig;
}

export interface LoopNodeConfig extends NodeConfiguration {
  loopType: 'for_each' | 'while' | 'do_while' | 'fixed_count';
  condition?: FilterCondition[];
  iterationLimit: number;
  iterationVariable: string;
  dataSource: string; // Variable or expression that provides the collection
  parallelExecution?: boolean;
  continueOnError?: boolean;
}

export interface SubworkflowNodeConfig extends NodeConfiguration {
  workflowId: number;
  version?: number;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  inheritContext?: boolean;
  asyncExecution?: boolean;
}

export interface DelayNodeConfig extends NodeConfiguration {
  delayType: 'fixed' | 'dynamic' | 'business_hours' | 'until_date';
  amount?: number;
  unit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';
  dynamicExpression?: string;
  untilDate?: string; // ISO date string or expression
  businessHoursOnly?: boolean;
}

export interface EndNodeConfig extends NodeConfiguration {
  endType: 'success' | 'failure' | 'cancelled';
  outputData?: Record<string, any>;
  cleanupActions?: string[];
  notifications?: NotificationNodeConfig[];
}

// Workflow Edges
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  configuration: EdgeConfiguration;
  conditions?: FilterCondition[];
  priority?: number;
  metadata?: Record<string, any>;
}

export type EdgeType = 'default' | 'conditional' | 'error' | 'timeout' | 'loop' | 'parallel';

export interface EdgeConfiguration {
  label?: string;
  color?: string;
  animated?: boolean;
  style?: Record<string, any>;
  dataTransformation?: string; // JavaScript expression
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'min_length' | 'max_length' | 'pattern' | 'type' | 'custom';
  value?: any;
  message?: string;
}

// Workflow Variables
export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  defaultValue?: any;
  description?: string;
  scope: 'global' | 'local' | 'output';
  isRequired?: boolean;
  validation?: ValidationRule[];
}

// Workflow Metadata
export interface WorkflowMetadata {
  tags: string[];
  documentation?: string;
  version: string;
  author: string;
  lastModifiedBy: string;
  changeLog: ChangeLogEntry[];
  dependencies: string[];
  testCases: TestCase[];
  performance: PerformanceMetrics;
}

export interface ChangeLogEntry {
  version: string;
  date: Date;
  author: string;
  changes: string[];
  breaking?: boolean;
}

export interface TestCase {
  name: string;
  description: string;
  input: Record<string, any>;
  expectedOutput: Record<string, any>;
  status: 'pending' | 'passed' | 'failed';
  lastRun?: Date;
}

export interface PerformanceMetrics {
  avgExecutionTime: number; // milliseconds
  maxExecutionTime: number;
  minExecutionTime: number;
  successRate: number; // percentage
  errorRate: number; // percentage
  resourceUsage: ResourceUsage;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  networkKB: number;
  storageKB: number;
}

// Retry Configuration
export interface RetryConfiguration {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential' | 'random';
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  multiplier?: number; // for exponential backoff
  retryConditions: RetryCondition[];
}

export interface RetryCondition {
  errorType: 'timeout' | 'http_error' | 'network_error' | 'validation_error' | 'custom';
  errorCodes?: string[];
  shouldRetry: boolean;
}

// Workflow Execution
export interface WorkflowExecution {
  id: number;
  workflowId: number;
  triggerEntityType: string;
  triggerEntityId?: number;
  triggerUserId?: number;
  triggerData: Record<string, any>;
  status: ExecutionStatus;
  currentStepId?: string;
  progressPercentage: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  executionLog: ExecutionLogEntry[];
  retryCount: number;
  variables: Record<string, any>;
  metadata: ExecutionMetadata;
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'waiting_input'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'escalated';

export interface ExecutionLogEntry {
  stepId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, any>;
  duration?: number; // milliseconds
}

export interface ExecutionMetadata {
  triggeredBy: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
  correlationId: string;
  parentExecution?: number;
  childExecutions: number[];
  tags: string[];
}

// Workflow Step Execution
export interface WorkflowStepExecution {
  id: number;
  executionId: number;
  stepId: string;
  status: StepExecutionStatus;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  executionTimeMs?: number;
  retryCount: number;
  metadata: StepExecutionMetadata;
}

export type StepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'timeout'
  | 'cancelled'
  | 'waiting_approval'
  | 'waiting_input';

export interface StepExecutionMetadata {
  retryHistory: RetryAttempt[];
  resourceUsage: ResourceUsage;
  additionalData: Record<string, any>;
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: Date;
  reason: string;
  result: 'success' | 'failure' | 'timeout';
  duration?: number;
}

// Workflow Approval
export interface WorkflowApproval {
  id: number;
  executionId: number;
  stepId: string;
  approverId: number;
  status: ApprovalStatus;
  comments?: string;
  approvedAt?: Date;
  metadata: ApprovalMetadata;
  createdAt: Date;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'delegated' | 'timeout';

export interface ApprovalMetadata {
  originalApprover?: number;
  delegatedTo?: number;
  delegationReason?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  attachments: string[];
}

// AI/ML Integration
export interface MLModelConfiguration {
  name: string;
  version: string;
  type: 'classification' | 'regression' | 'clustering' | 'recommendation' | 'nlp';
  endpoint: string;
  authentication: Record<string, string>;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  preprocessingSteps: string[];
  postprocessingSteps: string[];
}

export interface MLPredictionResult {
  modelName: string;
  prediction: any;
  confidence: number;
  features: Record<string, any>;
  reasoning?: string;
  alternativePredictions?: Array<{
    prediction: any;
    confidence: number;
  }>;
}

// A/B Testing
export interface ABTestConfiguration {
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficAllocation: number; // percentage
  targetMetrics: string[];
  duration: number; // days
  isActive: boolean;
}

export interface ABTestVariant {
  name: string;
  workflowId: number;
  trafficPercentage: number;
  isControl: boolean;
}

// Analytics & Monitoring
export interface WorkflowAnalytics {
  workflowId: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: WorkflowMetrics;
  stepAnalytics: StepAnalytics[];
  performanceTrends: PerformanceTrend[];
  errorAnalysis: ErrorAnalysis;
  userSatisfaction: SatisfactionMetrics;
}

export interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  medianExecutionTime: number;
  p95ExecutionTime: number;
  throughputPerHour: number;
  errorRate: number;
  retryRate: number;
}

export interface StepAnalytics {
  stepId: string;
  stepName: string;
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  errorCount: number;
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

export interface PerformanceTrend {
  timestamp: Date;
  executionTime: number;
  successRate: number;
  throughput: number;
  errorRate: number;
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByStep: Record<string, number>;
  topErrorMessages: Array<{
    message: string;
    count: number;
    percentage: number;
    firstOccurrence: Date;
    lastOccurrence: Date;
  }>;
  errorTrends: Array<{
    timestamp: Date;
    errorCount: number;
    errorRate: number;
  }>;
}

export interface SatisfactionMetrics {
  averageRating: number;
  totalResponses: number;
  ratingDistribution: Record<number, number>;
  comments: Array<{
    rating: number;
    comment: string;
    timestamp: Date;
    userId: number;
  }>;
}

// Queue System
export interface WorkflowQueue {
  name: string;
  priority: number;
  maxConcurrency: number;
  retryConfig: RetryConfiguration;
  deadLetterQueue?: string;
  processingOptions: QueueProcessingOptions;
}

export interface QueueProcessingOptions {
  batchSize: number;
  processingTimeout: number; // milliseconds
  visibilityTimeout: number; // milliseconds
  messageRetention: number; // hours
  enableDLQ: boolean;
  monitoringEnabled: boolean;
}

// Event System
export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  workflowId?: number;
  executionId?: number;
  stepId?: string;
  timestamp: Date;
  payload: Record<string, any>;
  source: string;
  correlationId?: string;
  metadata: Record<string, any>;
}

export type WorkflowEventType =
  | 'workflow_triggered'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'approval_requested'
  | 'approval_received'
  | 'timeout_occurred'
  | 'error_occurred'
  | 'retry_attempted'
  | 'escalation_triggered';

// Integration with External Systems
export interface ExternalIntegration {
  id: number;
  name: string;
  type: 'webhook' | 'api' | 'database' | 'file_system' | 'message_queue' | 'custom';
  configuration: IntegrationConfiguration;
  healthCheck: HealthCheckConfig;
  isActive: boolean;
  lastSync?: Date;
  syncStatus: 'success' | 'failure' | 'pending';
}

export interface IntegrationConfiguration {
  endpoint?: string;
  authentication: Record<string, string>;
  timeout: number;
  retryConfig: RetryConfiguration;
  rateLimiting?: RateLimitConfig;
  dataMapping: DataMapping;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  backoffStrategy: 'fixed' | 'exponential';
}

export interface DataMapping {
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  transformationRules: TransformationRule[];
}

export interface TransformationRule {
  field: string;
  operation: 'format_date' | 'uppercase' | 'lowercase' | 'trim' | 'replace' | 'calculate' | 'custom';
  parameters?: Record<string, any>;
  condition?: FilterCondition;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMinutes: number;
  timeoutSeconds: number;
  healthCheckUrl?: string;
  expectedResponse?: any;
  failureThreshold: number;
  recoveryThreshold: number;
}

// Workflow Templates and Marketplace
export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  tags: string[];
  industry?: string;
  useCase: string;
  complexity: 'simple' | 'intermediate' | 'advanced';
  workflowDefinition: Partial<WorkflowDefinition>;
  installationGuide: string;
  documentation: string;
  rating: number;
  downloadCount: number;
  author: {
    name: string;
    organization?: string;
    verified: boolean;
  };
  screenshots: string[];
  requirements: string[];
  compatibility: string[];
  license: string;
  price: number; // in cents, 0 for free
  createdAt: Date;
  updatedAt: Date;
}

// Export all types
export type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowStepExecution,
  WorkflowApproval,
  WorkflowAnalytics,
  WorkflowEvent,
  WorkflowTemplate
};