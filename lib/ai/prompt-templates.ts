// AI Prompt Templates for ServiceDesk System

export interface PromptTemplate {
  name: string;
  description: string;
  version: string;
  template: string;
  variables: string[];
  maxTokens: number;
  temperature: number;
}

export interface ClassificationContext {
  ticketTitle: string;
  ticketDescription: string;
  userRole?: string;
  availableCategories: Array<{ id: number; name: string; description?: string }>;
  availablePriorities: Array<{ id: number; name: string; level: number }>;
  historicalData?: {
    similarTickets?: Array<{ title: string; category: string; priority: string }>;
    userHistory?: Array<{ category: string; priority: string; resolutionTime: number }>;
  };
}

export interface SuggestionContext {
  ticketTitle: string;
  ticketDescription: string;
  ticketCategory: string;
  ticketPriority: string;
  knowledgeArticles: Array<{ id: number; title: string; summary?: string; content: string }>;
  similarTickets: Array<{ id: number; title: string; description: string; resolution?: string }>;
  userContext?: {
    role: string;
    department?: string;
    previousIssues?: string[];
  };
}

export interface ResponseContext {
  ticketTitle: string;
  ticketDescription: string;
  ticketCategory: string;
  ticketPriority: string;
  conversationHistory: Array<{ user: string; message: string; timestamp: string; isInternal: boolean }>;
  knowledgeBase: Array<{ title: string; content: string }>;
  tone: 'professional' | 'friendly' | 'technical' | 'formal';
  responseType: 'initial_response' | 'follow_up' | 'resolution' | 'escalation';
}

export interface SentimentContext {
  text: string;
  conversationHistory?: Array<{ message: string; timestamp: string }>;
  ticketContext?: {
    category: string;
    priority: string;
    daysOpen: number;
    escalationLevel: number;
  };
}

export class PromptTemplates {
  // Ticket Classification Templates
  static readonly TICKET_CLASSIFICATION: PromptTemplate = {
    name: 'ticket_classification',
    description: 'Classifica tickets automaticamente em categorias e prioridades',
    version: '2.0',
    maxTokens: 500,
    temperature: 0.1,
    variables: ['ticketTitle', 'ticketDescription', 'availableCategories', 'availablePriorities', 'historicalData'],
    template: `Você é um especialista em classificação de tickets de suporte para um ServiceDesk corporativo.

Analise o ticket abaixo e classifique-o na categoria e prioridade mais adequadas baseado no contexto fornecido.

**TICKET:**
Título: {{ticketTitle}}
Descrição: {{ticketDescription}}

**CATEGORIAS DISPONÍVEIS:**
{{#each availableCategories}}
- {{name}} (ID: {{id}}): {{description}}
{{/each}}

**PRIORIDADES DISPONÍVEIS:**
{{#each availablePriorities}}
- {{name}} (Nível {{level}}, ID: {{id}})
{{/each}}

**CRITÉRIOS DE PRIORIDADE:**
- Nível 1 (Baixa): Solicitações gerais, dúvidas, melhorias não urgentes
- Nível 2 (Média): Problemas que impactam produtividade mas têm workarounds
- Nível 3 (Alta): Problemas que impedem trabalho normal, sem workaround
- Nível 4 (Crítica): Sistemas críticos inoperantes, perda de dados, segurança

{{#if historicalData.similarTickets}}
**REFERÊNCIA DE TICKETS SIMILARES:**
{{#each historicalData.similarTickets}}
- "{{title}}" → Categoria: {{category}}, Prioridade: {{priority}}
{{/each}}
{{/if}}

Responda APENAS com um JSON válido no seguinte formato:
{
  "category_id": <number>,
  "category_name": "<string>",
  "priority_id": <number>,
  "priority_name": "<string>",
  "confidence_score": <decimal entre 0.0 e 1.0>,
  "reasoning": "<explicação clara em português da classificação>",
  "suggested_actions": ["<ação1>", "<ação2>"],
  "estimated_resolution_time_hours": <number>
}`
  };

