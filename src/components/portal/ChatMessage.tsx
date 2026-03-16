'use client';

import { useEffect, useRef } from 'react';

interface ChatMessageProps {
  message: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'solution' | 'confirmation';
}

export default function ChatMessage({ message, sender, timestamp, type = 'text' }: ChatMessageProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const isUser = sender === 'user';
  const time = new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      ref={ref}
      className={`flex items-end gap-2 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Bot avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-brand-600 dark:text-brand-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
      )}

      {/* Message bubble */}
      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-500 text-white rounded-br-md'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-md'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message}</p>
          ) : (
            <div className="whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none">
              <BotMessageContent text={message} />
            </div>
          )}
        </div>
        <p
          className={`text-xs text-neutral-400 dark:text-neutral-500 mt-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {time}
        </p>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

/** Simple markdown-like renderer for bot messages (bold, links, lists) */
function BotMessageContent({ text }: { text: string }) {
  // Split by lines and render
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={j} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          // Simple link detection
          const linkParts = part.split(/(https?:\/\/[^\s]+)/g);
          return linkParts.map((lp, k) => {
            if (lp.match(/^https?:\/\//)) {
              return (
                <a
                  key={`${j}-${k}`}
                  href={lp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 dark:text-brand-400 underline"
                >
                  {lp}
                </a>
              );
            }
            return <span key={`${j}-${k}`}>{lp}</span>;
          });
        });

        // List items
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-1.5 ml-2">
              <span className="text-brand-500 mt-0.5">&#8226;</span>
              <span>{rendered}</span>
            </div>
          );
        }

        return (
          <p key={i} className={i < lines.length - 1 && line === '' ? 'h-2' : ''}>
            {rendered}
          </p>
        );
      })}
    </>
  );
}
