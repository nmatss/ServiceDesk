/**
 * Ticket Tags Component
 *
 * Display and manage tags on a ticket with add/remove functionality.
 *
 * @module src/components/tickets/TicketTags
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, PlusIcon, TagIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/badge';

interface Tag {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface TicketTagsProps {
  ticketId: number;
  initialTags?: Tag[];
  userId?: number;
  readOnly?: boolean;
  maxVisible?: number;
  onTagsChange?: (tags: Tag[]) => void;
  className?: string;
}

export function TicketTags({
  ticketId,
  initialTags = [],
  userId,
  readOnly = false,
  maxVisible = 5,
  onTagsChange,
  className = '',
}: TicketTagsProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch tags for the ticket
  useEffect(() => {
    if (!initialTags.length) {
      fetchTicketTags();
    }
  }, [ticketId]);

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAdding(false);
        setSearchTerm('');
        setSuggestions([]);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTicketTags = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/tags`);
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const searchTags = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/tags?search=${encodeURIComponent(term)}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out already added tags
        const filtered = data.filter(
          (tag: Tag) => !tags.some((t) => t.id === tag.id)
        );
        setSuggestions(filtered.slice(0, 10));
      }
    } catch (error) {
      console.error('Error searching tags:', error);
    }
  }, [tags]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTags(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchTags]);

  const addTag = async (tagId?: number, tagName?: string) => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const body: { tagIds?: number[]; tagNames?: string[]; userId: number } = { userId };
      if (tagId) {
        body.tagIds = [tagId];
      } else if (tagName) {
        body.tagNames = [tagName];
      }

      const response = await fetch(`/api/tickets/${ticketId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchTicketTags();
        onTagsChange?.(tags);
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setIsLoading(false);
      setIsAdding(false);
      setSearchTerm('');
      setSuggestions([]);
    }
  };

  const removeTag = async (tagId: number) => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/tickets/${ticketId}/tags?tagId=${tagId}&userId=${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        const newTags = tags.filter((t) => t.id !== tagId);
        setTags(newTags);
        onTagsChange?.(newTags);
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      // If there's a suggestion, add that, otherwise create new tag
      if (suggestions.length > 0 && suggestions[0]) {
        addTag(suggestions[0].id);
      } else {
        addTag(undefined, searchTerm.trim());
      }
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setSearchTerm('');
      setSuggestions([]);
    }
  };

  const visibleTags = showAll ? tags : tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* Tag Icon */}
      <TagIcon className="h-4 w-4 text-gray-400 mr-1" />

      {/* Tags */}
      {visibleTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="group flex items-center gap-1 pl-2 pr-1 py-0.5"
          style={{
            backgroundColor: `${tag.color}15`,
            borderColor: `${tag.color}40`,
            color: tag.color,
          }}
        >
          <span className="text-xs font-medium">{tag.name}</span>
          {!readOnly && (
            <button
              onClick={() => removeTag(tag.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
              disabled={isLoading}
              title={`Remove ${tag.name}`}
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {/* Show more button */}
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100"
        >
          +{hiddenCount} more
        </button>
      )}

      {/* Show less button */}
      {showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100"
        >
          Show less
        </button>
      )}

      {/* Add tag button/input */}
      {!readOnly && (
        <div className="relative" ref={dropdownRef}>
          {isAdding ? (
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type tag name..."
                className="w-32 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10 max-h-48 overflow-auto">
                  {suggestions.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => addTag(tag.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Create new tag option */}
              {searchTerm.trim() && !suggestions.some(s => s.name.toLowerCase() === searchTerm.toLowerCase()) && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                  <button
                    onClick={() => addTag(undefined, searchTerm.trim())}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Create "{searchTerm}"</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              <PlusIcon className="h-3 w-3" />
              Add
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {tags.length === 0 && readOnly && (
        <span className="text-xs text-gray-400 italic">No tags</span>
      )}
    </div>
  );
}

export default TicketTags;