  static readonly SOLUTION_SUGGESTION: PromptTemplate = {
    name: 'solution_suggestion',
    description: 'Sugere soluções baseadas na knowledge base e tickets similares',
    version: '2.0',
    maxTokens: 800,
    temperature: 0.2,
    variables: ['ticketTitle', 'ticketDescription', 'ticketCategory', 'ticketPriority', 'knowledgeArticles', 'similarTickets'],
    template: `Você é um especialista em suporte técnico com acesso a uma base de conhecimento abrangente.

Analise o ticket abaixo e sugira soluções práticas baseadas na knowledge base e em tickets similares resolvidos.

**TICKET ATUAL:**
Título: {{ticketTitle}}
Descrição: {{ticketDescription}}
Categoria: {{ticketCategory}}
Prioridade: {{ticketPriority}}

**ARTIGOS DA BASE DE CONHECIMENTO RELEVANTES:**
{{#each knowledgeArticles}}
### {{title}}
{{#if summary}}Resumo: {{summary}}{{/if}}
Conteúdo: {{content}}
---
{{/each}}

**TICKETS SIMILARES RESOLVIDOS:**
{{#each similarTickets}}
### Ticket #{{id}}: {{title}}
Descrição: {{description}}
{{#if resolution}}Resolução: {{resolution}}{{/if}}
---
{{/each}}

Forneça sugestões de solução estruturadas e práticas. Responda em JSON válido:

{
  "primary_solution": {
    "title": "<título da solução principal>",
    "steps": ["<passo 1>", "<passo 2>", "<passo 3>"],
    "estimated_time_minutes": <number>,
    "difficulty_level": "<easy|medium|hard>",
    "success_probability": <decimal entre 0.0 e 1.0>
  },
  "alternative_solutions": [
    {
      "title": "<título da alternativa>",
      "steps": ["<passo 1>", "<passo 2>"],
      "when_to_use": "<quando usar esta alternativa>"
    }
  ],
  "knowledge_base_references": [<array de IDs dos artigos relevantes>],
  "escalation_triggers": ["<condição 1>", "<condição 2>"],
  "preventive_measures": ["<medida 1>", "<medida 2>"],
  "confidence_score": <decimal entre 0.0 e 1.0>,
  "requires_specialist": <boolean>
}`
  };

  static readonly RESPONSE_GENERATION: PromptTemplate = {
    name: 'response_generation',
    description: 'Gera respostas personalizadas para tickets baseadas no contexto',
    version: '2.0',
    maxTokens: 600,
    temperature: 0.3,
    variables: ['ticketTitle', 'ticketDescription', 'conversationHistory', 'knowledgeBase', 'tone', 'responseType'],
    template: `Você é um agente de suporte altamente qualificado que precisa redigir uma resposta para um ticket.

**CONTEXTO DO TICKET:**
Título: {{ticketTitle}}
Descrição: {{ticketDescription}}
Tipo de resposta: {{responseType}}
Tom desejado: {{tone}}

**HISTÓRICO DA CONVERSA:**
{{#each conversationHistory}}
{{user}} ({{timestamp}}{{#if isInternal}} - INTERNO{{/if}}): {{message}}
{{/each}}

**BASE DE CONHECIMENTO RELEVANTE:**
{{#each knowledgeBase}}
- {{title}}: {{content}}
{{/each}}

**DIRETRIZES DE RESPOSTA:**
- Use linguagem {{tone}} e profissional
- Seja empático e proativo
- Inclua próximos passos claros
- Mencione tempo estimado quando relevante
- Para questões técnicas, forneça detalhes suficientes
- Para questões de processo, referencie políticas quando aplicável

{{#if responseType === 'initial_response'}}
- Confirme recebimento e compreensão do problema
- Estabeleça expectativas de resolução
{{/if}}

{{#if responseType === 'follow_up'}}
- Atualize o status da resolução
- Solicite informações adicionais se necessário
{{/if}}

{{#if responseType === 'resolution'}}
- Confirme que o problema foi resolvido
- Forneça resumo da solução
- Solicite confirmação do usuário
{{/if}}

Responda em JSON válido:
{
  "response_text": "<texto da resposta em português>",
  "response_type": "{{responseType}}",
  "tone_used": "{{tone}}",
  "next_actions": ["<ação 1>", "<ação 2>"],
  "escalation_needed": <boolean>,
  "estimated_resolution_time": "<tempo estimado>",
  "knowledge_base_references": [<IDs de artigos mencionados>],
  "follow_up_in_hours": <number ou null>
}`
  };

  static readonly SENTIMENT_ANALYSIS: PromptTemplate = {
    name: 'sentiment_analysis',
    description: 'Analisa o sentimento e urgência emocional em mensagens de tickets',
    version: '2.0',
    maxTokens: 300,
    temperature: 0.1,
    variables: ['text', 'conversationHistory', 'ticketContext'],
    template: `Você é um especialista em análise de sentimento para atendimento ao cliente.

Analise o sentimento da mensagem abaixo, considerando o contexto do ticket e histórico de conversa.

**MENSAGEM PARA ANÁLISE:**
{{text}}

{{#if conversationHistory}}
**HISTÓRICO DA CONVERSA:**
{{#each conversationHistory}}
{{timestamp}}: {{message}}
{{/each}}
{{/if}}

{{#if ticketContext}}
**CONTEXTO DO TICKET:**
Categoria: {{ticketContext.category}}
Prioridade: {{ticketContext.priority}}
Dias em aberto: {{ticketContext.daysOpen}}
Nível de escalação: {{ticketContext.escalationLevel}}
{{/if}}

Analise:
1. Sentimento geral (positivo, neutro, negativo)
2. Nível de frustração (baixo, médio, alto, crítico)
3. Urgência emocional (baixa, média, alta, crítica)
4. Indicadores de escalação necessária
5. Palavras-chave que influenciam o sentimento

Responda em JSON válido:
{
  "sentiment": "<positive|neutral|negative>",
  "sentiment_score": <decimal entre -1.0 e 1.0>,
  "frustration_level": "<low|medium|high|critical>",
  "emotional_urgency": "<low|medium|high|critical>",
  "escalation_indicators": ["<indicador 1>", "<indicador 2>"],
  "key_phrases": ["<frase 1>", "<frase 2>"],
  "recommended_response_tone": "<empathetic|professional|urgent|reassuring>",
  "priority_adjustment_needed": <boolean>,
  "immediate_attention_required": <boolean>,
  "confidence_score": <decimal entre 0.0 e 1.0>
}`
  };

