'use client';

import { useState } from 'react';
import { LeaderboardEntry, formatPoints, getStreakEmoji, getRankEmoji } from '@/lib/gamification/points-system';

interface LeaderboardWidgetProps {
  leaderboard: LeaderboardEntry[];
  currentUserId?: string;
  showOptInToggle?: boolean;
  onOptInChange?: (optedIn: boolean) => void;
  compact?: boolean;
}

export default function LeaderboardWidget({
  leaderboard,
  currentUserId,
  showOptInToggle = false,
  onOptInChange,
  compact = false,
}: LeaderboardWidgetProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all-time'>('month');
  const [teamFilter, setTeamFilter] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<'full' | 'top10' | 'neighbors'>('full');

  const currentUser = leaderboard.find((entry) => entry.userId === currentUserId);

  // Get unique teams
  const teams = Array.from(new Set(leaderboard.map((e) => e.teamId).filter(Boolean)));

  // Filter leaderboard
  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (teamFilter !== 'all' && entry.teamId !== teamFilter) return false;
    return true;
  });

  // Apply view mode
  const displayLeaderboard = (() => {
    switch (viewMode) {
      case 'top10':
        return filteredLeaderboard.slice(0, 10);
      case 'neighbors':
        if (!currentUserId) return filteredLeaderboard.slice(0, 10);
        const currentIndex = filteredLeaderboard.findIndex((e) => e.userId === currentUserId);
        if (currentIndex === -1) return filteredLeaderboard.slice(0, 10);
        const start = Math.max(0, currentIndex - 2);
        const end = Math.min(filteredLeaderboard.length, currentIndex + 3);
        return filteredLeaderboard.slice(start, end);
      default:
        return filteredLeaderboard;
    }
  })();

  const percentile = currentUser
    ? Math.round(((leaderboard.length - currentUser.rank + 1) / leaderboard.length) * 100)
    : 0;

  if (compact) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-4">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          Melhores Desempenhos
        </h3>
        <div className="space-y-2">
          {displayLeaderboard.slice(0, 5).map((entry) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                entry.userId === currentUserId ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200' : 'hover:bg-neutral-50'
              }`}
            >
              <span className="text-2xl">{getRankEmoji(entry.rank) || `#${entry.rank}`}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{entry.username}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatPoints(entry.points)} pts</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-t-lg text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <h2 className="text-2xl font-bold">Classificação</h2>
              <p className="text-sm opacity-90">
                {filteredLeaderboard.length} {filteredLeaderboard.length === 1 ? 'jogador' : 'jogadores'}
              </p>
            </div>
          </div>

          {/* Opt-in/out Toggle */}
          {showOptInToggle && currentUser && (
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {currentUser.optedIn ? 'Visível' : 'Oculto'}
              </span>
              <button
                onClick={() => onOptInChange?.(!currentUser.optedIn)}
                aria-label="Alternar visibilidade no ranking"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  currentUser.optedIn ? 'bg-green-500' : 'bg-neutral-400'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    currentUser.optedIn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* Current User Stats */}
        {currentUser && currentUser.optedIn && (
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Sua Classificação</p>
                <p className="text-3xl font-bold">
                  {getRankEmoji(currentUser.rank)} #{currentUser.rank}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">Top {percentile}%</p>
                <p className="text-2xl font-bold">{formatPoints(currentUser.points)} pts</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 space-y-3">
        {/* Period Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Período:</span>
          <div className="flex gap-2">
            {(['day', 'week', 'month', 'all-time'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
                }`}
              >
                {p === 'all-time' ? 'Todos os Tempos' : p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </div>

        {/* Team Filter */}
        {teams.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Equipe:</span>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              aria-label="Filtrar por equipe"
              className="px-3 py-1 min-h-[44px] border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-neutral-200"
            >
              <option value="all">Todas as Equipes</option>
              {teams.map((teamId) => {
                const teamEntry = leaderboard.find((e) => e.teamId === teamId);
                return (
                  <option key={teamId} value={teamId}>
                    {teamEntry?.teamName || teamId}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* View Mode */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Visualizar:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('full')}
              className={`px-3 py-1 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                viewMode === 'full'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setViewMode('top10')}
              className={`px-3 py-1 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                viewMode === 'top10'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
              }`}
            >
              Top 10
            </button>
            {currentUserId && (
              <button
                onClick={() => setViewMode('neighbors')}
                className={`px-3 py-1 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                  viewMode === 'neighbors'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
                }`}
              >
                Ao Meu Redor
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Pos.
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Jogador
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Pontos
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Estatísticas
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Sequência
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
            {displayLeaderboard.map((entry, _index) => (
              <tr
                key={entry.userId}
                className={`
                  ${entry.userId === currentUserId ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'}
                  ${entry.rank <= 3 ? 'font-semibold' : ''}
                  transition-colors
                `}
              >
                {/* Rank */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getRankEmoji(entry.rank)}</span>
                    <span
                      className={`text-lg ${
                        entry.rank === 1
                          ? 'text-yellow-600'
                          : entry.rank === 2
                          ? 'text-neutral-500 dark:text-neutral-400'
                          : entry.rank === 3
                          ? 'text-orange-600'
                          : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      #{entry.rank}
                    </span>
                  </div>
                </td>

                {/* Player */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-10 w-10">
                      {entry.avatarUrl ? (
                        <img
                          className="h-10 w-10 rounded-full"
                          src={entry.avatarUrl}
                          alt={entry.username}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                          {entry.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {entry.username}
                        {entry.userId === currentUserId && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Você
                          </span>
                        )}
                      </p>
                      {entry.teamName && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{entry.teamName}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Points */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <p className="font-bold text-neutral-900 dark:text-neutral-100">{formatPoints(entry.points)}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{entry.badges} badges</p>
                  </div>
                </td>

                {/* Stats */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-xs text-neutral-600 space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{entry.ticketsResolved}</span>
                      <span className="text-neutral-400">tickets</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">⭐</span>
                        <span>{entry.avgCsat.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-green-500">✓</span>
                        <span>{entry.fcrRate.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Streak */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xl">{getStreakEmoji(entry.currentStreak)}</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {entry.currentStreak} {entry.currentStreak === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {displayLeaderboard.length === 0 && (
        <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
          <p className="text-lg font-medium mb-2">Sem dados disponíveis</p>
          <p className="text-sm">Comece a ganhar pontos para aparecer na classificação!</p>
        </div>
      )}

      {/* Footer Info */}
      {currentUser && !currentUser.optedIn && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              Você está oculto na classificação. Ative o botão acima para participar e competir com sua equipe!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mini Leaderboard Card for Dashboard
 */
interface MiniLeaderboardProps {
  topPerformers: LeaderboardEntry[];
  currentUser?: LeaderboardEntry;
  onViewAll?: () => void;
}

export function MiniLeaderboard({
  topPerformers,
  currentUser,
  onViewAll,
}: MiniLeaderboardProps) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          Melhores Desempenhos
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver Todos
          </button>
        )}
      </div>

      <div className="space-y-3">
        {topPerformers.slice(0, 5).map((entry) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              entry.userId === currentUser?.userId ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            <span className="text-2xl">{getRankEmoji(entry.rank) || `#${entry.rank}`}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{entry.username}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatPoints(entry.points)} pts • {getStreakEmoji(entry.currentStreak)} {entry.currentStreak}d
              </p>
            </div>
          </div>
        ))}
      </div>

      {currentUser && currentUser.rank > 5 && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <span className="text-lg font-bold text-blue-600">#{currentUser.rank}</span>
            <div className="flex-1">
              <p className="font-semibold text-blue-900 dark:text-blue-200">Você</p>
              <p className="text-xs text-blue-600">
                {formatPoints(currentUser.points)} pts
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
