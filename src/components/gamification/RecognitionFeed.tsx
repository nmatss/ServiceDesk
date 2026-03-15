'use client';

import { useState, useRef, useEffect } from 'react';

interface Recognition {
  id: string;
  type: 'kudos' | 'milestone' | 'helper-of-month' | 'success-story';
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl?: string;
  toUserId: string;
  toUsername: string;
  toAvatarUrl?: string;
  message: string;
  points?: number;
  ticketId?: string;
  createdAt: Date;
  reactions: {
    userId: string;
    emoji: string;
  }[];
}

interface RecognitionFeedProps {
  recognitions: Recognition[];
  currentUserId?: string;
  onSendKudos?: (toUserId: string, message: string) => void;
  onReact?: (recognitionId: string, emoji: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function RecognitionFeed({
  recognitions,
  currentUserId,
  onSendKudos,
  onReact,
  onLoadMore,
  hasMore = false,
}: RecognitionFeedProps) {
  const [showKudosForm, setShowKudosForm] = useState(false);
  const [filter, setFilter] = useState<Recognition['type'] | 'all'>('all');

  const filteredRecognitions = recognitions.filter((r) => {
    if (filter === 'all') return true;
    return r.type === filter;
  });

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-6 rounded-t-lg text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎉</span>
            <div>
              <h2 className="text-2xl font-bold">Recognition Feed</h2>
              <p className="text-sm opacity-90">Celebrate team wins and peer support</p>
            </div>
          </div>
          {onSendKudos && (
            <button
              onClick={() => setShowKudosForm(true)}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
            >
              + Send Kudos
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex gap-2">
          {(['all', 'kudos', 'milestone', 'helper-of-month', 'success-story'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${
                filter === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
              }`}
            >
              {type === 'all' ? 'All' : type.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {filteredRecognitions.map((recognition) => (
          <RecognitionCard
            key={recognition.id}
            recognition={recognition}
            currentUserId={currentUserId}
            onReact={onReact}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="p-4 text-center border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onLoadMore}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Load More
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredRecognitions.length === 0 && (
        <div className="p-12 text-center text-neutral-500">
          <p className="text-lg font-medium mb-2">Nenhum reconhecimento ainda</p>
          <p className="text-sm">Seja o primeiro a enviar um reconhecimento para um colega!</p>
        </div>
      )}

      {/* Kudos Form Modal */}
      {showKudosForm && onSendKudos && (
        <KudosFormModal
          onClose={() => setShowKudosForm(false)}
          onSend={onSendKudos}
        />
      )}
    </div>
  );
}

/**
 * Recognition Card Component
 */
interface RecognitionCardProps {
  recognition: Recognition;
  currentUserId?: string;
  onReact?: (recognitionId: string, emoji: string) => void;
}

function RecognitionCard({ recognition, currentUserId, onReact }: RecognitionCardProps) {
  const [showReactions, setShowReactions] = useState(false);

  const getIcon = () => {
    switch (recognition.type) {
      case 'kudos':
        return '👏';
      case 'milestone':
        return '🎯';
      case 'helper-of-month':
        return '🏅';
      case 'success-story':
        return '⭐';
      default:
        return '🎉';
    }
  };

  const getTypeColor = () => {
    switch (recognition.type) {
      case 'kudos':
        return 'text-brand-600 bg-brand-100';
      case 'milestone':
        return 'text-green-600 bg-green-100';
      case 'helper-of-month':
        return 'text-yellow-600 bg-yellow-100';
      case 'success-story':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-neutral-600 bg-neutral-100';
    }
  };

  const reactionEmojis = ['👍', '❤️', '🎉', '🔥', '💯', '🚀'];
  const reactionCounts = reactionEmojis.reduce((acc, emoji) => {
    acc[emoji] = recognition.reactions.filter((r) => r.emoji === emoji).length;
    return acc;
  }, {} as Record<string, number>);

  const userReacted = recognition.reactions.some((r) => r.userId === currentUserId);

  return (
    <div className="p-6 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {recognition.fromAvatarUrl ? (
            <img
              className="h-12 w-12 rounded-full"
              src={recognition.fromAvatarUrl}
              alt={recognition.fromUsername}
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              {recognition.fromUsername.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                <span className="font-semibold">{recognition.fromUsername}</span>
                {recognition.type === 'kudos' && (
                  <>
                    {' '}gave kudos to{' '}
                    <span className="font-semibold">{recognition.toUsername}</span>
                  </>
                )}
                {recognition.type === 'milestone' && (
                  <>
                    {' '}achieved a milestone
                  </>
                )}
                {recognition.type === 'helper-of-month' && (
                  <>
                    {' '}was awarded Helper of the Month
                  </>
                )}
                {recognition.type === 'success-story' && (
                  <>
                    {' '}shared a success story
                  </>
                )}
              </p>
              <p className="text-xs text-neutral-500">
                {new Date(recognition.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor()}`}>
              {getIcon()} {recognition.type.replace('-', ' ')}
            </div>
          </div>

          {/* Message */}
          <div className="mb-3">
            <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{recognition.message}</p>
          </div>

          {/* Points Badge */}
          {recognition.points && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                <span>⭐</span>
                <span>+{recognition.points} points</span>
              </span>
            </div>
          )}

          {/* Reactions Bar */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                count > 0 && (
                  <button
                    key={emoji}
                    onClick={() => onReact?.(recognition.id, emoji)}
                    aria-label={`${emoji} ${count} ${count === 1 ? 'reação' : 'reações'}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors"
                  >
                    <span className="text-sm">{emoji}</span>
                    <span className="text-xs font-medium text-neutral-600">{count}</span>
                  </button>
                )
              ))}
            </div>

            {/* Add Reaction Button */}
            {onReact && (
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  aria-label="Adicionar reação"
                  aria-expanded={showReactions}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    userReacted
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {userReacted ? 'Reacted' : 'React'}
                </button>

                {/* Reaction Picker */}
                {showReactions && (
                  <div role="group" aria-label="Selecionar reação" className="absolute bottom-full left-0 mb-2 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2 flex gap-1 z-10">
                    {reactionEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReact(recognition.id, emoji);
                          setShowReactions(false);
                        }}
                        aria-label={`Reagir com ${emoji}`}
                        className="text-2xl hover:scale-125 transition-transform p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Kudos Form Modal
 */
interface KudosFormModalProps {
  onClose: () => void;
  onSend: (toUserId: string, message: string) => void;
}

function KudosFormModal({ onClose, onSend }: KudosFormModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mock user search - replace with actual search
  const searchResults = searchQuery
    ? [
        { id: '1', name: 'John Smith', avatar: null },
        { id: '2', name: 'Jane Doe', avatar: null },
        { id: '3', name: 'Mike Johnson', avatar: null },
      ].filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectedUser]);

  const handleSend = () => {
    if (selectedUser && message.trim()) {
      onSend(selectedUser.id, message);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Send Kudos 👏</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* User Search */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              To: {selectedUser ? selectedUser.name : 'Select a teammate'}
            </label>
            {!selectedUser ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar um colega..."
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg dark:shadow-neutral-900/20 max-h-48 overflow-auto z-10">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedUser({ id: user.id, name: user.name });
                          setSearchQuery('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">{user.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="font-medium text-purple-900">{selectedUser.name}</span>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-purple-600 hover:text-purple-700"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Message
            </label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell them why they're awesome! Be specific about what they did..."
              rows={4}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Tip: Use @kudos in comments to give quick recognition!
            </p>
          </div>

          {/* Quick Templates */}
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-2">Quick Templates:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Thanks for helping me with that tricky ticket!',
                'Great job resolving that critical issue so quickly!',
                'Your positive attitude makes our team better!',
                'Thanks for sharing your knowledge!',
              ].map((template, index) => (
                <button
                  key={index}
                  onClick={() => setMessage(template)}
                  className="text-xs px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:text-neutral-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedUser || !message.trim()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send Kudos
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper of the Month Component
 */
interface HelperOfMonthProps {
  helper: {
    userId: string;
    username: string;
    avatarUrl?: string;
    stats: {
      kudosReceived: number;
      ticketsResolved: number;
      avgCsat: number;
    };
  };
  month: string;
}

export function HelperOfTheMonth({ helper, month }: HelperOfMonthProps) {
  return (
    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-5xl">🏅</span>
        <div>
          <h3 className="text-2xl font-bold">Helper of the Month</h3>
          <p className="text-sm opacity-90">{month}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white bg-opacity-20 rounded-lg p-4">
        {helper.avatarUrl ? (
          <img
            className="h-16 w-16 rounded-full border-4 border-white"
            src={helper.avatarUrl}
            alt={helper.username}
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center text-yellow-600 font-bold text-2xl border-4 border-white">
            {helper.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h4 className="text-xl font-bold mb-2">{helper.username}</h4>
          <div className="flex items-center gap-4 text-sm">
            <span>👏 {helper.stats.kudosReceived} kudos</span>
            <span>🎯 {helper.stats.ticketsResolved} tickets</span>
            <span>⭐ {helper.stats.avgCsat}% CSAT</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm opacity-90">
        Recognized for outstanding peer support, knowledge sharing, and going above and beyond to help teammates succeed!
      </p>
    </div>
  );
}
