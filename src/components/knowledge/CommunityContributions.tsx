'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  UserGroupIcon,
  StarIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  EyeIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ShareIcon
} from '@heroicons/react/24/outline';

interface CommunityContribution {
  id: number;
  type: 'suggestion' | 'correction' | 'addition' | 'translation' | 'example';
  title: string;
  description: string;
  content?: string;
  article_id: number;
  article_title: string;
  contributor: {
    id: number;
    name: string;
    avatar?: string;
    reputation_score: number;
    contributions_count: number;
  };
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'implemented';
  votes: {
    up: number;
    down: number;
    user_vote?: 'up' | 'down';
  };
  created_at: string;
  updated_at: string;
  comments_count: number;
  implementation_notes?: string;
  difficulty_level?: 'easy' | 'medium' | 'hard';
  estimated_time?: number;
}

interface ContributionComment {
  id: number;
  contribution_id: number;
  author: {
    id: number;
    name: string;
    avatar?: string;
    role: string;
  };
  content: string;
  is_from_author: boolean;
  created_at: string;
}

interface CommunityStats {
  total_contributions: number;
  pending_review: number;
  implemented_this_month: number;
  top_contributors: Array<{
    id: number;
    name: string;
    contributions: number;
    reputation: number;
  }>;
  contribution_by_type: Record<string, number>;
}

