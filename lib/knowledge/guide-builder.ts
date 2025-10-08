// Guide builder para step-by-step guides interativos
import { Configuration, OpenAIApi } from 'openai';
import { db } from '../db/connection';
import { logger } from '../monitoring/logger';

interface GuideStep {
  id: string;
  title: string;
  description: string;
  content: string;
  order: number;
  estimated_time_minutes: number;
  prerequisites: string[];
  validation_criteria: string;
  troubleshooting: string[];
  media_suggestions: MediaSuggestion[];
  next_steps: string[];
  alternative_approaches: string[];
}

interface MediaSuggestion {
  type: 'screenshot' | 'video' | 'diagram' | 'code';
  description: string;
  alt_text: string;
  placement: 'before' | 'after' | 'inline';
}

interface InteractiveGuide {
  id?: number;
  title: string;
  summary: string;
  description: string;
  category_id: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_total_time: number;
  prerequisites: string[];
  learning_objectives: string[];
  steps: GuideStep[];
  resources: Resource[];
  related_guides: number[];
  tags: string[];
  metadata: {
    source_tickets: number[];
    confidence_score: number;
    generation_method: string;
    last_validated: string;
    completion_rate?: number;
    user_feedback_score?: number;
  };
}

interface Resource {
  type: 'link' | 'document' | 'tool' | 'reference';
  title: string;
  url?: string;
  description: string;
}

interface GuideTemplate {
  type: string;
  name: string;
  description: string;
  structure: StepTemplate[];
  validation_rules: string[];
}

interface StepTemplate {
  title_pattern: string;
  content_structure: string[];
  required_elements: string[];
  estimated_time_range: { min: number; max: number };
}

interface UserProgress {
  user_id: number;
  guide_id: number;
  current_step: number;
  completed_steps: number[];
  started_at: string;
  last_activity: string;
  completion_percentage: number;
  feedback: Array<{
    step_id: string;
    rating: number;
    comment?: string;
    difficulty_rating: number;
  }>;
}

