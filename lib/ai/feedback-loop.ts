import db from '../db/connection';

export class AIFeedbackLoop {
  /**
   * Coleta dados para treino baseado em classificações corretas
   */
  async collectTrainingData(organizationId: number): Promise<void> {
    // Buscar classificações aceitas (corretas)
    const correctClassifications = db.prepare(`
      SELECT
        ai.ticket_id,
        t.title,
        t.description,
        c.name as category_name,
        p.name as priority_name,
        ai.confidence_score
      FROM ai_classifications ai
      INNER JOIN tickets t ON ai.ticket_id = t.id
      INNER JOIN categories c ON ai.suggested_category_id = c.id
      INNER JOIN priorities p ON ai.suggested_priority_id = p.id
      WHERE ai.was_accepted = 1
        AND t.organization_id = ?
        AND ai.created_at >= datetime('now', '-30 days')
    `).all(organizationId) as any[];

    // Buscar classificações corrigidas (incorretas)
    const correctedClassifications = db.prepare(`
      SELECT
        ai.ticket_id,
        t.title,
        t.description,
        ai.suggested_category_id as wrong_category_id,
        ai.corrected_category_id as correct_category_id,
        c1.name as suggested_category,
        c2.name as correct_category,
        ai.confidence_score
      FROM ai_classifications ai
      INNER JOIN tickets t ON ai.ticket_id = t.id
      INNER JOIN categories c1 ON ai.suggested_category_id = c1.id
      INNER JOIN categories c2 ON ai.corrected_category_id = c2.id
      WHERE ai.was_accepted = 0
        AND ai.corrected_category_id IS NOT NULL
        AND t.organization_id = ?
        AND ai.created_at >= datetime('now', '-30 days')
    `).all(organizationId) as any[];

    // Salvar como training data
    for (const item of correctClassifications) {
      this.saveTrainingData(
        item.title + '\n' + item.description,
        item.category_name,
        'classification',
        1.0,
        organizationId
      );
    }

    for (const item of correctedClassifications) {
      // Salvar CORRETO
      this.saveTrainingData(
        item.title + '\n' + item.description,
        item.correct_category,
        'classification',
        0.8,
        organizationId
      );

      // Salvar INCORRETO como exemplo negativo
      this.saveTrainingData(
        item.title + '\n' + item.description,
        `NOT: ${item.suggested_category}`,
        'classification',
        0.5,
        organizationId
      );
    }
  }

  /**
   * Salva dados de treinamento
   */
  private saveTrainingData(
    input: string,
    output: string,
    dataType: string,
    qualityScore: number,
    organizationId: number
  ): void {
    db.prepare(`
      INSERT INTO ai_training_data (
        input, output, data_type, quality_score,
        model_version, organization_id, is_validated
      ) VALUES (?, ?, ?, ?, '1.0', ?, 1)
    `).run(input, output, dataType, qualityScore, organizationId);
  }

  /**
   * Calcula accuracy do modelo
   */
  async calculateModelAccuracy(organizationId: number): Promise<{
    overall_accuracy: number;
    category_accuracy: number;
    priority_accuracy: number;
    total_classifications: number;
  }> {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN was_accepted = 1 THEN 1 ELSE 0 END) as accepted,
        AVG(confidence_score) as avg_confidence
      FROM ai_classifications
      WHERE organization_id = ?
        AND created_at >= datetime('now', '-30 days')
    `).get(organizationId) as any;

    const accuracy = stats.total > 0
      ? (stats.accepted / stats.total)
      : 0;

    return {
      overall_accuracy: accuracy,
      category_accuracy: accuracy,
      priority_accuracy: accuracy,
      total_classifications: stats.total
    };
  }

  /**
   * Exporta dados para fine-tuning
   */
  async exportForFineTuning(organizationId: number): Promise<any[]> {
    const trainingData = db.prepare(`
      SELECT input, output, quality_score
      FROM ai_training_data
      WHERE organization_id = ?
        AND is_validated = 1
        AND quality_score >= 0.7
      ORDER BY quality_score DESC, created_at DESC
      LIMIT 1000
    `).all(organizationId) as any[];

    // Formatar para OpenAI fine-tuning format
    return trainingData.map(item => ({
      messages: [
        {
          role: 'system',
          content: 'Você é um classificador de tickets de suporte.'
        },
        {
          role: 'user',
          content: item.input
        },
        {
          role: 'assistant',
          content: item.output
        }
      ]
    }));
  }
}

export const feedbackLoop = new AIFeedbackLoop();
