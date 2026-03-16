'use client';

import ConversationalPortal from '@/src/components/portal/ConversationalPortal';
import { ChatBubbleLeftRightIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Breadcrumbs */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            <Link
              href="/portal"
              className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              Portal
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5" />
            <span className="text-neutral-900 dark:text-neutral-100 font-medium flex items-center gap-1.5">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-brand-500" />
              Assistente Virtual
            </span>
          </nav>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="h-[calc(100vh-140px)] min-h-[500px]">
          <ConversationalPortal />
        </div>
      </div>
    </div>
  );
}
