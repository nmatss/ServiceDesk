'use client';

import { useState } from 'react';
import {
  TicketIcon,
  PencilSquareIcon,
  CheckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface TicketData {
  title: string;
  category: string;
  urgency: string;
  description: string;
  service?: string;
  error_message?: string;
  affected_users?: string;
  since_when?: string;
}

interface TicketConfirmationProps {
  ticket: TicketData;
  onConfirm: () => void;
  onCancel: () => void;
  isCreating?: boolean;
  createdTicketId?: number;
  createdTicketUrl?: string;
}

export default function TicketConfirmation({
  ticket,
  onConfirm,
  onCancel,
  isCreating = false,
  createdTicketId,
  createdTicketUrl,
}: TicketConfirmationProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localTicket, setLocalTicket] = useState<TicketData>({ ...ticket });

  const urgencyColors: Record<string, string> = {
    Alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Média: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Baixa: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  // Ticket created state
  if (createdTicketId) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-green-200 dark:border-green-800 rounded-xl shadow-sm overflow-hidden animate-fade-in max-w-md">
        <div className="px-4 py-4 bg-green-50 dark:bg-green-900/20 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-3">
            <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h4 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-1">
            Ticket #{createdTicketId} criado!
          </h4>
          <p className="text-sm text-green-700 dark:text-green-400">
            Nossa equipe foi notificada e entraremos em contato em breve.
          </p>
          {createdTicketUrl && (
            <a
              href={createdTicketUrl}
              className="inline-block mt-3 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Acompanhar ticket
            </a>
          )}
        </div>
      </div>
    );
  }

  const handleFieldEdit = (field: keyof TicketData, value: string) => {
    setLocalTicket(prev => ({ ...prev, [field]: value }));
    setEditingField(null);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm overflow-hidden animate-fade-in max-w-md">
      {/* Header */}
      <div className="px-4 py-3 bg-brand-50 dark:bg-brand-900/20 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
        <TicketIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
          Confirmar criação do ticket
        </span>
      </div>

      {/* Fields */}
      <div className="px-4 py-3 space-y-3">
        {/* Title */}
        <EditableField
          label="Título"
          value={localTicket.title}
          isEditing={editingField === 'title'}
          onEdit={() => setEditingField('title')}
          onSave={(v) => handleFieldEdit('title', v)}
          onCancel={() => setEditingField(null)}
        />

        {/* Category */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Categoria
          </span>
          <span className="text-sm text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
            {localTicket.category}
          </span>
        </div>

        {/* Urgency */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Urgência
          </span>
          <span className={`text-sm px-2 py-0.5 rounded font-medium ${urgencyColors[localTicket.urgency] || urgencyColors['Média']}`}>
            {localTicket.urgency}
          </span>
        </div>

        {/* Service */}
        {localTicket.service && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Serviço
            </span>
            <span className="text-sm text-neutral-900 dark:text-neutral-100">
              {localTicket.service}
            </span>
          </div>
        )}

        {/* Error message */}
        {localTicket.error_message && (
          <div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Erro reportado
            </span>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
              {localTicket.error_message}
            </p>
          </div>
        )}

        {/* Affected users */}
        {localTicket.affected_users && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Afetados
            </span>
            <span className="text-sm text-neutral-900 dark:text-neutral-100">
              {localTicket.affected_users}
            </span>
          </div>
        )}

        {/* Description preview */}
        <div>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Descrição
          </span>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5 line-clamp-3">
            {localTicket.description}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex gap-2">
        <button
          onClick={onCancel}
          disabled={isCreating}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={isCreating}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isCreating ? (
            <>
              <span className="inline-flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              Criando...
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              Confirmar e criar ticket
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Editable Field ───────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(value);

  if (isEditing) {
    return (
      <div>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          {label}
        </span>
        <div className="flex gap-1 mt-0.5">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave(editValue);
              if (e.key === 'Escape') onCancel();
            }}
            className="flex-1 text-sm px-2 py-1 border border-brand-300 dark:border-brand-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            autoFocus
          />
          <button
            onClick={() => onSave(editValue)}
            className="px-2 py-1 bg-brand-500 text-white text-xs rounded hover:bg-brand-600"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <div>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          {label}
        </span>
        <p className="text-sm text-neutral-900 dark:text-neutral-100">{value}</p>
      </div>
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-brand-500 transition-all"
        title="Editar"
      >
        <PencilSquareIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
