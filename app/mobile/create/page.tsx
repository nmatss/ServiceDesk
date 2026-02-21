'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { VoiceInput } from '@/src/components/mobile/VoiceInput'
import { MobileNav } from '@/src/components/mobile/MobileNav'
import {
  PhotoIcon,
  PaperClipIcon,
  XMarkIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline'

export default function MobileCreateTicketPage() {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [category, setCategory] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [showVoiceInput, setShowVoiceInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleVoiceTranscript = (transcript: string) => {
    setDescription(prev => prev + (prev ? ' ' : '') + transcript)
  }

  const handleImageCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files)
      setAttachments(prev => [...prev, ...files])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject || !description) {
      toast.error('Preencha o assunto e a descrição')
      return
    }

    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      console.log('Ticket created:', { subject, description, priority, category, attachments })

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([10, 50, 10])
      }

      router.push('/mobile/tickets')
    } catch (error) {
      console.error('Error creating ticket:', error)
      toast.error('Erro ao criar ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            New Ticket
          </h1>
          <button
            onClick={() => router.back()}
            className="p-2 text-description hover:text-neutral-900 dark:hover:text-neutral-100 min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Subject *
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of the issue"
            className="w-full px-4 py-3 glass-panel border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent min-h-[44px] transition-all"
            required
          />
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-4 py-3 glass-panel border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent min-h-[44px] transition-all"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 glass-panel border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent min-h-[44px] transition-all"
          >
            <option value="">Select category</option>
            <option value="technical">Technical Issue</option>
            <option value="billing">Billing</option>
            <option value="feature">Feature Request</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="description" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Description *
            </label>
            <button
              type="button"
              onClick={() => setShowVoiceInput(!showVoiceInput)}
              className="p-2 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px]"
              aria-label="Toggle voice input"
            >
              <MicrophoneIcon className="w-5 h-5" />
            </button>
          </div>

          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the issue"
            rows={6}
            className="w-full px-4 py-3 glass-panel border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent resize-none transition-all"
            required
          />

          {/* Voice Input */}
          {showVoiceInput && (
            <div className="mt-3">
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                language="en-US"
                continuous={true}
              />
            </div>
          )}
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Attachments
          </label>

          <div className="flex items-center space-x-2">
            {/* Camera Capture */}
            <label className="flex items-center space-x-2 px-4 py-3 glass-panel border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:border-brand-500 dark:hover:border-brand-600 transition-all cursor-pointer min-h-[44px] group">
              <PhotoIcon className="w-5 h-5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
              <span className="text-sm font-medium">Camera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageCapture}
                className="hidden"
              />
            </label>

            {/* File Upload */}
            <label className="flex items-center space-x-2 px-4 py-3 glass-panel border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:border-brand-500 dark:hover:border-brand-600 transition-all cursor-pointer min-h-[44px] group">
              <PaperClipIcon className="w-5 h-5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
              <span className="text-sm font-medium">Files</span>
              <input
                type="file"
                multiple
                onChange={handleImageCapture}
                className="hidden"
              />
            </label>
          </div>

          {/* Attachment List */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 glass-panel border border-neutral-200 dark:border-neutral-700 rounded-lg animate-slide-up"
                >
                  <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate flex-1">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="ml-2 p-1 text-priority-critical hover:bg-priority-critical/10 dark:hover:bg-priority-critical/20 rounded min-h-[36px] min-w-[36px] transition-all"
                    aria-label="Remove attachment"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !subject || !description}
          className="w-full px-6 py-4 bg-gradient-brand hover:opacity-90 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed min-h-[52px] shadow-lg hover:shadow-xl"
        >
          {isSubmitting ? 'Creating Ticket...' : 'Create Ticket'}
        </button>
      </form>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  )
}
