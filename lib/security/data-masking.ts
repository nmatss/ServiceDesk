import { createHash } from 'crypto';

export interface MaskingRule {
  id: string;
  name: string;
  tableName: string;
  fieldName: string;
  maskingType: 'static' | 'shuffle' | 'substitution' | 'partial' | 'hash' | 'format_preserving' | 'custom';
  configuration: MaskingConfiguration;
  appliesTo: 'all' | 'roles' | 'conditions';
  roles?: string[];
  conditions?: string;
  isActive: boolean;
  priority: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface MaskingConfiguration {
  // Static masking
  staticValue?: string;

  // Partial masking
  visibleStart?: number;
  visibleEnd?: number;
  maskChar?: string;

  // Substitution
  substitutionMap?: Record<string, string>;

  // Format preserving
  preserveFormat?: boolean;
  formatPattern?: string;

  // Custom function
  customFunction?: string;

  // Hash configuration
  hashAlgorithm?: 'md5' | 'sha1' | 'sha256';
  hashSalt?: string;

  // Shuffle configuration
  shuffleScope?: 'field' | 'dataset';
  shuffleKey?: string;
}

export interface MaskingContext {
  userId: number;
  userRole: string;
  purpose: 'export' | 'display' | 'report' | 'api' | 'log';
  environment: 'production' | 'staging' | 'development' | 'test';
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface MaskingResult {
  originalValue: any;
  maskedValue: any;
  appliedRules: string[];
  maskingType: string;
}

class DataMaskingManager {
  private maskingRules = new Map<string, MaskingRule[]>();
  private cacheExpiry = 10 * 60 * 1000; // 10 minutes
  private lastCacheUpdate = 0;

  private readonly EMAIL_DOMAINS = [
    'example.com', 'sample.org', 'test.net', 'demo.co', 'masked.io'
  ];

  private readonly COMMON_NAMES = [
    'João Silva', 'Maria Santos', 'José Oliveira', 'Ana Costa', 'Carlos Pereira',
    'Fernanda Lima', 'Ricardo Souza', 'Juliana Ferreira', 'Paulo Rodrigues', 'Camila Alves'
  ];

  private readonly PHONE_PATTERNS = [
    '(11) 9####-####', '(21) 9####-####', '(31) 9####-####', '(41) 9####-####', '(51) 9####-####'
  ];

  /**
   * Apply data masking to a value based on configured rules
   */
  async maskValue(
    tableName: string,
    fieldName: string,
    value: any,
    context: MaskingContext
  ): Promise<MaskingResult> {
    try {
      const rules = await this.getApplicableRules(tableName, fieldName, context);

      if (rules.length === 0 || value === null || value === undefined) {
        return {
          originalValue: value,
          maskedValue: value,
          appliedRules: [],
          maskingType: 'none'
        };
      }

      // Apply the highest priority rule
      const rule = rules[0];
      const maskedValue = await this.applyMaskingRule(value, rule, context);

      return {
        originalValue: value,
        maskedValue,
        appliedRules: [rule.name],
        maskingType: rule.maskingType
      };
    } catch (error) {
      console.error('Error applying data masking:', error);
      return {
        originalValue: value,
        maskedValue: value,
        appliedRules: [],
        maskingType: 'error'
      };
    }
  }

  /**
   * Apply masking to multiple fields in a dataset
   */
  async maskDataset(
    tableName: string,
    dataset: any[],
    context: MaskingContext
  ): Promise<any[]> {
    if (!Array.isArray(dataset) || dataset.length === 0) {
      return dataset;
    }

    const fieldNames = Object.keys(dataset[0]);
    const maskedDataset = [];

    for (const row of dataset) {
      const maskedRow = { ...row };

      for (const fieldName of fieldNames) {
        const result = await this.maskValue(tableName, fieldName, row[fieldName], context);
        maskedRow[fieldName] = result.maskedValue;
      }

      maskedDataset.push(maskedRow);
    }

    return maskedDataset;
  }

