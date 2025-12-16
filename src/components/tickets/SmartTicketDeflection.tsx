'use client'

import React, { useState, useEffect } from 'react'
import { LightBulbIcon, ChevronRightIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

interface Article {
    id: number
    title: string
    excerpt: string
    slug: string
}

interface SmartTicketDeflectionProps {
    query: string
    onArticleClick?: (article: Article) => void
}

export default function SmartTicketDeflection({ query, onArticleClick }: SmartTicketDeflectionProps) {
    const [suggestions, setSuggestions] = useState<Article[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!query || query.length < 3) {
            setSuggestions([])
            return
        }

        const searchArticles = async () => {
            setLoading(true)
            try {
                const response = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}&limit=5`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.success && Array.isArray(data.results)) {
                        setSuggestions(data.results.map((item: any) => ({
                            id: item.id,
                            title: item.title,
                            excerpt: item.summary || item.content.substring(0, 100) + '...',
                            slug: item.slug
                        })))
                    }
                }
            } catch (error) {
                console.error('Failed to fetch suggestions:', error)
            } finally {
                setLoading(false)
            }
        }

        const timeoutId = setTimeout(searchArticles, 500)
        return () => clearTimeout(timeoutId)
    }, [query])

    if (!query || (suggestions.length === 0 && !loading)) {
        return null
    }

    return (
        <div className="glass-panel p-4 rounded-xl border border-brand-500/20 bg-brand-500/5 animate-fade-in mt-4">
            <div className="flex items-center space-x-2 mb-3">
                <div className="p-1.5 bg-brand-500/20 rounded-lg">
                    <LightBulbIcon className="w-5 h-5 text-brand-500" />
                </div>
                <h3 className="font-medium text-neutral-900 dark:text-white">
                    Sugestões Inteligentes
                </h3>
                {loading && (
                    <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin ml-2" />
                )}
            </div>

            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                Encontramos alguns artigos que podem ajudar a resolver seu problema agora mesmo:
            </p>

            <div className="space-y-2">
                {suggestions.map((article) => (
                    <button
                        key={article.id}
                        onClick={(e) => {
                            e.preventDefault() // Prevent form submission
                            onArticleClick?.(article)
                        }}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group flex items-start space-x-3"
                    >
                        <DocumentTextIcon className="w-5 h-5 text-neutral-400 mt-0.5 group-hover:text-brand-400 transition-colors" />
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-brand-400 transition-colors">
                                {article.title}
                            </h4>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                                {article.excerpt}
                            </p>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                    </button>
                ))}
            </div>
        </div>
    )
}