export class GuideBuilder {
  private openai: OpenAIApi;
  private templates: Map<string, GuideTemplate> = new Map();

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);

    this.initializeTemplates();
  }

  /**
   * Inicializa templates de guias
   */
  private initializeTemplates(): void {
    const templates: GuideTemplate[] = [
      {
        type: 'technical_setup',
        name: 'Configuração Técnica',
        description: 'Guia para configuração de sistemas, software e ferramentas',
        structure: [
          {
            title_pattern: 'Preparação do Ambiente',
            content_structure: ['verificações iniciais', 'downloads necessários', 'backups'],
            required_elements: ['prerequisites', 'validation'],
            estimated_time_range: { min: 5, max: 15 }
          },
          {
            title_pattern: 'Instalação/Configuração',
            content_structure: ['passos detalhados', 'comandos', 'configurações'],
            required_elements: ['step-by-step', 'validation', 'troubleshooting'],
            estimated_time_range: { min: 10, max: 30 }
          },
          {
            title_pattern: 'Verificação e Testes',
            content_structure: ['testes de funcionamento', 'resolução de problemas'],
            required_elements: ['validation', 'troubleshooting'],
            estimated_time_range: { min: 5, max: 15 }
          }
        ],
        validation_rules: [
          'Cada passo deve ter critério de validação',
          'Incluir comandos exatos quando aplicável',
          'Prover alternativas para diferentes sistemas'
        ]
      },
      {
        type: 'process_workflow',
        name: 'Fluxo de Processo',
        description: 'Guia para processos de negócio e workflows',
        structure: [
          {
            title_pattern: 'Preparação e Contexto',
            content_structure: ['objetivo', 'papéis envolvidos', 'recursos necessários'],
            required_elements: ['prerequisites', 'roles'],
            estimated_time_range: { min: 2, max: 10 }
          },
          {
            title_pattern: 'Execução do Processo',
            content_structure: ['fluxo principal', 'pontos de decisão', 'aprovações'],
            required_elements: ['decision-points', 'validation'],
            estimated_time_range: { min: 15, max: 60 }
          },
          {
            title_pattern: 'Finalização e Acompanhamento',
            content_structure: ['checklist final', 'documentação', 'próximos passos'],
            required_elements: ['checklist', 'documentation'],
            estimated_time_range: { min: 5, max: 20 }
          }
        ],
        validation_rules: [
          'Definir claramente papéis e responsabilidades',
          'Incluir pontos de aprovação/validação',
          'Documentar exceções e casos especiais'
        ]
      },
      {
        type: 'troubleshooting',
        name: 'Diagnóstico e Solução',
        description: 'Guia para diagnóstico e resolução de problemas',
        structure: [
          {
            title_pattern: 'Identificação do Problema',
            content_structure: ['sintomas', 'coleta de informações', 'diagnóstico inicial'],
            required_elements: ['symptoms', 'diagnostic-steps'],
            estimated_time_range: { min: 5, max: 15 }
          },
          {
            title_pattern: 'Análise e Diagnóstico',
            content_structure: ['ferramentas de diagnóstico', 'análise de logs', 'teste de hipóteses'],
            required_elements: ['tools', 'analysis', 'validation'],
            estimated_time_range: { min: 10, max: 30 }
          },
          {
            title_pattern: 'Implementação da Solução',
            content_structure: ['passos da solução', 'verificação', 'prevenção'],
            required_elements: ['solution-steps', 'verification', 'prevention'],
            estimated_time_range: { min: 5, max: 25 }
          }
        ],
        validation_rules: [
          'Começar sempre pelo mais simples',
          'Incluir múltiplas abordagens de solução',
          'Documentar como prevenir recorrência'
        ]
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.type, template);
    });
  }

  /**
   * Gera guia interativo baseado em tickets
   */
  async generateInteractiveGuide(request: {
    ticket_ids?: number[];
    category_id?: number;
    guide_type: string;
    title?: string;
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    target_audience?: string;
  }): Promise<InteractiveGuide> {
    try {
      logger.info(`Gerando guia interativo tipo: ${request.guide_type}`);

      // 1. Analisa tickets fonte
      const sourceData = await this.analyzeSourceTickets(request);

      // 2. Seleciona template apropriado
      const template = this.templates.get(request.guide_type);
      if (!template) {
        throw new Error(`Template ${request.guide_type} não encontrado`);
      }

      // 3. Gera estrutura do guia
      const guideStructure = await this.generateGuideStructure(sourceData, template, request);

      // 4. Gera passos detalhados
      const steps = await this.generateDetailedSteps(guideStructure, sourceData, template);

      // 5. Gera recursos e objetivos
      const { resources, objectives } = await this.generateResourcesAndObjectives(sourceData, steps);

      // 6. Monta guia final
      const guide: InteractiveGuide = {
        title: request.title || guideStructure.title,
        summary: guideStructure.summary,
        description: guideStructure.description,
        category_id: request.category_id || sourceData.category_id,
        difficulty_level: request.difficulty_level || this.inferDifficultyLevel(sourceData, steps),
        estimated_total_time: steps.reduce((total, step) => total + step.estimated_time_minutes, 0),
        prerequisites: guideStructure.prerequisites,
        learning_objectives: objectives,
        steps: steps,
        resources: resources,
        related_guides: [], // Será populado após salvar
        tags: this.generateGuideTags(sourceData, steps),
        metadata: {
          source_tickets: sourceData.ticket_ids,
          confidence_score: this.calculateGuideConfidence(sourceData, steps),
          generation_method: 'ai_automated',
          last_validated: new Date().toISOString()
        }
      };

      logger.info(`Guia gerado: ${guide.title} com ${guide.steps.length} passos`);
      return guide;

    } catch (error) {
      logger.error('Erro ao gerar guia interativo', error);
      throw error;
    }
  }

  /**
   * Analisa tickets fonte para extração de dados
   */
  private async analyzeSourceTickets(request: any): Promise<any> {
    let sql = `
      SELECT
        t.id,
        t.title,
        t.description,
        t.category_id,
        c.name as category_name,
        GROUP_CONCAT(com.content, ' | ') as resolution_steps,
        COUNT(DISTINCT com.id) as solution_steps_count,
        AVG(ss.rating) as avg_satisfaction
      FROM tickets t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN comments com ON t.id = com.ticket_id
        AND com.user_id IN (SELECT id FROM users WHERE role IN ('admin', 'agent'))
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      WHERE t.resolved_at IS NOT NULL
    `;

    const params: any[] = [];

    if (request.ticket_ids && request.ticket_ids.length > 0) {
      sql += ` AND t.id IN (${request.ticket_ids.map(() => '?').join(',')})`;
      params.push(...request.ticket_ids);
    }

    if (request.category_id) {
      sql += ` AND t.category_id = ?`;
      params.push(request.category_id);
    }

    sql += `
      GROUP BY t.id
      HAVING resolution_steps IS NOT NULL
      ORDER BY solution_steps_count DESC, avg_satisfaction DESC
      LIMIT 10
    `;

    const tickets = await db.all(sql, params);

    if (tickets.length === 0) {
      throw new Error('Nenhum ticket adequado encontrado para geração de guia');
    }

    // Analisa padrões comuns
    const commonPatterns = this.extractCommonPatterns(tickets);
    const complexityIndicators = this.analyzeComplexity(tickets);

    return {
      ticket_ids: tickets.map(t => t.id),
      category_id: tickets[0].category_id,
      category_name: tickets[0].category_name,
      tickets: tickets,
      common_patterns: commonPatterns,
      complexity: complexityIndicators,
      avg_satisfaction: tickets.reduce((sum, t) => sum + (t.avg_satisfaction || 3), 0) / tickets.length
    };
  }

  /**
   * Extrai padrões comuns dos tickets
   */
  private extractCommonPatterns(tickets: any[]): any {
    const allSteps = tickets
      .map(t => t.resolution_steps)
      .join(' | ')
      .split(' | ')
      .filter(step => step.trim().length > 20);

    // Agrupa passos similares
    const stepGroups = this.groupSimilarSteps(allSteps);

    // Identifica sequência mais comum
    const commonSequence = this.findCommonSequence(tickets);

    return {
      common_steps: stepGroups.slice(0, 8),
      typical_sequence: commonSequence,
      recurring_issues: this.findRecurringIssues(tickets)
    };
  }

  /**
   * Agrupa passos similares
   */
  private groupSimilarSteps(steps: string[]): Array<{ pattern: string; frequency: number; examples: string[] }> {
    const groups: Map<string, string[]> = new Map();

    for (const step of steps) {
      const keywords = this.extractStepKeywords(step);
      const pattern = keywords.slice(0, 2).join(' ');

      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern)!.push(step);
    }

    return Array.from(groups.entries())
      .map(([pattern, examples]) => ({
        pattern,
        frequency: examples.length,
        examples: examples.slice(0, 3)
      }))
      .filter(group => group.frequency > 1)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extrai palavras-chave de um passo
   */
  private extractStepKeywords(step: string): string[] {
    const actionWords = [
      'acessar', 'clicar', 'digitar', 'selecionar', 'confirmar', 'verificar',
      'instalar', 'configurar', 'executar', 'abrir', 'fechar', 'salvar'
    ];

    const words = step.toLowerCase().split(/\s+/);
    const keywords: string[] = [];

    // Prioriza palavras de ação
    for (const word of words) {
      if (actionWords.includes(word)) {
        keywords.push(word);
      }
    }

    // Adiciona substantivos importantes
    const nouns = words.filter(word =>
      word.length > 4 &&
      !actionWords.includes(word) &&
      !/^(o|a|e|de|do|da|em|um|uma|para|com|por)$/.test(word)
    );

    keywords.push(...nouns.slice(0, 3));
    return keywords.slice(0, 5);
  }

  /**
   * Encontra sequência comum de resolução
   */
  private findCommonSequence(tickets: any[]): string[] {
    // Simplificado: retorna sequência baseada em palavras-chave frequentes
    const sequences = tickets.map(t => {
      if (!t.resolution_steps) return [];
      return t.resolution_steps.split(' | ').map(step => this.extractStepKeywords(step)[0]).filter(Boolean);
    });

    const commonSequence: string[] = [];
    const maxLength = Math.max(...sequences.map(s => s.length));

    for (let i = 0; i < maxLength; i++) {
      const stepCounts: Record<string, number> = {};

      sequences.forEach(seq => {
        if (seq[i]) {
          stepCounts[seq[i]] = (stepCounts[seq[i]] || 0) + 1;
        }
      });

      const mostCommon = Object.entries(stepCounts)
        .sort(([,a], [,b]) => b - a)[0];

      if (mostCommon && mostCommon[1] > 1) {
        commonSequence.push(mostCommon[0]);
      }
    }

    return commonSequence.slice(0, 6);
  }

  /**
   * Encontra problemas recorrentes
   */
  private findRecurringIssues(tickets: any[]): string[] {
    const issues = tickets.map(t => t.title.toLowerCase());
    const keywords: Record<string, number> = {};

    issues.forEach(title => {
      const words = title.split(/\s+/).filter(word => word.length > 4);
      words.forEach(word => {
        keywords[word] = (keywords[word] || 0) + 1;
      });
    });

    return Object.entries(keywords)
      .filter(([,count]) => count > 1)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Analisa complexidade dos tickets
   */
  private analyzeComplexity(tickets: any[]): any {
    const avgStepsCount = tickets.reduce((sum, t) => sum + (t.solution_steps_count || 0), 0) / tickets.length;
    const avgDescriptionLength = tickets.reduce((sum, t) => sum + t.description.length, 0) / tickets.length;

    let complexity: 'low' | 'medium' | 'high' = 'medium';

    if (avgStepsCount <= 3 && avgDescriptionLength < 200) {
      complexity = 'low';
    } else if (avgStepsCount >= 8 || avgDescriptionLength > 500) {
      complexity = 'high';
    }

    return {
      level: complexity,
      avg_steps: Math.round(avgStepsCount),
      avg_description_length: Math.round(avgDescriptionLength),
      estimated_time_per_step: this.estimateTimePerStep(complexity)
    };
  }

  /**
   * Estima tempo por passo baseado na complexidade
   */
  private estimateTimePerStep(complexity: string): number {
    const baseTime = { low: 3, medium: 5, high: 8 };
    return baseTime[complexity as keyof typeof baseTime] || 5;
  }

  /**
   * Gera estrutura básica do guia
   */
  private async generateGuideStructure(sourceData: any, template: GuideTemplate, request: any): Promise<any> {
    try {
      const prompt = `
Baseado nestes dados de tickets resolvidos da categoria "${sourceData.category_name}", crie a estrutura de um guia "${template.name}":

Dados dos tickets:
${JSON.stringify({
  category: sourceData.category_name,
  common_patterns: sourceData.common_patterns,
  complexity: sourceData.complexity,
  sample_tickets: sourceData.tickets.slice(0, 3).map((t: any) => ({
    title: t.title,
    description: t.description.substring(0, 200)
  }))
}, null, 2)}

Gere uma resposta em JSON:
{
  "title": "Título claro e descritivo do guia",
  "summary": "Resumo do que o usuário aprenderá (150 chars)",
  "description": "Descrição detalhada do guia e seus objetivos",
  "prerequisites": ["Pré-requisito 1", "Pré-requisito 2"],
  "main_sections": [
    {
      "section_title": "Nome da seção",
      "description": "O que esta seção ensina",
      "estimated_time": 10
    }
  ]
}

Diretrizes:
- Título deve ser acionável ("Como fazer X" ou "Guia para Y")
- Máximo 5 seções principais
- Pré-requisitos específicos e verificáveis
- Tempo estimado realista
`;

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é especialista em criar guias técnicos estruturados. Responda sempre em JSON válido e português.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('IA não gerou estrutura');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta não está em formato JSON válido');
      }

      return JSON.parse(jsonMatch[0]);

    } catch (error) {
      logger.error('Erro ao gerar estrutura do guia', error);
      throw error;
    }
  }

  /**
   * Gera passos detalhados do guia
   */
  private async generateDetailedSteps(
    structure: any,
    sourceData: any,
    template: GuideTemplate
  ): Promise<GuideStep[]> {
    const steps: GuideStep[] = [];

    for (let i = 0; i < structure.main_sections.length; i++) {
      const section = structure.main_sections[i];

      try {
        const stepDetails = await this.generateStepDetails(section, sourceData, template, i + 1);
        steps.push(...stepDetails);

        // Pausa entre gerações
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error(`Erro ao gerar passo ${i + 1}`, error);
        continue;
      }
    }

    return steps;
  }

  /**
   * Gera detalhes de um passo específico
   */
  private async generateStepDetails(
    section: any,
    sourceData: any,
    template: GuideTemplate,
    stepNumber: number
  ): Promise<GuideStep[]> {
    try {
      const relevantTickets = sourceData.tickets
        .filter((t: any) => this.isTicketRelevantToSection(t, section))
        .slice(0, 3);

      const prompt = `
Crie passos detalhados para a seção "${section.section_title}" de um guia ${template.name}.

Contexto da seção:
${section.description}

Tickets relacionados:
${relevantTickets.map((t: any) => `
Ticket: ${t.title}
Resolução: ${t.resolution_steps}
`).join('\n')}

Gere resposta em JSON:
{
  "steps": [
    {
      "title": "Nome do passo",
      "description": "Descrição do que o usuário fará",
      "content": "Instruções detalhadas em markdown",
      "estimated_time_minutes": 5,
      "prerequisites": ["Pré-requisito específico"],
      "validation_criteria": "Como saber que o passo foi concluído com sucesso",
      "troubleshooting": ["Problema comum 1: Solução", "Problema comum 2: Solução"],
      "media_suggestions": [
        {
          "type": "screenshot",
          "description": "Captura da tela mostrando X",
          "alt_text": "Texto alternativo",
          "placement": "after"
        }
      ],
      "next_steps": ["O que fazer após este passo"],
      "alternative_approaches": ["Abordagem alternativa se a principal não funcionar"]
    }
  ]
}

Diretrizes:
- Máximo 3 passos por seção
- Instruções específicas e acionáveis
- Incluir comandos/códigos quando necessário
- Critérios de validação verificáveis
- Alternativas para diferentes cenários
`;

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você cria guias técnicos detalhados. Responda em JSON válido com instruções claras e acionáveis.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 2000
      });

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('IA não gerou passos');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta não está em formato JSON válido');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return parsed.steps.map((step: any, index: number) => ({
        id: `step_${stepNumber}_${index + 1}`,
        order: (stepNumber - 1) * 10 + index + 1,
        ...step
      }));

    } catch (error) {
      logger.error('Erro ao gerar detalhes do passo', error);
      return [];
    }
  }

  /**
   * Verifica se ticket é relevante para a seção
   */
  private isTicketRelevantToSection(ticket: any, section: any): boolean {
    const sectionKeywords = section.section_title.toLowerCase().split(/\s+/);
    const ticketText = `${ticket.title} ${ticket.description}`.toLowerCase();

    return sectionKeywords.some(keyword => ticketText.includes(keyword));
  }

  /**
   * Gera recursos e objetivos de aprendizado
   */
  private async generateResourcesAndObjectives(sourceData: any, steps: GuideStep[]): Promise<{
    resources: Resource[];
    objectives: string[];
  }> {
    // Recursos baseados no conteúdo dos passos
    const resources: Resource[] = [
      {
        type: 'reference',
        title: `Documentação oficial - ${sourceData.category_name}`,
        description: 'Documentação técnica oficial para referência'
      }
    ];

    // Extrai ferramentas mencionadas nos passos
    const mentionedTools = new Set<string>();
    steps.forEach(step => {
      const toolMatches = step.content.match(/(?:usando|utilize|acesse|instale)\s+([A-Za-z]+)/gi);
      if (toolMatches) {
        toolMatches.forEach(match => {
          const tool = match.split(/\s+/).pop();
          if (tool && tool.length > 3) {
            mentionedTools.add(tool);
          }
        });
      }
    });

    mentionedTools.forEach(tool => {
      resources.push({
        type: 'tool',
        title: tool,
        description: `Ferramenta necessária: ${tool}`
      });
    });

    // Objetivos baseados nos passos
    const objectives = steps
      .map(step => `Compreender como ${step.title.toLowerCase()}`)
      .slice(0, 5);

    objectives.unshift(`Dominar o processo completo de ${sourceData.category_name.toLowerCase()}`);

    return { resources, objectives };
  }

  /**
   * Infere nível de dificuldade
   */
  private inferDifficultyLevel(sourceData: any, steps: GuideStep[]): 'beginner' | 'intermediate' | 'advanced' {
    let complexity = 0;

    // Baseado no número de passos
    complexity += Math.min(steps.length / 5, 1);

    // Baseado no tempo estimado
    const totalTime = steps.reduce((sum, step) => sum + step.estimated_time_minutes, 0);
    complexity += Math.min(totalTime / 60, 1);

    // Baseado na complexidade dos tickets fonte
    if (sourceData.complexity.level === 'high') complexity += 0.5;
    else if (sourceData.complexity.level === 'low') complexity -= 0.3;

    // Baseado em menções técnicas
    const technicalTerms = steps.reduce((count, step) => {
      const technicalPatterns = [
        /comando|script|código|terminal|console/gi,
        /configuração|parâmetro|variável/gi,
        /API|URL|JSON|XML|SQL/gi
      ];

      return count + technicalPatterns.reduce((termCount, pattern) => {
        return termCount + (step.content.match(pattern) || []).length;
      }, 0);
    }, 0);

    complexity += Math.min(technicalTerms / 10, 1);

    if (complexity < 0.4) return 'beginner';
    if (complexity > 1.2) return 'advanced';
    return 'intermediate';
  }

  /**
   * Gera tags para o guia
   */
  private generateGuideTags(sourceData: any, steps: GuideStep[]): string[] {
    const tags = new Set<string>();

    // Tag da categoria
    tags.add(sourceData.category_name.toLowerCase().replace(/\s+/g, '-'));

    // Tags baseadas em ações dos passos
    const actionWords = new Set<string>();
    steps.forEach(step => {
      const actions = step.content.match(/\b(instalar|configurar|acessar|executar|criar|deletar|modificar)\b/gi);
      if (actions) {
        actions.forEach(action => actionWords.add(action.toLowerCase()));
      }
    });

    actionWords.forEach(action => tags.add(action));

    // Tags específicas
    tags.add('guia');
    tags.add('passo-a-passo');
    tags.add('tutorial');

    return Array.from(tags).slice(0, 8);
  }

  /**
   * Calcula confiança do guia gerado
   */
  private calculateGuideConfidence(sourceData: any, steps: GuideStep[]): number {
    let confidence = 0.5; // Base

    // Baseado na qualidade dos tickets fonte
    confidence += Math.min(sourceData.tickets.length * 0.05, 0.2);
    confidence += Math.min(sourceData.avg_satisfaction * 0.1, 0.2);

    // Baseado na completude dos passos
    const stepsWithValidation = steps.filter(step => step.validation_criteria).length;
    confidence += (stepsWithValidation / steps.length) * 0.2;

    const stepsWithTroubleshooting = steps.filter(step => step.troubleshooting.length > 0).length;
    confidence += (stepsWithTroubleshooting / steps.length) * 0.15;

    // Baseado na estrutura
    if (steps.length >= 3 && steps.length <= 10) confidence += 0.1;
    if (steps.every(step => step.estimated_time_minutes > 0)) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  /**
   * Salva guia no banco de dados
   */
  async saveInteractiveGuide(guide: InteractiveGuide, authorId: number): Promise<number> {
    try {
      // Formata conteúdo do guia
      const content = this.formatGuideContent(guide);

      // Salva artigo principal
      const result = await db.run(`
        INSERT INTO kb_articles (
          title, summary, content, category_id, author_id,
          status, visibility, search_keywords, meta_title, meta_description,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        guide.title,
        guide.summary,
        content,
        guide.category_id,
        authorId,
        'draft',
        'public',
        guide.tags.join(', '),
        guide.title,
        guide.description.substring(0, 160)
      ]);

      const articleId = result.lastID!;

      // Adiciona tags
      for (const tag of guide.tags) {
        await db.run(`INSERT OR IGNORE INTO kb_tags (name, slug) VALUES (?, ?)`, [
          tag, tag.toLowerCase().replace(/\s+/g, '-')
        ]);

        const tagResult = await db.get(`SELECT id FROM kb_tags WHERE slug = ?`, [
          tag.toLowerCase().replace(/\s+/g, '-')
        ]);

        if (tagResult) {
          await db.run(`
            INSERT INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)
          `, [articleId, tagResult.id]);
        }
      }

      // Registra metadados
      await db.run(`
        INSERT INTO ai_suggestions (
          entity_type, entity_id, suggestion_type, suggested_content,
          reasoning, source_type, source_references, confidence_score,
          model_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        'kb_article',
        articleId,
        'interactive_guide',
        JSON.stringify(guide.metadata),
        `Guia interativo gerado para ${guide.difficulty_level} com ${guide.steps.length} passos`,
        'resolved_tickets',
        JSON.stringify(guide.metadata.source_tickets),
        guide.metadata.confidence_score,
        'gpt-4o'
      ]);

      logger.info(`Guia interativo salvo: ID ${articleId} - ${guide.title}`);
      return articleId;

    } catch (error) {
      logger.error('Erro ao salvar guia interativo', error);
      throw error;
    }
  }

  /**
   * Formata conteúdo do guia em Markdown
   */
  private formatGuideContent(guide: InteractiveGuide): string {
    let content = `# ${guide.title}\n\n`;
    content += `${guide.description}\n\n`;

    // Informações do guia
    content += `## Informações do Guia\n\n`;
    content += `- **Nível**: ${guide.difficulty_level}\n`;
    content += `- **Tempo estimado**: ${guide.estimated_total_time} minutos\n`;
    content += `- **Categoria**: ${guide.category_id}\n\n`;

    // Pré-requisitos
    if (guide.prerequisites.length > 0) {
      content += `## Pré-requisitos\n\n`;
      guide.prerequisites.forEach(prereq => {
        content += `- ${prereq}\n`;
      });
      content += `\n`;
    }

    // Objetivos de aprendizado
    if (guide.learning_objectives.length > 0) {
      content += `## O que você aprenderá\n\n`;
      guide.learning_objectives.forEach(objective => {
        content += `- ${objective}\n`;
      });
      content += `\n`;
    }

    // Passos
    content += `## Passos do Guia\n\n`;
    guide.steps.forEach((step, index) => {
      content += `### Passo ${index + 1}: ${step.title}\n\n`;
      content += `**Tempo estimado**: ${step.estimated_time_minutes} minutos\n\n`;

      if (step.prerequisites.length > 0) {
        content += `**Pré-requisitos para este passo**:\n`;
        step.prerequisites.forEach(prereq => {
          content += `- ${prereq}\n`;
        });
        content += `\n`;
      }

      content += `${step.content}\n\n`;

      if (step.validation_criteria) {
        content += `**✅ Como verificar se deu certo**:\n${step.validation_criteria}\n\n`;
      }

      if (step.troubleshooting.length > 0) {
        content += `**🔧 Solução de problemas**:\n`;
        step.troubleshooting.forEach(trouble => {
          content += `- ${trouble}\n`;
        });
        content += `\n`;
      }

      if (step.alternative_approaches.length > 0) {
        content += `**🔄 Abordagens alternativas**:\n`;
        step.alternative_approaches.forEach(alt => {
          content += `- ${alt}\n`;
        });
        content += `\n`;
      }

      content += `---\n\n`;
    });

    // Recursos
    if (guide.resources.length > 0) {
      content += `## Recursos Adicionais\n\n`;
      guide.resources.forEach(resource => {
        const link = resource.url ? `[${resource.title}](${resource.url})` : resource.title;
        content += `- ${link}: ${resource.description}\n`;
      });
      content += `\n`;
    }

    // Metadados
    content += `## Sobre este Guia\n\n`;
    content += `Este guia foi gerado automaticamente baseado em tickets reais resolvidos. `;
    content += `Confiança: ${Math.round(guide.metadata.confidence_score * 100)}%\n\n`;
    content += `*Última validação: ${new Date(guide.metadata.last_validated).toLocaleDateString('pt-BR')}*`;

    return content;
  }

  /**
   * Registra progresso do usuário
   */
  async trackUserProgress(
    userId: number,
    guideId: number,
    stepId: string,
    completed: boolean,
    feedback?: { rating: number; comment?: string; difficulty: number }
  ): Promise<void> {
    try {
      // Busca ou cria progresso do usuário
      let progress = await db.get(`
        SELECT * FROM analytics_events
        WHERE event_type = 'guide_progress'
          AND user_id = ?
          AND entity_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId, guideId]);

      let progressData = progress ? JSON.parse(progress.properties) : {
        current_step: 0,
        completed_steps: [],
        feedback: []
      };

      if (completed && !progressData.completed_steps.includes(stepId)) {
        progressData.completed_steps.push(stepId);
      }

      if (feedback) {
        progressData.feedback.push({
          step_id: stepId,
          ...feedback
        });
      }

      // Atualiza step atual
      const stepNumber = parseInt(stepId.split('_').pop() || '0');
      if (completed && stepNumber > progressData.current_step) {
        progressData.current_step = stepNumber;
      }

      // Salva progresso
      await db.run(`
        INSERT INTO analytics_events (
          event_type, user_id, entity_type, entity_id, properties, created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [
        'guide_progress',
        userId,
        'kb_article',
        guideId,
        JSON.stringify(progressData)
      ]);

      logger.info(`Progresso registrado: usuário ${userId}, guia ${guideId}, passo ${stepId}`);

    } catch (error) {
      logger.error('Erro ao registrar progresso', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de uso do guia
   */
  async getGuideUsageStats(guideId: number): Promise<{
    total_users: number;
    completion_rate: number;
    avg_time_to_complete: number;
    step_drop_off_rates: Array<{ step_id: string; drop_off_rate: number }>;
    avg_difficulty_rating: number;
    common_feedback_themes: string[];
  }> {
    try {
      const stats = await db.all(`
        SELECT
          user_id,
          json_extract(properties, '$.completed_steps') as completed_steps,
          json_extract(properties, '$.current_step') as current_step,
          json_extract(properties, '$.feedback') as feedback,
          created_at
        FROM analytics_events
        WHERE event_type = 'guide_progress'
          AND entity_id = ?
      `, [guideId]);

      const totalUsers = new Set(stats.map(s => s.user_id)).size;
      const completedUsers = stats.filter(s => {
        const completed = JSON.parse(s.completed_steps || '[]');
        return completed.length >= 3; // Assumindo que 3+ passos = completo
      }).length;

      const completionRate = totalUsers > 0 ? completedUsers / totalUsers : 0;

      // Análise de feedback
      let totalDifficulty = 0;
      let difficultyCount = 0;

      stats.forEach(stat => {
        if (stat.feedback) {
          const feedbacks = JSON.parse(stat.feedback);
          feedbacks.forEach((fb: any) => {
            if (fb.difficulty) {
              totalDifficulty += fb.difficulty;
              difficultyCount++;
            }
          });
        }
      });

      const avgDifficulty = difficultyCount > 0 ? totalDifficulty / difficultyCount : 0;

      return {
        total_users: totalUsers,
        completion_rate: Number(completionRate.toFixed(3)),
        avg_time_to_complete: 0, // Implementar baseado em timestamps
        step_drop_off_rates: [], // Implementar análise de abandono por passo
        avg_difficulty_rating: Number(avgDifficulty.toFixed(2)),
        common_feedback_themes: [] // Implementar análise de texto dos comentários
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas do guia', error);
      throw error;
    }
  }
}

// Instância singleton
export const guideBuilder = new GuideBuilder();