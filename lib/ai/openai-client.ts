import OpenAI from 'openai';
import { createHash } from 'crypto';
import { logger } from '../monitoring/logger';

// Rate limiting configuration
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxConcurrentRequests: number;
}

interface RequestTracker {
  requests: number[];
  tokens: number[];
  activeRequests: number;
}

// Default rate limits (can be configured via environment variables)
const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  maxRequestsPerMinute: 60,
  maxTokensPerMinute: 150000,
  maxConcurrentRequests: 10
};

class OpenAIClientManager {
  private client: OpenAI;
  private rateLimits: RateLimitConfig;
  private requestTracker: RequestTracker;
  private readonly WINDOW_SIZE_MS = 60000; // 1 minute

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 seconds timeout
      maxRetries: 3,
    });

    // Load rate limits from environment or use defaults
    this.rateLimits = {
      maxRequestsPerMinute: parseInt(process.env.OPENAI_MAX_REQUESTS_PER_MINUTE || '60'),
      maxTokensPerMinute: parseInt(process.env.OPENAI_MAX_TOKENS_PER_MINUTE || '150000'),
      maxConcurrentRequests: parseInt(process.env.OPENAI_MAX_CONCURRENT_REQUESTS || '10')
    };

    this.requestTracker = {
      requests: [],
      tokens: [],
      activeRequests: 0
    };

    // Clean up old tracking data every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    const cutoff = now - this.WINDOW_SIZE_MS;

    this.requestTracker.requests = this.requestTracker.requests.filter(time => time > cutoff);
    this.requestTracker.tokens = this.requestTracker.tokens.filter(time => time > cutoff);
  }

  private async checkRateLimit(estimatedTokens: number = 1000): Promise<void> {
    const now = Date.now();

    // Check concurrent requests
    if (this.requestTracker.activeRequests >= this.rateLimits.maxConcurrentRequests) {
      throw new Error('Rate limit exceeded: Too many concurrent requests');
    }

    // Check requests per minute
    if (this.requestTracker.requests.length >= this.rateLimits.maxRequestsPerMinute) {
      const oldestRequest = this.requestTracker.requests[0];
      const waitTime = this.WINDOW_SIZE_MS - (now - oldestRequest);
      if (waitTime > 0) {
        throw new Error(`Rate limit exceeded: Wait ${Math.ceil(waitTime / 1000)} seconds`);
      }
    }

    // Check tokens per minute (estimate)
    const currentTokens = this.requestTracker.tokens.length * 1000; // rough estimate
    if (currentTokens + estimatedTokens > this.rateLimits.maxTokensPerMinute) {
      throw new Error('Rate limit exceeded: Token limit would be exceeded');
    }
  }

  private trackRequest(tokensUsed: number = 1000) {
    const now = Date.now();
    this.requestTracker.requests.push(now);
    this.requestTracker.tokens.push(now);
    this.requestTracker.activeRequests++;
  }

  private completeRequest() {
    this.requestTracker.activeRequests = Math.max(0, this.requestTracker.activeRequests - 1);
  }

  async chatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      functions?: OpenAI.Chat.Completions.ChatCompletionCreateParams.Function[];
      functionCall?: OpenAI.Chat.Completions.ChatCompletionCreateParams.FunctionCall;
    } = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.1,
      maxTokens = 1000,
      stream = false,
      functions,
      functionCall
    } = options;

    await this.checkRateLimit(maxTokens);
    this.trackRequest();

    try {
      const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      };

      if (functions) {
        params.functions = functions;
      }

      if (functionCall) {
        params.function_call = functionCall;
      }

      const completion = await this.client.chat.completions.create(params);
      return completion;
    } catch (error) {
      logger.error('OpenAI API error', error);
      throw error;
    } finally {
      this.completeRequest();
    }
  }

  async createEmbedding(
    input: string | string[],
    model: string = 'text-embedding-3-small'
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    await this.checkRateLimit(500); // Embeddings use fewer tokens
    this.trackRequest(500);

    try {
      const embedding = await this.client.embeddings.create({
        model,
        input,
      });
      return embedding;
    } catch (error) {
      logger.error('OpenAI Embedding API error', error);
      throw error;
    } finally {
      this.completeRequest();
    }
  }

  async moderateContent(input: string): Promise<OpenAI.Moderations.ModerationCreateResponse> {
    await this.checkRateLimit(100); // Moderation uses very few tokens
    this.trackRequest(100);

    try {
      const moderation = await this.client.moderations.create({
        input,
      });
      return moderation;
    } catch (error) {
      logger.error('OpenAI Moderation API error', error);
      throw error;
    } finally {
      this.completeRequest();
    }
  }

  // Helper method to estimate tokens (rough estimation)
  estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // For better accuracy, use tiktoken library
    return Math.ceil(text.length / 4);
  }

  // Get current rate limit status
  getRateLimitStatus() {
    const now = Date.now();
    const cutoff = now - this.WINDOW_SIZE_MS;

    return {
      requestsInWindow: this.requestTracker.requests.filter(time => time > cutoff).length,
      maxRequestsPerMinute: this.rateLimits.maxRequestsPerMinute,
      tokensInWindow: this.requestTracker.tokens.filter(time => time > cutoff).length * 1000, // estimate
      maxTokensPerMinute: this.rateLimits.maxTokensPerMinute,
      activeRequests: this.requestTracker.activeRequests,
      maxConcurrentRequests: this.rateLimits.maxConcurrentRequests
    };
  }

  // Create cache key for requests
  createCacheKey(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}

// Singleton instance
export const openAIClient = new OpenAIClientManager();

// Export types
export type {
  RateLimitConfig,
  RequestTracker
};

export default openAIClient;