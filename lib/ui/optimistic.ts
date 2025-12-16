'use client'

import { useState, useCallback } from 'react'
import { enhancedToast } from './toast'

// ========================================
// OPTIMISTIC UPDATE TYPES
// ========================================
export interface OptimisticUpdate<T> {
  optimisticData: T
  rollbackData: T
  action: () => Promise<void>
  onSuccess?: (data?: T) => void
  onError?: (error: Error) => void
}

export interface OptimisticState<T> {
  data: T
  isOptimistic: boolean
  error: Error | null
}

// ========================================
// OPTIMISTIC UPDATE HOOK
// ========================================
export function useOptimisticUpdate<T>(initialData: T) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    isOptimistic: false,
    error: null,
  })

  const performOptimisticUpdate = useCallback(
    async ({ optimisticData, rollbackData, action, onSuccess, onError }: OptimisticUpdate<T>) => {
      // Apply optimistic update immediately
      setState({
        data: optimisticData,
        isOptimistic: true,
        error: null,
      })

      try {
        // Perform the actual action
        await action()

        // Confirm the optimistic update
        setState({
          data: optimisticData,
          isOptimistic: false,
          error: null,
        })

        onSuccess?.(optimisticData)
      } catch (error) {
        // Rollback on error
        setState({
          data: rollbackData,
          isOptimistic: false,
          error: error as Error,
        })

        onError?.(error as Error)

        // Show error toast
        enhancedToast.error('Erro ao atualizar. As alterações foram revertidas.')
      }
    },
    []
  )

  const updateData = useCallback((newData: T) => {
    setState({
      data: newData,
      isOptimistic: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    performOptimisticUpdate,
    updateData,
  }
}

// ========================================
// OPTIMISTIC LIST OPERATIONS
// ========================================
export function useOptimisticList<T extends { id: string | number }>(initialList: T[]) {
  const [list, setList] = useState(initialList)
  const [optimisticIds, setOptimisticIds] = useState<Set<string | number>>(new Set())

  // Add item optimistically
  const addItem = useCallback(
    async (item: T, saveAction: () => Promise<void>) => {
      // Add item immediately
      setList((prev) => [item, ...prev])
      setOptimisticIds((prev) => new Set(prev).add(item.id))

      try {
        await saveAction()
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
        enhancedToast.success('Item adicionado com sucesso')
      } catch (error) {
        // Remove on error
        setList((prev) => prev.filter((i) => i.id !== item.id))
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
        enhancedToast.error('Erro ao adicionar item')
      }
    },
    []
  )

  // Update item optimistically
  const updateItem = useCallback(
    async (id: string | number, updates: Partial<T>, saveAction: () => Promise<void>) => {
      // Store original for rollback
      const original = list.find((item) => item.id === id)
      if (!original) return

      // Update immediately
      setList((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
      setOptimisticIds((prev) => new Set(prev).add(id))

      try {
        await saveAction()
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } catch (error) {
        // Rollback on error
        setList((prev) => prev.map((item) => (item.id === id ? original : item)))
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        enhancedToast.error('Erro ao atualizar item')
      }
    },
    [list]
  )

  // Delete item optimistically with undo
  const deleteItem = useCallback(
    async (id: string | number, deleteAction: () => Promise<void>) => {
      // Store original for rollback
      const original = list.find((item) => item.id === id)
      if (!original) return

      // Remove immediately
      setList((prev) => prev.filter((item) => item.id !== id))

      let undone = false

      // Show toast with undo option
      enhancedToast.undo('Item removido', () => {
        undone = true
        setList((prev) => [original, ...prev])
      })

      // Wait a bit for potential undo
      await new Promise((resolve) => setTimeout(resolve, 5000))

      if (!undone) {
        try {
          await deleteAction()
        } catch (error) {
          // Restore on error
          setList((prev) => [original, ...prev])
          enhancedToast.error('Erro ao remover item. Item restaurado.')
        }
      }
    },
    [list]
  )

  // Check if item is optimistic
  const isOptimistic = useCallback(
    (id: string | number) => {
      return optimisticIds.has(id)
    },
    [optimisticIds]
  )

  return {
    list,
    setList,
    addItem,
    updateItem,
    deleteItem,
    isOptimistic,
  }
}

// ========================================
// OPTIMISTIC TOGGLE (for boolean states)
// ========================================
export function useOptimisticToggle(initialValue: boolean, saveAction: (value: boolean) => Promise<void>) {
  const [value, setValue] = useState(initialValue)
  const [isOptimistic, setIsOptimistic] = useState(false)

  const toggle = useCallback(async () => {
    const newValue = !value
    const oldValue = value

    // Toggle immediately
    setValue(newValue)
    setIsOptimistic(true)

    try {
      await saveAction(newValue)
      setIsOptimistic(false)
    } catch (error) {
      // Revert on error
      setValue(oldValue)
      setIsOptimistic(false)
      enhancedToast.error('Erro ao atualizar')
    }
  }, [value, saveAction])

  return {
    value,
    toggle,
    isOptimistic,
  }
}

// ========================================
// OPTIMISTIC COUNTER
// ========================================
export function useOptimisticCounter(
  initialValue: number,
  saveAction: (value: number) => Promise<void>,
  options?: {
    min?: number
    max?: number
    step?: number
  }
) {
  const { min, max, step = 1 } = options || {}
  const [value, setValue] = useState(initialValue)
  const [isOptimistic, setIsOptimistic] = useState(false)

  const updateValue = useCallback(
    async (delta: number) => {
      const newValue = value + delta
      const oldValue = value

      // Check bounds
      if ((min !== undefined && newValue < min) || (max !== undefined && newValue > max)) {
        return
      }

      // Update immediately
      setValue(newValue)
      setIsOptimistic(true)

      try {
        await saveAction(newValue)
        setIsOptimistic(false)
      } catch (error) {
        // Revert on error
        setValue(oldValue)
        setIsOptimistic(false)
        enhancedToast.error('Erro ao atualizar')
      }
    },
    [value, saveAction, min, max]
  )

  const increment = useCallback(() => updateValue(step), [updateValue, step])
  const decrement = useCallback(() => updateValue(-step), [updateValue, step])

  return {
    value,
    increment,
    decrement,
    isOptimistic,
  }
}

// ========================================
// BATCH OPTIMISTIC UPDATES
// ========================================
export function useBatchOptimisticUpdate<T>() {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, T>>(new Map())

  const queueUpdate = useCallback((id: string, update: T) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev)
      next.set(id, update)
      return next
    })
  }, [])

  const commitUpdates = useCallback(
    async (saveAction: (updates: Map<string, T>) => Promise<void>) => {
      if (pendingUpdates.size === 0) return

      const updates = new Map(pendingUpdates)
      setPendingUpdates(new Map())

      try {
        await saveAction(updates)
        enhancedToast.success(`${updates.size} atualizações salvas com sucesso`)
      } catch (error) {
        // Restore pending updates on error
        setPendingUpdates(updates)
        enhancedToast.error('Erro ao salvar atualizações')
      }
    },
    [pendingUpdates]
  )

  const clearPending = useCallback(() => {
    setPendingUpdates(new Map())
  }, [])

  return {
    pendingUpdates,
    queueUpdate,
    commitUpdates,
    clearPending,
    hasPending: pendingUpdates.size > 0,
  }
}
