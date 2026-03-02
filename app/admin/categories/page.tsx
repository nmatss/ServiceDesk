'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger'
import { customToast } from '@/components/ui/toast'
import { TagIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'

interface Category {
  id: number
  name: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
}

export default function AdminCategoriesPage() {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      logger.error('Erro ao buscar categorias', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories'

      const method = editingCategory ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchCategories()
        handleCloseModal()
      } else {
        const error = await response.json()
        customToast.error(error.error || 'Erro ao salvar categoria')
      }
    } catch (error) {
      logger.error('Erro ao salvar categoria', error)
      customToast.error('Erro ao salvar categoria')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar esta categoria?')) return

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchCategories()
      } else {
        const error = await response.json()
        customToast.error(error.error || 'Erro ao deletar categoria')
      }
    } catch (error) {
      logger.error('Erro ao deletar categoria', error)
      customToast.error('Erro ao deletar categoria')
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6'
    })
  }

  const predefinedColors = [
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Verde', value: '#10B981' },
    { name: 'Vermelho', value: '#EF4444' },
    { name: 'Amarelo', value: '#F59E0B' },
    { name: 'Roxo', value: '#8B5CF6' },
    { name: 'Cinza', value: '#6B7280' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Indigo', value: '#6366F1' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gerenciar Categorias"
        description="Configure as categorias de tickets do sistema"
        icon={TagIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Categorias' }
        ]}
        actions={[
          {
            label: 'Nova Categoria',
            icon: PlusIcon,
            variant: 'primary',
            onClick: () => setShowModal(true)
          }
        ]}
      />

      {/* Stats */}
      <StatsGrid cols={3}>
        <StatsCard
          title="Total de Categorias"
          value={categories.length}
          icon="tag"
          color="brand"
          loading={loading}
        />
        <StatsCard
          title="Categorias Ativas"
          value={categories.length}
          icon="check-circle"
          color="success"
          loading={loading}
        />
        <StatsCard
          title="Mais Usada"
          value={categories[0]?.name || '-'}
          icon="star"
          color="warning"
          loading={loading}
        />
      </StatsGrid>

      {/* Categories Grid */}
      <div className="glass-panel p-4 sm:p-6 animate-slide-up">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Categorias</h3>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 dark:border-brand-400 mx-auto"></div>
            <p className="text-muted-content mt-4">Carregando categorias...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <TagIcon className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">Nenhuma categoria encontrada</p>
            <p className="text-muted-content text-sm mt-2">Clique em &quot;Nova Categoria&quot; para criar a primeira</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-neutral-800/50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{category.name}</h4>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={`Editar categoria ${category.name}`}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-2 rounded-lg text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={`Excluir categoria ${category.name}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {category.description && (
                  <p className="text-sm text-description line-clamp-2">{category.description}</p>
                )}
                <p className="text-xs text-muted-content mt-2">
                  ID: {category.id}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={editingCategory ? 'Editar categoria' : 'Nova categoria'}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} aria-hidden="true" />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-[min(28rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto p-6">
            <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-neutral-100">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Suporte Técnico"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Descrição
                </label>
                <textarea
                  className="input w-full min-h-[80px] py-2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da categoria..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Cor *
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`min-h-[44px] rounded-lg border-2 transition-all ${formData.color === color.value ? 'border-white ring-2 ring-brand-500 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                      aria-label={`Selecionar cor ${color.name}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white/20 mx-auto" />
                    </button>
                  ))}
                </div>
                <input
                  type="color"
                  className="input w-full h-12"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  aria-label="Selecionar cor personalizada"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