  /**
   * Create a new masking rule
   */
  async createMaskingRule(rule: Omit<MaskingRule, 'id' | 'created_at' | 'updated_at'>): Promise<string | null> {
    try {
      // Validate the rule configuration
      const isValid = this.validateMaskingRule(rule);
      if (!isValid) {
        throw new Error('Invalid masking rule configuration');
      }

      const ruleId = this.generateRuleId();

      // In a real implementation, this would save to database
      // For now, we'll store in memory
      const fullRule: MaskingRule = {
        ...rule,
        id: ruleId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const key = `${rule.tableName}.${rule.fieldName}`;
      if (!this.maskingRules.has(key)) {
        this.maskingRules.set(key, []);
      }

      this.maskingRules.get(key)!.push(fullRule);
      this.sortRulesByPriority(key);

      return ruleId;
    } catch (error) {
      console.error('Error creating masking rule:', error);
      return null;
    }
  }

  /**
   * Apply automatic masking based on field patterns
   */
  async autoMask(value: any, fieldName: string): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    const stringValue = String(value);

    // Email detection and masking
    if (this.isEmail(stringValue) || fieldName.toLowerCase().includes('email')) {
      return this.maskEmail(stringValue);
    }

    // Phone number detection
    if (this.isPhoneNumber(stringValue) || fieldName.toLowerCase().includes('phone') || fieldName.toLowerCase().includes('telefone')) {
      return this.maskPhoneNumber(stringValue);
    }

    // CPF detection
    if (this.isCPF(stringValue) || fieldName.toLowerCase().includes('cpf')) {
      return this.maskCPF(stringValue);
    }

    // CNPJ detection
    if (this.isCNPJ(stringValue) || fieldName.toLowerCase().includes('cnpj')) {
      return this.maskCNPJ(stringValue);
    }

    // Credit card detection
    if (this.isCreditCard(stringValue) || fieldName.toLowerCase().includes('card') || fieldName.toLowerCase().includes('cartao')) {
      return this.maskCreditCard(stringValue);
    }

    // Name detection
    if (fieldName.toLowerCase().includes('name') || fieldName.toLowerCase().includes('nome')) {
      return this.maskName(stringValue);
    }

    // Address detection
    if (fieldName.toLowerCase().includes('address') || fieldName.toLowerCase().includes('endereco')) {
      return this.maskAddress(stringValue);
    }

    // Password detection
    if (fieldName.toLowerCase().includes('password') || fieldName.toLowerCase().includes('senha')) {
      return '*'.repeat(8);
    }

    return value;
  }

  /**
   * Create masked copy of database for testing/development
   */
  async createMaskedDatabase(
    sourceConfig: any,
    targetConfig: any,
    tables: string[]
  ): Promise<boolean> {
    // This would implement full database masking
    // For now, we'll just log the operation
    console.log('Creating masked database copy...');
    console.log('Source:', sourceConfig);
    console.log('Target:', targetConfig);
    console.log('Tables:', tables);

    // Implementation would:
    // 1. Connect to source database
    // 2. Copy schema to target
    // 3. Copy data with masking applied
    // 4. Update foreign key relationships
    // 5. Create indexes and constraints

    return true;
  }

  /**
   * Unmask data for authorized users
   */
  async unmaskValue(
    tableName: string,
    fieldName: string,
    maskedValue: any,
    originalValue: any,
    context: MaskingContext
  ): Promise<any> {
    // Check if user has permission to view unmasked data
    if (context.userRole === 'admin' || context.purpose === 'audit') {
      return originalValue;
    }

    // For some masking types, unmasking might be possible
    // But generally, masking should be one-way for security
    return maskedValue;
  }

  /**
   * Get applicable masking rules for field and context
   */
  private async getApplicableRules(
    tableName: string,
    fieldName: string,
    context: MaskingContext
  ): Promise<MaskingRule[]> {
    const key = `${tableName}.${fieldName}`;
    const rules = this.maskingRules.get(key) || [];

    return rules.filter(rule => {
      if (!rule.isActive) return false;

      switch (rule.appliesTo) {
        case 'all':
          return true;

        case 'roles':
          return rule.roles?.includes(context.userRole) || false;

        case 'conditions':
          return this.evaluateCondition(rule.conditions!, context);

        default:
          return false;
      }
    });
  }