  static readonly DUPLICATE_DETECTION: PromptTemplate = {
    name: 'duplicate_detection',
    description: 'Detecta tickets duplicados ou muito similares',
    version: '1.0',
    maxTokens: 400,
    temperature: 0.1,
    variables: ['currentTicket', 'candidateTickets'],
    template: `Você é um especialista em detecção de duplicatas em sistemas de tickets.

Analise se o ticket atual é uma duplicata ou está fortemente relacionado aos tickets candidatos.

**TICKET ATUAL:**
Título: {{currentTicket.title}}
Descrição: {{currentTicket.description}}
Usuário: {{currentTicket.user}}

**TICKETS CANDIDATOS:**
{{#each candidateTickets}}
### Ticket #{{id}}
Título: {{title}}
Descrição: {{description}}
Usuário: {{user}}
Status: {{status}}
Data: {{created_at}}
---
{{/each}}

Critérios para duplicatas:
- Mesmo usuário relatando problema similar em período curto
- Descrição substancialmente idêntica
- Mesmo problema técnico específico
- Solução seria a mesma

Responda em JSON válido:
{
  "is_duplicate": <boolean>,
  "duplicate_of_ticket_id": <number ou null>,
  "similarity_score": <decimal entre 0.0 e 1.0>,
  "duplicate_type": "<exact|similar|related|none>",
  "reasoning": "<explicação da análise>",
  "recommended_action": "<merge|link|separate|escalate>",
  "confidence_score": <decimal entre 0.0 e 1.0>
}`
  };

  static readonly INTENT_CLASSIFICATION: PromptTemplate = {
    name: 'intent_classification',
    description: 'Classifica a intenção do usuário no ticket',
    version: '1.0',
    maxTokens: 200,
    temperature: 0.1,
    variables: ['ticketTitle', 'ticketDescription'],
    template: `Classifique a intenção principal do usuário neste ticket:

**TICKET:**
Título: {{ticketTitle}}
Descrição: {{ticketDescription}}

**INTENÇÕES POSSÍVEIS:**
- bug_report: Relatar um problema/erro
- feature_request: Solicitar nova funcionalidade
- how_to: Pedir ajuda/instruções
- access_request: Solicitar acesso/permissões
- change_request: Solicitar mudança/alteração
- complaint: Reclamação sobre serviço
- information_request: Solicitar informações
- password_reset: Resetar/alterar senha
- hardware_issue: Problema com hardware
- software_issue: Problema com software

Responda em JSON válido:
{
  "intent": "<uma das intenções acima>",
  "confidence_score": <decimal entre 0.0 e 1.0>,
  "secondary_intents": ["<intenção secundária>"],
  "complexity_level": "<simple|moderate|complex>",
  "requires_approval": <boolean>
}`
  };

  // Utility methods for template processing
  static processTemplate(template: PromptTemplate, context: any): string {
    let processed = template.template;

    // Simple handlebars-like processing
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    // Process each loops (basic implementation)
    processed = processed.replace(/{{#each (\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
      const array = context[arrayName];
      if (!Array.isArray(array)) return '';

      return array.map(item => {
        let itemContent = content;
        for (const [key, value] of Object.entries(item)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          itemContent = itemContent.replace(regex, String(value));
        }
        return itemContent;
      }).join('');
    });

    // Process if conditions (basic implementation)
    processed = processed.replace(/{{#if ([\w.]+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
      const value = this.getNestedProperty(context, condition);
      return value ? content : '';
    });

    return processed;
  }

  static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  static validateTemplate(template: PromptTemplate): boolean {
    return (
      template.name &&
      template.template &&
      template.maxTokens > 0 &&
      template.temperature >= 0 &&
      template.temperature <= 2 &&
      Array.isArray(template.variables)
    );
  }

  static getTemplateByName(name: string): PromptTemplate | null {
    const templates = [
      this.TICKET_CLASSIFICATION,
      this.SOLUTION_SUGGESTION,
      this.RESPONSE_GENERATION,
      this.SENTIMENT_ANALYSIS,
      this.DUPLICATE_DETECTION,
      this.INTENT_CLASSIFICATION
    ];

    return templates.find(t => t.name === name) || null;
  }

  static getAllTemplates(): PromptTemplate[] {
    return [
      this.TICKET_CLASSIFICATION,
      this.SOLUTION_SUGGESTION,
      this.RESPONSE_GENERATION,
      this.SENTIMENT_ANALYSIS,
      this.DUPLICATE_DETECTION,
      this.INTENT_CLASSIFICATION
    ];
  }
}

// Export types and utilities
export {
  PromptTemplates as default,
  ClassificationContext,
  SuggestionContext,
  ResponseContext,
  SentimentContext
};