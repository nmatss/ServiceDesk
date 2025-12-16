/**
 * AI Utility Functions
 * Centralized AI utilities to prevent code duplication
 */

/**
 * Calculate cosine similarity between two vectors
 * Unified implementation to replace duplicate functions
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between 0 and 1 (1 = identical, 0 = completely different)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have same length. Got ${a.length} and ${b.length}`);
  }

  if (a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const magnitudeA = Math.sqrt(normA);
  const magnitudeB = Math.sqrt(normB);

  const denominator = magnitudeA * magnitudeB;

  // Avoid division by zero
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Calculate Euclidean distance between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance value (0 = identical)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have same length. Got ${a.length} and ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate dot product between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product value
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have same length. Got ${a.length} and ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }

  return sum;
}

/**
 * Calculate vector magnitude (L2 norm)
 *
 * @param vector - Input vector
 * @returns Magnitude value
 */
export function magnitude(vector: number[]): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    const val = vector[i] ?? 0;
    sum += val * val;
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length
 *
 * @param vector - Input vector
 * @returns Normalized vector
 */
export function normalize(vector: number[]): number[] {
  const mag = magnitude(vector);

  if (mag === 0) {
    return vector.map(() => 0);
  }

  return vector.map(val => (val ?? 0) / mag);
}

/**
 * Calculate Manhattan distance between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance value
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have same length. Got ${a.length} and ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }

  return sum;
}

/**
 * Chunk text into smaller pieces for embedding
 * Useful for long documents that exceed model token limits
 *
 * @param text - Input text
 * @param maxChunkSize - Maximum characters per chunk
 * @param overlap - Number of characters to overlap between chunks
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 8000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation)
 * For more accurate counts, use tiktoken library
 *
 * @param text - Input text
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 *
 * @param text - Input text
 * @param maxTokens - Maximum allowed tokens
 * @returns Truncated text
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Rough approximation: keep first N characters
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars) + '...';
}

/**
 * Clean text for better AI processing
 * Removes excessive whitespace, special characters, etc.
 *
 * @param text - Input text
 * @returns Cleaned text
 */
export function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
    .replace(/[^\w\s\.,!?;:\-()]/g, ''); // Remove special characters except common punctuation
}