  /**
   * Apply a specific masking rule to a value
   */
  private async applyMaskingRule(
    value: any,
    rule: MaskingRule,
    context: MaskingContext
  ): Promise<any> {
    const config = rule.configuration;
    const stringValue = String(value);

    switch (rule.maskingType) {
      case 'static':
        return config.staticValue || '[MASKED]';

      case 'partial':
        return this.applyPartialMasking(stringValue, config);

      case 'shuffle':
        return this.applyShuffle(stringValue, config);

      case 'substitution':
        return this.applySubstitution(stringValue, config);

      case 'hash':
        return this.applyHash(stringValue, config);

      case 'format_preserving':
        return this.applyFormatPreserving(stringValue, config);

      case 'custom':
        return this.applyCustomMasking(stringValue, config, context);

      default:
        return value;
    }
  }

  /**
   * Apply partial masking (show first/last N characters)
   */
  private applyPartialMasking(value: string, config: MaskingConfiguration): string {
    const visibleStart = config.visibleStart || 2;
    const visibleEnd = config.visibleEnd || 2;
    const maskChar = config.maskChar || '*';

    if (value.length <= visibleStart + visibleEnd) {
      return maskChar.repeat(value.length);
    }

    const start = value.substring(0, visibleStart);
    const end = value.substring(value.length - visibleEnd);
    const maskLength = value.length - visibleStart - visibleEnd;

    return start + maskChar.repeat(maskLength) + end;
  }

  /**
   * Apply shuffle masking
   */
  private applyShuffle(value: string, config: MaskingConfiguration): string {
    const chars = value.split('');

    // Simple shuffle using deterministic seed for consistency
    const seed = config.shuffleKey ? this.hashString(config.shuffleKey + value) : Math.random();
    const random = this.seededRandom(seed);

    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  /**
   * Apply substitution masking
   */
  private applySubstitution(value: string, config: MaskingConfiguration): string {
    if (!config.substitutionMap) {
      return value;
    }

    return config.substitutionMap[value] || value;
  }

  /**
   * Apply hash masking
   */
  private applyHash(value: string, config: MaskingConfiguration): string {
    const algorithm = config.hashAlgorithm || 'sha256';
    const salt = config.hashSalt || 'default-salt';

    return createHash(algorithm).update(value + salt).digest('hex');
  }

  /**
   * Apply format-preserving masking
   */
  private applyFormatPreserving(value: string, config: MaskingConfiguration): string {
    if (!config.preserveFormat) {
      return '*'.repeat(value.length);
    }

    return value.replace(/[a-zA-Z]/g, 'X').replace(/\d/g, '9');
  }

  /**
   * Apply custom masking function
   */
  private applyCustomMasking(
    value: string,
    config: MaskingConfiguration,
    context: MaskingContext
  ): string {
    // In a real implementation, this would safely execute custom functions
    // For security, we'll use predefined functions only

    switch (config.customFunction) {
      case 'brazilianName':
        return this.getRandomName();

      case 'brazilianPhone':
        return this.getRandomPhone();

      case 'emailDomain':
        return this.maskEmailDomain(value);

      default:
        return value;
    }
  }

  /**
   * Validate masking rule configuration
   */
  private validateMaskingRule(rule: Omit<MaskingRule, 'id' | 'created_at' | 'updated_at'>): boolean {
    // Basic validation
    if (!rule.tableName || !rule.fieldName || !rule.maskingType) {
      return false;
    }

    // Validate configuration based on masking type
    switch (rule.maskingType) {
      case 'static':
        return !!rule.configuration.staticValue;

      case 'partial':
        return (rule.configuration.visibleStart !== undefined) ||
               (rule.configuration.visibleEnd !== undefined);

      case 'hash':
        return ['md5', 'sha1', 'sha256'].includes(rule.configuration.hashAlgorithm || 'sha256');

      default:
        return true;
    }
  }

  /**
   * Evaluate masking condition
   */
  private evaluateCondition(condition: string, context: MaskingContext): boolean {
    // Simple condition evaluation
    // In production, use a proper expression evaluator

    if (condition.includes('purpose =')) {
      const purposeMatch = condition.match(/purpose = '([^']+)'/);
      return purposeMatch ? purposeMatch[1] === context.purpose : false;
    }

    if (condition.includes('environment =')) {
      const envMatch = condition.match(/environment = '([^']+)'/);
      return envMatch ? envMatch[1] === context.environment : false;
    }

