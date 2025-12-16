'use client'

import { useEffect, useCallback } from 'react'

// ========================================
// KEYBOARD SHORTCUT TYPES
// ========================================
export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description?: string
  action: () => void
  preventDefault?: boolean
}

export interface ShortcutGroup {
  name: string
  shortcuts: KeyboardShortcut[]
}

// ========================================
// KEYBOARD SHORTCUTS MANAGER
// ========================================
export class KeyboardShortcutsManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private enabled = true

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut) {
    const key = this.getShortcutKey(shortcut)
    this.shortcuts.set(key, shortcut)
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(shortcut: KeyboardShortcut) {
    const key = this.getShortcutKey(shortcut)
    this.shortcuts.delete(key)
  }

  /**
   * Handle keyboard event
   */
  handleKeyEvent(event: KeyboardEvent): boolean {
    if (!this.enabled) return false

    // Don't trigger shortcuts when user is typing in inputs
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow specific shortcuts even in inputs (like Cmd+K for search)
      const allowInInputs = ['k']
      if (!allowInInputs.includes(event.key.toLowerCase())) {
        return false
      }
    }

    const key = this.getEventKey(event)
    const shortcut = this.shortcuts.get(key)

    if (shortcut) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault()
      }
      shortcut.action()
      return true
    }

    return false
  }

  /**
   * Enable shortcuts
   */
  enable() {
    this.enabled = true
  }

  /**
   * Disable shortcuts
   */
  disable() {
    this.enabled = false
  }

  /**
   * Get all registered shortcuts
   */
  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * Clear all shortcuts
   */
  clear() {
    this.shortcuts.clear()
  }

  /**
   * Generate shortcut key from shortcut config
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts = []
    if (shortcut.ctrl) parts.push('ctrl')
    if (shortcut.shift) parts.push('shift')
    if (shortcut.alt) parts.push('alt')
    if (shortcut.meta) parts.push('meta')
    parts.push(shortcut.key.toLowerCase())
    return parts.join('+')
  }

  /**
   * Generate shortcut key from keyboard event
   */
  private getEventKey(event: KeyboardEvent): string {
    const parts = []
    if (event.ctrlKey) parts.push('ctrl')
    if (event.shiftKey) parts.push('shift')
    if (event.altKey) parts.push('alt')
    if (event.metaKey) parts.push('meta')
    parts.push(event.key.toLowerCase())
    return parts.join('+')
  }
}

// Global instance
let globalManager: KeyboardShortcutsManager | null = null

export function getGlobalShortcutsManager(): KeyboardShortcutsManager {
  if (!globalManager) {
    globalManager = new KeyboardShortcutsManager()
  }
  return globalManager
}

// ========================================
// REACT HOOKS
// ========================================

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const manager = getGlobalShortcutsManager()

  useEffect(() => {
    // Register shortcuts
    shortcuts.forEach((shortcut) => manager.register(shortcut))

    // Setup global event listener
    const handleKeyDown = (e: KeyboardEvent) => {
      manager.handleKeyEvent(e)
    }

    window.addEventListener('keydown', handleKeyDown)

    // Cleanup
    return () => {
      shortcuts.forEach((shortcut) => manager.unregister(shortcut))
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts, manager])
}

/**
 * Hook to register a single keyboard shortcut
 */
export function useKeyboardShortcut(
  key: string,
  action: () => void,
  options?: {
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
    description?: string
  }
) {
  const shortcut: KeyboardShortcut = {
    key,
    action,
    ...options,
  }

  useKeyboardShortcuts([shortcut])
}

/**
 * Hook to get readable shortcut label
 */
export function useShortcutLabel(shortcut: KeyboardShortcut): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
  const parts = []

  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl')
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win')

  const key = shortcut.key.toUpperCase()
  parts.push(key)

  return parts.join(isMac ? '' : '+')
}

// ========================================
// COMMON SHORTCUTS
// ========================================
export const commonShortcuts = {
  search: (action: () => void): KeyboardShortcut => ({
    key: 'k',
    meta: true,
    description: 'Abrir busca',
    action,
  }),

  newTicket: (action: () => void): KeyboardShortcut => ({
    key: 'n',
    meta: true,
    description: 'Novo ticket',
    action,
  }),

  save: (action: () => void): KeyboardShortcut => ({
    key: 's',
    meta: true,
    description: 'Salvar',
    action,
  }),

  help: (action: () => void): KeyboardShortcut => ({
    key: '/',
    meta: true,
    description: 'Ajuda',
    action,
  }),

  close: (action: () => void): KeyboardShortcut => ({
    key: 'Escape',
    description: 'Fechar',
    action,
    preventDefault: false,
  }),

  goToDashboard: (action: () => void): KeyboardShortcut => ({
    key: 'd',
    meta: true,
    shift: true,
    description: 'Ir para dashboard',
    action,
  }),

  goToTickets: (action: () => void): KeyboardShortcut => ({
    key: 't',
    meta: true,
    shift: true,
    description: 'Ir para tickets',
    action,
  }),

  toggleSidebar: (action: () => void): KeyboardShortcut => ({
    key: 'b',
    meta: true,
    description: 'Alternar sidebar',
    action,
  }),
}

// ========================================
// SHORTCUT DISPLAY COMPONENT HELPER
// ========================================
export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
  const parts = []

  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl')
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Ctrl')

  const keyMap: Record<string, string> = {
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: '↵',
  }

  const displayKey = keyMap[shortcut.key] || shortcut.key.toUpperCase()
  parts.push(displayKey)

  return parts.join(isMac ? '' : '+')
}
