'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ChatMessage from './ChatMessage';
import SolutionCard from './SolutionCard';
import TicketConfirmation from './TicketConfirmation';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MessageItem {
  id: string;
  role: 'user' | 'bot';
  text: string;
  type: 'text' | 'solution_card' | 'ticket_confirmation' | 'resolved';
  timestamp: Date;
  data?: Record<string, unknown>;
  quickReplies?: string[];
}

interface ConversationApiResponse {
  success: boolean;
  data: {
    session_id: string;
    response: {
      type: 'text' | 'solution_card' | 'ticket_confirmation' | 'resolved';
      text: string;
      data?: Record<string, unknown>;
      quickReplies?: string[];
    };
    state: string;
    extracted_entities: Record<string, string>;
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConversationalPortal() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore session from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('chat_session_id');
    if (stored) {
      setSessionId(stored);
    }
  }, []);

  // Auto-greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: MessageItem = {
        id: 'greeting',
        role: 'bot',
        text: 'Olá! Sou o assistente virtual do Insighta. Descreva o seu problema ou dúvida e vou tentar ajudar. Se necessário, posso abrir um ticket para você.',
        type: 'text',
        timestamp: new Date(),
        quickReplies: [
          'Problema com email',
          'Computador lento',
          'Preciso de acesso a um sistema',
          'Impressora não funciona',
        ],
      };
      setMessages([greeting]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send Message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setError(null);
      const userMsg: MessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: text.trim(),
        type: 'text',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
        const res = await fetch('/api/ai/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            message: text.trim(),
          }),
        });

        const json: ConversationApiResponse = await res.json();

        if (!json.success) {
          throw new Error((json as unknown as { error: string }).error || 'Erro desconhecido');
        }

        const { data } = json;

        // Persist session
        if (!sessionId && data.session_id) {
          setSessionId(data.session_id);
          sessionStorage.setItem('chat_session_id', data.session_id);
        }

        const botMsg: MessageItem = {
          id: `bot-${Date.now()}`,
          role: 'bot',
          text: data.response.text,
          type: data.response.type,
          timestamp: new Date(),
          data: data.response.data,
          quickReplies: data.response.quickReplies,
        };
        setMessages(prev => [...prev, botMsg]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
        setError(errMsg);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [isLoading, sessionId]
  );

  // ─── Handle Quick Reply ────────────────────────────────────────────────────

  const handleQuickReply = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ─── End Session ───────────────────────────────────────────────────────────

  const endSession = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/ai/conversation/${sessionId}`, { method: 'DELETE' });
      } catch {
        // Non-critical
      }
      sessionStorage.removeItem('chat_session_id');
    }
    setSessionId(null);
    setMessages([]);
    setInput('');
    setError(null);
  };

  // Get the last bot message for quick replies
  const lastBotMessage = [...messages].reverse().find(m => m.role === 'bot');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-lg overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-brand-500 dark:bg-brand-700 text-white">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">Assistente Virtual Insighta</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/80">Online</span>
          </div>
        </div>
        {sessionId && (
          <button
            onClick={endSession}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="Encerrar conversa"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth bg-neutral-50 dark:bg-neutral-900/50">
        {messages.map(msg => {
          // Solution card
          if (msg.type === 'solution_card' && msg.data?.article) {
            const article = msg.data.article as {
              id: number;
              title: string;
              summary: string;
              content: string;
              confidence: number;
            };
            return (
              <div key={msg.id} className="space-y-2">
                <ChatMessage
                  message={msg.text}
                  sender="bot"
                  timestamp={msg.timestamp}
                  type="solution"
                />
                <div className="ml-10">
                  <SolutionCard
                    article={article}
                    onResolved={() => handleQuickReply('Sim, resolveu!')}
                    onNotResolved={() => handleQuickReply('Não, preciso de ajuda')}
                  />
                </div>
              </div>
            );
          }

          // Ticket confirmation
          if (msg.type === 'ticket_confirmation' && msg.data?.ticket) {
            const ticket = msg.data.ticket as {
              title: string;
              category: string;
              urgency: string;
              description: string;
              service?: string;
              error_message?: string;
              affected_users?: string;
              since_when?: string;
            };
            return (
              <div key={msg.id} className="space-y-2">
                <ChatMessage
                  message={msg.text}
                  sender="bot"
                  timestamp={msg.timestamp}
                  type="confirmation"
                />
                <div className="ml-10">
                  <TicketConfirmation
                    ticket={ticket}
                    onConfirm={() => handleQuickReply('Confirmar e criar ticket')}
                    onCancel={() => handleQuickReply('Voltar ao chat')}
                    isCreating={isLoading}
                    createdTicketId={msg.data.ticketId as number | undefined}
                    createdTicketUrl={msg.data.ticketUrl as string | undefined}
                  />
                </div>
              </div>
            );
          }

          // Text or resolved
          return (
            <ChatMessage
              key={msg.id}
              message={msg.text}
              sender={msg.role}
              timestamp={msg.timestamp}
              type="text"
            />
          );
        })}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-auto max-w-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Replies ──────────────────────────────────────────── */}
      {lastBotMessage?.quickReplies && lastBotMessage.quickReplies.length > 0 && !isLoading && (
        <div className="px-4 py-2 bg-white dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-wrap gap-2">
            {lastBotMessage.quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleQuickReply(reply)}
                className="px-3 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white transition-colors"
            title="Enviar mensagem"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 text-center">
          Enter para enviar &middot; Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