    return true;
  }

  /**
   * Helper methods for automatic masking
   */
  private isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private isPhoneNumber(value: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$|^\([0-9]{2}\)\s[0-9]{4,5}-[0-9]{4}$/;
    return phoneRegex.test(value.replace(/\s/g, ''));
  }

  private isCPF(value: string): boolean {
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/;
    return cpfRegex.test(value);
  }

  private isCNPJ(value: string): boolean {
    const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/;
    return cnpjRegex.test(value);
  }

  private isCreditCard(value: string): boolean {
    const cardRegex = /^(?:\d{4}[-\s]?){3}\d{4}$/;
    return cardRegex.test(value);
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.length > 2
      ? localPart.slice(0, 2) + '*'.repeat(localPart.length - 2)
      : '*'.repeat(localPart.length);

    const randomDomain = this.EMAIL_DOMAINS[Math.floor(Math.random() * this.EMAIL_DOMAINS.length)];
    return `${maskedLocal}@${randomDomain}`;
  }

  private maskEmailDomain(email: string): string {
    const [localPart] = email.split('@');
    const randomDomain = this.EMAIL_DOMAINS[Math.floor(Math.random() * this.EMAIL_DOMAINS.length)];
    return `${localPart}@${randomDomain}`;
  }

  private maskPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) 9****-****`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ****-****`;
    }
    return '*'.repeat(phone.length);
  }

  private maskCPF(cpf: string): string {
    return cpf.replace(/\d(?=\d{2})/g, '*');
  }

  private maskCNPJ(cnpj: string): string {
    return cnpj.replace(/\d(?=\d{4})/g, '*');
  }

  private maskCreditCard(card: string): string {
    const cleaned = card.replace(/\D/g, '');
    return cleaned.replace(/\d(?=\d{4})/g, '*');
  }

  private maskName(name: string): string {
    return this.getRandomName();
  }

  private maskAddress(address: string): string {
    // Simple address masking - replace with generic address
    return 'Rua das Flores, 123 - Centro';
  }

  private getRandomName(): string {
    return this.COMMON_NAMES[Math.floor(Math.random() * this.COMMON_NAMES.length)];
  }

  private getRandomPhone(): string {
    const pattern = this.PHONE_PATTERNS[Math.floor(Math.random() * this.PHONE_PATTERNS.length)];
    return pattern.replace(/#/g, () => Math.floor(Math.random() * 10).toString());
  }

  private hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private seededRandom(seed: number): () => number {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  private generateRuleId(): string {
    return `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sortRulesByPriority(key: string): void {
    const rules = this.maskingRules.get(key);
    if (rules) {
      rules.sort((a, b) => b.priority - a.priority);
    }
  }

  /**
   * Initialize default masking rules
   */
  initializeDefaultRules(): void {
    const defaultRules = [
      {
        name: 'Email Partial Masking',
        tableName: 'users',
        fieldName: 'email',
        maskingType: 'partial' as const,
        configuration: { visibleStart: 2, visibleEnd: 0, maskChar: '*' },
        appliesTo: 'roles' as const,
        roles: ['user', 'agent'],
        isActive: true,
        priority: 100,
        created_by: 1
      },
      {
        name: 'Password Static Masking',
        tableName: 'users',
        fieldName: 'password_hash',
        maskingType: 'static' as const,
        configuration: { staticValue: '[ENCRYPTED]' },
        appliesTo: 'all' as const,
        isActive: true,
        priority: 100,
        created_by: 1
      },
      {
        name: 'Ticket Description Partial',
        tableName: 'tickets',
        fieldName: 'description',
        maskingType: 'partial' as const,
        configuration: { visibleStart: 10, visibleEnd: 0, maskChar: '*' },
        appliesTo: 'conditions' as const,
        conditions: "purpose = 'export'",
        isActive: true,
        priority: 80,
        created_by: 1
      }
    ];

    for (const rule of defaultRules) {
      this.createMaskingRule(rule);
    }

    console.log('Default data masking rules initialized');
  }
}

export const dataMasking = new DataMaskingManager();
export default dataMasking;