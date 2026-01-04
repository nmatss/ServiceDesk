'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger'
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
        alert(error.error || 'Erro ao salvar categoria')
      }
    } catch (error) {
      logger.error('Erro ao salvar categoria', error)
      alert('Erro ao salvar categoria')
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
        alert(error.error || 'Erro ao deletar categoria')
      }
    } catch (error) {
      logger.error('Erro ao deletar categoria', error)
      alert('Erro ao deletar categoria')
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
      <div className="card">
        <div className="card-body">
          <h3 className="card-title mb-4">Categorias</h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="loading loading-spinner loading-lg"></div>
              <p className="text-base-content/60 mt-4">Carregando categorias...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <TagIcon className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
              <p className="text-base-content/60 text-lg">Nenhuma categoria encontrada</p>
              <p className="text-base-content/40 text-sm mt-2">Clique em "Nova Categoria" para criar a primeira</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="border border-base-300 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <h4 className="font-semibold text-base-content">{category.name}</h4>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(category)}
                        className="btn btn-ghost btn-xs"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="btn btn-ghost btn-xs text-error"
                        title="Deletar"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {category.description && (
                    <p className="text-sm text-base-content/60">{category.description}</p>
                  )}
                  <p className="text-xs text-base-content/40 mt-2">
                    ID: {category.id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Nome *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Suporte Técnico"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Descrição</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da categoria..."
                  rows={3}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Cor *</span>
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`btn btn-sm ${formData.color === color.value ? 'btn-primary' : 'btn-ghost'}`}
                      style={{
                        backgroundColor: color.value,
                        borderColor: formData.color === color.value ? '#fff' : color.value
                      }}
                      title={color.name}
                    >
                      <div className="w-4 h-4 rounded-full bg-white/20" />
                    </button>
                  ))}
                </div>
                <input
                  type="color"
                  className="input input-bordered w-full h-12"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
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
          <div className="modal-backdrop" onClick={handleCloseModal} />
        </div>
      )}
    </div>
  )
}