export default function CommunityContributions() {
  const [contributions, setContributions] = useState<CommunityContribution[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [selectedContribution, setSelectedContribution] = useState<CommunityContribution | null>(null);
  const [comments, setComments] = useState<ContributionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status: string;
    type: string;
    sort: string;
  }>({
    status: 'all',
    type: 'all',
    sort: 'newest'
  });
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadContributions();
    loadStats();
  }, [filter]);

  const loadContributions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        status: filter.status,
        type: filter.type,
        sort: filter.sort,
        limit: '20'
      });

      const response = await fetch(`/api/knowledge/community/contributions?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setContributions(data.contributions);
      }
    } catch (error) {
      logger.error('Erro ao carregar contribuições', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/knowledge/community/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      logger.error('Erro ao carregar estatísticas', error);
    }
  };

  const loadContributionDetails = async (contributionId: number) => {
    try {
      // Carrega detalhes da contribuição
      const [contributionResponse, commentsResponse] = await Promise.all([
        fetch(`/api/knowledge/community/contributions/${contributionId}`),
        fetch(`/api/knowledge/community/contributions/${contributionId}/comments`)
      ]);

      const [contributionData, commentsData] = await Promise.all([
        contributionResponse.json(),
        commentsResponse.json()
      ]);

      if (contributionData.success) {
        setSelectedContribution(contributionData.contribution);
      }

      if (commentsData.success) {
        setComments(commentsData.comments);
      }
    } catch (error) {
      logger.error('Erro ao carregar detalhes', error);
    }
  };

  const voteContribution = async (contributionId: number, voteType: 'up' | 'down') => {
    try {
      const response = await fetch(`/api/knowledge/community/contributions/${contributionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteType })
      });

      const data = await response.json();

      if (data.success) {
        // Atualiza a lista de contribuições
        setContributions(prev => prev.map(contrib =>
          contrib.id === contributionId
            ? { ...contrib, votes: data.votes }
            : contrib
        ));

        // Atualiza contribuição selecionada se for a mesma
        if (selectedContribution?.id === contributionId) {
          setSelectedContribution(prev => prev ? { ...prev, votes: data.votes } : null);
        }
      }
    } catch (error) {
      logger.error('Erro ao votar', error);
    }
  };

  const addComment = async (contributionId: number) => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/knowledge/community/contributions/${contributionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });

      const data = await response.json();

      if (data.success) {
        setComments(prev => [...prev, data.comment]);
        setNewComment('');

        // Atualiza contador de comentários
        setContributions(prev => prev.map(contrib =>
          contrib.id === contributionId
            ? { ...contrib, comments_count: contrib.comments_count + 1 }
            : contrib
        ));
      }
    } catch (error) {
      logger.error('Erro ao adicionar comentário', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'under_review':
        return <EyeIcon className="h-5 w-5 text-blue-500" />;
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'implemented':
        return <CheckCircleIcon className="h-5 w-5 text-purple-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'suggestion':
        return <PencilIcon className="h-4 w-4" />;
      case 'correction':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'addition':
        return <PlusIcon className="h-4 w-4" />;
      case 'translation':
        return <ShareIcon className="h-4 w-4" />;
      case 'example':
        return <ChatBubbleLeftRightIcon className="h-4 w-4" />;
      default:
        return <PencilIcon className="h-4 w-4" />;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Agora há pouco';
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando contribuições da comunidade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <UserGroupIcon className="h-8 w-8 text-blue-600 mr-3" />
                Contribuições da Comunidade
              </h1>
              <p className="mt-2 text-gray-600">
                Colabore para melhorar nossa base de conhecimento
              </p>
            </div>
            <button
              onClick={() => {/* TODO: Implement contribution form */}}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nova Contribuição
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Contribuições</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_contributions}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Aguardando Revisão</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending_review}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Implementadas (30d)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.implemented_this_month}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <StarIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Top Contributor</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats.top_contributors[0]?.name || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contributions List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Filters */}
              <div className="border-b border-gray-200 p-6">
                <div className="flex flex-wrap gap-4">
                  <select
                    value={filter.status}
                    onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    <option value="all">Todos os status</option>
                    <option value="pending">Pendente</option>
                    <option value="under_review">Em revisão</option>
                    <option value="approved">Aprovado</option>
                    <option value="implemented">Implementado</option>
                    <option value="rejected">Rejeitado</option>
                  </select>

                  <select
                    value={filter.type}
                    onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="suggestion">Sugestão</option>
                    <option value="correction">Correção</option>
                    <option value="addition">Adição</option>
                    <option value="translation">Tradução</option>
                    <option value="example">Exemplo</option>
                  </select>

                  <select
                    value={filter.sort}
                    onChange={(e) => setFilter(prev => ({ ...prev, sort: e.target.value }))}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                    <option value="most_voted">Mais votados</option>
                    <option value="most_commented">Mais comentados</option>
                  </select>
                </div>
              </div>

              {/* Contributions */}
              <div className="divide-y divide-gray-200">
                {contributions.map((contribution) => (
                  <div
                    key={contribution.id}
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => loadContributionDetails(contribution.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="flex items-center text-sm text-gray-500 mr-4">
                            {getTypeIcon(contribution.type)}
                            <span className="ml-1 capitalize">{contribution.type}</span>
                          </div>
                          {getStatusIcon(contribution.status)}
                          <span className="ml-1 text-sm text-gray-500 capitalize">
                            {contribution.status.replace('_', ' ')}
                          </span>
                        </div>

                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {contribution.title}
                        </h3>

                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {contribution.description}
                        </p>

                        <div className="flex items-center text-sm text-gray-500 mb-3">
                          <span>Para o artigo: </span>
                          <span className="font-medium text-blue-600 ml-1">
                            {contribution.article_title}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-500">
                            <img
                              src={contribution.contributor.avatar || '/default-avatar.png'}
                              alt={contribution.contributor.name}
                              className="h-6 w-6 rounded-full mr-2"
                            />
                            <span>{contribution.contributor.name}</span>
                            <span className="mx-2">•</span>
                            <span>{formatRelativeTime(contribution.created_at)}</span>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  voteContribution(contribution.id, 'up');
                                }}
                                className={`p-1 rounded hover:bg-gray-100 ${
                                  contribution.votes.user_vote === 'up' ? 'text-green-600' : 'text-gray-400'
                                }`}
                              >
                                <HandThumbUpIcon className="h-4 w-4" />
                              </button>
                              <span className="text-sm text-gray-600 mx-1">
                                {contribution.votes.up}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  voteContribution(contribution.id, 'down');
                                }}
                                className={`p-1 rounded hover:bg-gray-100 ${
                                  contribution.votes.user_vote === 'down' ? 'text-red-600' : 'text-gray-400'
                                }`}
                              >
                                <HandThumbDownIcon className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex items-center text-sm text-gray-500">
                              <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                              {contribution.comments_count}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {contributions.length === 0 && (
                  <div className="p-12 text-center">
                    <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma contribuição encontrada
                    </h3>
                    <p className="text-gray-500">
                      Seja o primeiro a contribuir para a comunidade!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Contributors */}
            {stats && stats.top_contributors.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <StarIcon className="h-5 w-5 text-yellow-500 mr-2" />
                  Top Contributors
                </h3>
                <div className="space-y-3">
                  {stats.top_contributors.slice(0, 5).map((contributor, index) => (
                    <div key={contributor.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {contributor.name}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {contributor.contributions} contribuições
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contribution Types */}
            {stats && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Tipos de Contribuição
                </h3>
                <div className="space-y-3">
                  {Object.entries(stats.contribution_by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getTypeIcon(type)}
                        <span className="ml-2 text-sm text-gray-700 capitalize">
                          {type}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Ações Rápidas
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => {/* TODO: Implement contribution form */}}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  Nova Contribuição
                </button>
                <button
                  onClick={() => setFilter({ status: 'pending', type: 'all', sort: 'newest' })}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Ver Pendentes
                </button>
                <button
                  onClick={() => setFilter({ status: 'all', type: 'all', sort: 'most_voted' })}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Mais Votadas
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Contribution Detail Modal */}
        {selectedContribution && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedContribution.title}
                </h2>
                <button
                  onClick={() => setSelectedContribution(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="mb-6">
                  <div className="flex items-center mb-4">
                    <div className="flex items-center text-sm text-gray-500 mr-4">
                      {getTypeIcon(selectedContribution.type)}
                      <span className="ml-1 capitalize">{selectedContribution.type}</span>
                    </div>
                    {getStatusIcon(selectedContribution.status)}
                    <span className="ml-1 text-sm text-gray-500 capitalize">
                      {selectedContribution.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-4">{selectedContribution.description}</p>

                  {selectedContribution.content && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Conteúdo Proposto:</h4>
                      <div className="prose max-w-none">
                        {selectedContribution.content}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center text-sm text-gray-500">
                      <img
                        src={selectedContribution.contributor.avatar || '/default-avatar.png'}
                        alt={selectedContribution.contributor.name}
                        className="h-8 w-8 rounded-full mr-3"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {selectedContribution.contributor.name}
                        </p>
                        <p className="text-xs">
                          {selectedContribution.contributor.contributions_count} contribuições
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <button
                          onClick={() => voteContribution(selectedContribution.id, 'up')}
                          className={`p-2 rounded hover:bg-gray-100 ${
                            selectedContribution.votes.user_vote === 'up' ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          <HandThumbUpIcon className="h-5 w-5" />
                        </button>
                        <span className="text-sm text-gray-600 mx-2">
                          {selectedContribution.votes.up}
                        </span>
                        <button
                          onClick={() => voteContribution(selectedContribution.id, 'down')}
                          className={`p-2 rounded hover:bg-gray-100 ${
                            selectedContribution.votes.user_vote === 'down' ? 'text-red-600' : 'text-gray-400'
                          }`}
                        >
                          <HandThumbDownIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="font-medium text-gray-900 mb-4">
                    Comentários ({comments.length})
                  </h4>

                  <div className="space-y-4 mb-6">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <img
                          src={comment.author.avatar || '/default-avatar.png'}
                          alt={comment.author.name}
                          className="h-8 w-8 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {comment.author.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {comment.author.role}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatRelativeTime(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-700 mt-1">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Comment */}
                  <div className="flex space-x-3">
                    <img
                      src="/default-avatar.png"
                      alt="Você"
                      className="h-8 w-8 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Adicione um comentário..."
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => addComment(selectedContribution.id)}
                          disabled={!newComment.trim()}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Comentar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}