'use client';

/**
 * SmartTicketForm - Intelligent ticket creation form with AI-powered suggestions
 * Features real-time AI analysis, auto-categorization, and duplicate detection
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { smartTicketEngine, type SmartTicketAnalysis } from '../../../lib/tickets/smart-engine';
import { duplicateDetector, type DuplicateDetectionResult } from '../../../lib/tickets/duplicate-detector';
import type { Category, Priority, User, CreateTicket } from '../../../lib/types/database';

// Icons (using Heroicons)
import { logger } from '@/lib/monitoring/logger';
import {
  SparklesIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ClockIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  CpuChipIcon,
  EyeIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface SmartTicketFormProps {
  categories: Category[];
  priorities: Priority[];
  agents?: User[];
  onSubmit: (ticket: CreateTicket) => Promise<void>;
  onDraftSave?: (draft: Partial<CreateTicket>) => void;
  initialData?: Partial<CreateTicket>;
  userId: number;
  className?: string;
}

interface AIInsight {
  type: 'category' | 'priority' | 'duplicate' | 'solution' | 'escalation' | 'urgency';
  title: string;
  description: string;
  confidence: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon: React.ComponentType<{ className?: string }>;
  variant: 'info' | 'warning' | 'success' | 'error';
}

interface FormState {
  title: string;
  description: string;
  category_id: number | null;
  priority_id: number | null;
  assigned_to?: number | null;
}

export function SmartTicketForm({
  categories,
  priorities,
  agents = [],
  onSubmit,
  onDraftSave,
  initialData,
  userId,
  className = ''
}: SmartTicketFormProps) {
  // Form state
  const [formState, setFormState] = useState<FormState>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    category_id: initialData?.category_id || null,
    priority_id: initialData?.priority_id || null,
    assigned_to: initialData?.assigned_to || null
  });

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<SmartTicketAnalysis | null>(null);
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<DuplicateDetectionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisEnabled, setAnalysisEnabled] = useState(true);

  // UI state
  const [showAIInsights, setShowAIInsights] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Debounce content changes for AI analysis
  const debouncedTitle = useDebounce(formState.title, 1000);
  const debouncedDescription = useDebounce(formState.description, 1500);

  // Trigger AI analysis when content changes
  useEffect(() => {
    if (analysisEnabled && debouncedTitle.trim() && debouncedDescription.trim()) {
      performAIAnalysis();
    }
  }, [debouncedTitle, debouncedDescription, analysisEnabled]);

  // Auto-save draft
  useEffect(() => {
    if (onDraftSave && (formState.title || formState.description)) {
      const timer = setTimeout(() => {
        onDraftSave(formState);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [formState, onDraftSave]);

  // Perform AI analysis
  const performAIAnalysis = useCallback(async () => {
    if (!debouncedTitle.trim() || !debouncedDescription.trim()) return;

    setIsAnalyzing(true);

    try {
      const ticketData = {
        title: debouncedTitle,
        description: debouncedDescription
      };

      // Run AI analysis and duplicate detection in parallel
      const [analysis, duplicates] = await Promise.all([
        smartTicketEngine.analyzeTicket(ticketData, {
          categories,
          priorities,
          agents,
          userId
        }),
        duplicateDetector.detectDuplicates(ticketData, [], {
          categories,
          currentUserId: userId
        })
      ]);

      setAiAnalysis(analysis);
      setDuplicateAnalysis(duplicates);

      // Auto-apply suggestions if confidence is high
      if (analysis.category.confidence >= 0.85 && !formState.category_id) {
        setFormState(prev => ({
          ...prev,
          category_id: analysis.category.suggested.id
        }));
      }

      if (analysis.priority.confidence >= 0.80 && !formState.priority_id) {
        setFormState(prev => ({
          ...prev,
          priority_id: analysis.priority.suggested.id
        }));
      }

    } catch (error) {
      logger.error('AI analysis failed', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [debouncedTitle, debouncedDescription, categories, priorities, agents, userId, formState.category_id, formState.priority_id]);

  // Generate AI insights for display
  const aiInsights = useMemo((): AIInsight[] => {
    const insights: AIInsight[] = [];

    if (!aiAnalysis) return insights;

    // Category suggestion
    if (aiAnalysis.category.confidence >= 0.70) {
      insights.push({
        type: 'category',
        title: 'Category Suggestion',
        description: `Suggested: ${aiAnalysis.category.suggested.name} (${(aiAnalysis.category.confidence * 100).toFixed(1)}% confidence)`,
        confidence: aiAnalysis.category.confidence,
        action: formState.category_id !== aiAnalysis.category.suggested.id ? {
          label: 'Apply',
          onClick: () => setFormState(prev => ({ ...prev, category_id: aiAnalysis.category.suggested.id }))
        } : undefined,
        icon: SparklesIcon,
        variant: 'info'
      });
    }

    // Priority suggestion
    if (aiAnalysis.priority.confidence >= 0.70) {
      const variant = aiAnalysis.priority.suggested.level >= 3 ? 'warning' : 'info';
      insights.push({
        type: 'priority',
        title: 'Priority Assessment',
        description: `Suggested: ${aiAnalysis.priority.suggested.name} (${(aiAnalysis.priority.confidence * 100).toFixed(1)}% confidence)`,
        confidence: aiAnalysis.priority.confidence,
        action: formState.priority_id !== aiAnalysis.priority.suggested.id ? {
          label: 'Apply',
          onClick: () => setFormState(prev => ({ ...prev, priority_id: aiAnalysis.priority.suggested.id }))
        } : undefined,
        icon: ExclamationTriangleIcon,
        variant
      });
    }

    // Escalation prediction
    if (aiAnalysis.escalation.predicted && aiAnalysis.escalation.probability >= 0.60) {
      insights.push({
        type: 'escalation',
        title: 'Escalation Risk',
        description: `High probability of escalation (${(aiAnalysis.escalation.probability * 100).toFixed(1)}%). Consider assigning to senior agent.`,
        confidence: aiAnalysis.escalation.probability,
        action: aiAnalysis.escalation.suggestedAgent ? {
          label: `Assign to ${aiAnalysis.escalation.suggestedAgent.name}`,
          onClick: () => setFormState(prev => ({ ...prev, assigned_to: aiAnalysis.escalation.suggestedAgent!.id }))
        } : undefined,
        icon: UserGroupIcon,
        variant: 'warning'
      });
    }

    // Complexity assessment
    if (aiAnalysis.complexity === 'high' || aiAnalysis.complexity === 'critical') {
      insights.push({
        type: 'urgency',
        title: 'Complexity Alert',
        description: `${aiAnalysis.complexity} complexity detected. Estimated resolution time: ${aiAnalysis.estimatedResolutionTime} hours.`,
        confidence: 0.8,
        icon: CpuChipIcon,
        variant: aiAnalysis.complexity === 'critical' ? 'error' : 'warning'
      });
    }

    // Solution suggestions
    if (aiAnalysis.solutions.suggestions.length > 0) {
      const topSuggestion = aiAnalysis.solutions.suggestions[0];
      insights.push({
        type: 'solution',
        title: 'Solution Suggestion',
        description: topSuggestion.content.substring(0, 100) + '...',
        confidence: topSuggestion.confidence,
        action: {
          label: 'View Details',
          onClick: () => {
            // Could open a modal or expand the suggestion
            logger.info('Show full suggestion', topSuggestion);
          }
        },
        icon: LightBulbIcon,
        variant: 'success'
      });
    }

    return insights;
  }, [aiAnalysis, formState]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const ticketData: CreateTicket = {
        title: formState.title.trim(),
        description: formState.description.trim(),
        user_id: userId,
        category_id: formState.category_id!,
        priority_id: formState.priority_id!,
        assigned_to: formState.assigned_to || undefined
      };

      await onSubmit(ticketData);

      // Reset form
      setFormState({
        title: '',
        description: '',
        category_id: null,
        priority_id: null,
        assigned_to: null
      });
      setAiAnalysis(null);
      setDuplicateAnalysis(null);

    } catch (error) {
      logger.error('Failed to submit ticket', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form validation
  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!formState.title.trim()) {
      errors.title = 'Title is required';
    } else if (formState.title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters';
    }

    if (!formState.description.trim()) {
      errors.description = 'Description is required';
    } else if (formState.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }

    if (!formState.category_id) {
      errors.category_id = 'Category is required';
    }

    if (!formState.priority_id) {
      errors.priority_id = 'Priority is required';
    }

    return errors;
  };

  // Handle field changes
  const handleFieldChange = (field: keyof FormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setValidationErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className={`max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create Smart Ticket
        </h2>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setAnalysisEnabled(!analysisEnabled)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              analysisEnabled
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {analysisEnabled ? 'AI Enabled' : 'AI Disabled'}
          </button>
          {isAnalyzing && (
            <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
              <CpuChipIcon className="h-4 w-4 animate-pulse" />
              <span className="text-sm">Analyzing...</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={formState.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  validationErrors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Brief description of the issue..."
                maxLength={200}
              />
              {validationErrors.title && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                {formState.title.length}/200 characters
              </p>
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                value={formState.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={6}
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none ${
                  validationErrors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Detailed description of the issue, steps to reproduce, expected vs actual behavior..."
                maxLength={2000}
              />
              {validationErrors.description && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                {formState.description.length}/2000 characters
              </p>
            </div>

            {/* Category Selection */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
                {aiAnalysis?.category.confidence && aiAnalysis.category.confidence >= 0.70 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <SparklesIcon className="h-3 w-3 mr-1" />
                    AI Suggested
                  </span>
                )}
              </label>
              <select
                id="category"
                value={formState.category_id || ''}
                onChange={(e) => handleFieldChange('category_id', parseInt(e.target.value) || null)}
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  validationErrors.category_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select a category...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {validationErrors.category_id && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.category_id}</p>
              )}
            </div>

            {/* Priority Selection */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority *
                {aiAnalysis?.priority.confidence && aiAnalysis.priority.confidence >= 0.70 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <SparklesIcon className="h-3 w-3 mr-1" />
                    AI Suggested
                  </span>
                )}
              </label>
              <select
                id="priority"
                value={formState.priority_id || ''}
                onChange={(e) => handleFieldChange('priority_id', parseInt(e.target.value) || null)}
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  validationErrors.priority_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select priority...</option>
                {priorities.map((priority) => (
                  <option key={priority.id} value={priority.id}>
                    {priority.name} (Level {priority.level})
                  </option>
                ))}
              </select>
              {validationErrors.priority_id && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.priority_id}</p>
              )}
            </div>

            {/* Agent Assignment (Optional) */}
            {agents.length > 0 && (
              <div>
                <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign to Agent (Optional)
                  {aiAnalysis?.escalation.suggestedAgent && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      <UserGroupIcon className="h-3 w-3 mr-1" />
                      AI Recommended
                    </span>
                  )}
                </label>
                <select
                  id="assigned_to"
                  value={formState.assigned_to || ''}
                  onChange={(e) => handleFieldChange('assigned_to', parseInt(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Auto-assign</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setFormState({
                  title: '',
                  description: '',
                  category_id: null,
                  priority_id: null,
                  assigned_to: null
                })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={isSubmitting || Object.keys(validateForm()).length > 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </form>
        </div>

        {/* AI Insights Sidebar */}
        <div className="space-y-6">
          {/* AI Insights Panel */}
          {showAIInsights && aiInsights.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <SparklesIcon className="h-5 w-5 mr-2 text-blue-500" />
                  AI Insights
                </h3>
                <button
                  onClick={() => setShowAIInsights(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                {aiInsights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      insight.variant === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                      insight.variant === 'warning' ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' :
                      insight.variant === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                      'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <insight.icon className={`h-5 w-5 mt-0.5 ${
                        insight.variant === 'error' ? 'text-red-500' :
                        insight.variant === 'warning' ? 'text-orange-500' :
                        insight.variant === 'success' ? 'text-green-500' :
                        'text-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {insight.title}
                          </h4>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(insight.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {insight.description}
                        </p>
                        {insight.action && (
                          <button
                            onClick={insight.action.onClick}
                            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {insight.action.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate Detection Panel */}
          {showDuplicates && duplicateAnalysis?.isDuplicate && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <DocumentDuplicateIcon className="h-5 w-5 mr-2 text-orange-500" />
                  Potential Duplicates
                </h3>
                <button
                  onClick={() => setShowDuplicates(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                {duplicateAnalysis.matches.slice(0, 3).map((match, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          #{match.ticket.id}: {match.ticket.title}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {(match.similarityScore * 100).toFixed(1)}% similarity
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        match.confidenceLevel === 'very_high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        match.confidenceLevel === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        match.confidenceLevel === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {match.confidenceLevel}
                      </span>
                    </div>
                    <div className="mt-2 flex space-x-2">
                      <button className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                        <EyeIcon className="h-3 w-3 inline mr-1" />
                        View
                      </button>
                      <button className="text-xs text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
                        <PencilIcon className="h-3 w-3 inline mr-1" />
                        Update Existing
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis Status */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Analysis Status
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">AI Analysis</span>
                <span className={`flex items-center ${
                  aiAnalysis ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                }`}>
                  {aiAnalysis ? <CheckCircleIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">Duplicate Check</span>
                <span className={`flex items-center ${
                  duplicateAnalysis ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                }`}>
                  {duplicateAnalysis ? <CheckCircleIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                </span>
              </div>
              {aiAnalysis && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Est. Resolution</span>
                  <span className="text-gray-900 dark:text-white">
                    {aiAnalysis.estimatedResolutionTime}h
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}