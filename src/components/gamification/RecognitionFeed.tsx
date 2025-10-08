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
    <div className="bg-white rounded-lg shadow-lg">
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
      <div className="p-4 border-b border-gray-200">
        <div className="flex gap-2">
          {(['all', 'kudos', 'milestone', 'helper-of-month', 'success-story'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${
                filter === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'All' : type.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-gray-200">
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
        <div className="p-4 text-center border-t border-gray-200">
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
        <div className="p-12 text-center text-gray-500">
          <p className="text-lg font-medium mb-2">No recognition yet</p>
          <p className="text-sm">Be the first to send kudos to a teammate!</p>
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
        return 'text-blue-600 bg-blue-100';
      case 'milestone':
        return 'text-green-600 bg-green-100';
      case 'helper-of-month':
        return 'text-yellow-600 bg-yellow-100';
      case 'success-story':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const reactionEmojis = ['👍', '❤️', '🎉', '🔥', '💯', '🚀'];
  const reactionCounts = reactionEmojis.reduce((acc, emoji) => {
    acc[emoji] = recognition.reactions.filter((r) => r.emoji === emoji).length;
    return acc;
  }, {} as Record<string, number>);

  const userReacted = recognition.reactions.some((r) => r.userId === currentUserId);

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
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
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              {recognition.fromUsername.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
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
              <p className="text-xs text-gray-500">
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
            <p className="text-gray-700 whitespace-pre-wrap">{recognition.message}</p>
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
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <span className="text-sm">{emoji}</span>
                    <span className="text-xs font-medium text-gray-600">{count}</span>
                  </button>
                )
              ))}
            </div>

            {/* Add Reaction Button */}
            {onReact && (
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    userReacted
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {userReacted ? 'Reacted' : 'React'}
                </button>

                {/* Reaction Picker */}
                {showReactions && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1 z-10">
                    {reactionEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReact(recognition.id, emoji);
                          setShowReactions(false);
                        }}
                        className="text-2xl hover:scale-125 transition-transform"
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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Send Kudos 👏</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To: {selectedUser ? selectedUser.name : 'Select a teammate'}
            </label>
            {!selectedUser ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a teammate..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedUser({ id: user.id, name: user.name });
                          setSearchQuery('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{user.name}</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell them why they're awesome! Be specific about what they did..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: Use @kudos in comments to give quick recognition!
            </p>
          </div>

          {/* Quick Templates */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Templates:</p>
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
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
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
