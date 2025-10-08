import OpenAI from 'openai';
import db from '../db/connection';
import { logger } from '../monitoring/logger';

export class AIClassifier {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
  }

  /**
   * Classifica ticket usando GPT-4o
   */
  async classifyTicket(
    title: string,
    description: string,
    organizationId: number
  ): Promise<{
    category_id: number;
    priority_id: number;
    confidence: number;
    reasoning: string;
  }> {
    // Buscar categorias e prioridades do tenant
    const categories = db.prepare(`
      SELECT id, name, description FROM categories
      WHERE organization_id = ? AND is_active = 1
    `).all(organizationId) as any[];

    const priorities = db.prepare(`
      SELECT id, name, level FROM priorities
      WHERE organization_id = ?
    `).all(organizationId) as any[];

    // Criar prompt
    const prompt = `
Você é um assistente de classificação de tickets de suporte.

Ticket:
Título: ${title}
Descrição: ${description}

Categorias disponíveis:
${categories.map(c => `- ${c.name}: ${c.description || 'N/A'}`).join('\n')}

Prioridades disponíveis:
${priorities.map(p => `- ${p.name} (level ${p.level})`).join('\n')}

Retorne um JSON com:
{
  "category_name": "nome da categoria mais apropriada",
  "priority_name": "prioridade sugerida",
  "confidence": 0.XX (0-1),
  "reasoning": "explicação da escolha"
}
`;

    try {
      const startTime = Date.now();

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em classificação de tickets de suporte.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const processingTime = Date.now() - startTime;
      const result = JSON.parse(completion.choices[0].message.content || '{}');

      // Mapear nomes para IDs
      const category = categories.find(c =>
        c.name.toLowerCase() === result.category_name.toLowerCase()
      );

      const priority = priorities.find(p =>
        p.name.toLowerCase() === result.priority_name.toLowerCase()
      );

      if (!category || !priority) {
        throw new Error('Invalid classification result');
      }

      // Salvar classificação
      await this.saveClassification(
        title,
        description,
        category.id,
        priority.id,
        result.confidence,
        result.reasoning,
        completion.usage?.prompt_tokens || 0,
        completion.usage?.completion_tokens || 0,
        processingTime,
        organizationId
      );

      return {
        category_id: category.id,
        priority_id: priority.id,
        confidence: result.confidence,
        reasoning: result.reasoning
      };

    } catch (error) {
      logger.error('AI classification error', error);

      // Fallback para categoria/prioridade padrão
      return {
        category_id: categories[0]?.id || 1,
        priority_id: priorities.find(p => p.name === 'Medium')?.id || 2,
        confidence: 0,
        reasoning: 'Erro na classificação, usando padrão'
      };
    }
  }

  /**
   * Salva classificação no banco
   */
  private async saveClassification(
    title: string,
    description: string,
    categoryId: number,
    priorityId: number,
    confidence: number,
    reasoning: string,
    inputTokens: number,
    outputTokens: number,
    processingTime: number,
    organizationId: number
  ): Promise<void> {
    db.prepare(`
      INSERT INTO ai_classifications (
        ticket_id, suggested_category_id, suggested_priority_id,
        confidence_score, reasoning, model_name, model_version,
        input_tokens, output_tokens, processing_time_ms,
        organization_id
      ) VALUES (0, ?, ?, ?, ?, 'gpt-4o', '2024-08-06', ?, ?, ?, ?)
    `).run(
      categoryId,
      priorityId,
      confidence,
      reasoning,
      inputTokens,
      outputTokens,
      processingTime,
      organizationId
    );
  }

  /**
   * Gera embedding vetorial para busca semântica
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Embedding generation error', error);
      return [];
    }
  }

  /**
   * Salva embedding no banco
   */
  async saveEmbedding(
    entityType: 'ticket' | 'kb_article' | 'comment',
    entityId: number,
    text: string,
    organizationId: number
  ): Promise<void> {
    const embedding = await this.generateEmbedding(text);

    if (embedding.length === 0) return;

    db.prepare(`
      INSERT OR REPLACE INTO vector_embeddings (
        entity_type, entity_id, embedding_vector,
        model_name, vector_dimension, organization_id
      ) VALUES (?, ?, ?, 'text-embedding-3-small', 1536, ?)
    `).run(
      entityType,
      entityId,
      JSON.stringify(embedding),
      organizationId
    );
  }

  /**
   * Busca similaridade por cosine similarity
   */
  async findSimilar(
    queryText: string,
    entityType: 'ticket' | 'kb_article',
    organizationId: number,
    limit: number = 5
  ): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(queryText);

    if (queryEmbedding.length === 0) return [];

    // Buscar todos embeddings do tipo
    const embeddings = db.prepare(`
      SELECT * FROM vector_embeddings
      WHERE entity_type = ? AND organization_id = ?
    `).all(entityType, organizationId) as any[];

    // Calcular similaridade
    const similarities = embeddings.map(emb => {
      const storedEmbedding = JSON.parse(emb.embedding_vector);
      const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);

      return {
        entity_id: emb.entity_id,
        similarity
      };
    });

    // Ordenar e retornar top N
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Calcula cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Fornece feedback sobre classificação
   */
  async provideFeedback(
    classificationId: number,
    wasCorrect: boolean,
    correctedCategoryId?: number,
    feedbackBy?: number
  ): Promise<void> {
    db.prepare(`
      UPDATE ai_classifications
      SET was_accepted = ?,
          corrected_category_id = ?,
          feedback_by = ?,
          feedback_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      wasCorrect ? 1 : 0,
      correctedCategoryId || null,
      feedbackBy || null,
      classificationId
    );
  }
}

export const aiClassifier = new AIClassifier();
