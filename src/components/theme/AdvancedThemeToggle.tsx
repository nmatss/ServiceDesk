'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ChevronDownIcon,
  SwatchIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import { useTheme } from '@/src/contexts/ThemeContext'

interface ColorScheme {
  id: string
  name: string
  primary: string
  secondary: string
  preview: string[]
}

const colorSchemes: ColorScheme[] = [
  {
    id: 'blue',
    name: 'Azul Oceano',
    primary: '#0ea5e9',
    secondary: '#0284c7',
    preview: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8']
  },
  {
    id: 'emerald',
    name: 'Verde Esmeralda',
    primary: '#10b981',
    secondary: '#059669',
    preview: ['#d1fae5', '#6ee7b7', '#34d399', '#059669']
  },
  {
    id: 'purple',
    name: 'Roxo Real',
    primary: '#8b5cf6',
    secondary: '#7c3aed',
    preview: ['#ede9fe', '#c4b5fd', '#8b5cf6', '#7c3aed']
  },
  {
    id: 'orange',
    name: 'Laranja Vibrante',
    primary: '#f97316',
    secondary: '#ea580c',
    preview: ['#fed7aa', '#fdba74', '#f97316', '#ea580c']
  },
  {
    id: 'rose',
    name: 'Rosa Elegante',
    primary: '#f43f5e',
    secondary: '#e11d48',
    preview: ['#fce7f3', '#f9a8d4', '#f43f5e', '#e11d48']
  }
]

export default function AdvancedThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedColorScheme, setSelectedColorScheme] = useState('blue')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setShowColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Load saved color scheme
  useEffect(() => {
    const savedScheme = localStorage.getItem('color-scheme')
    if (savedScheme && colorSchemes.find(s => s.id === savedScheme)) {
      setSelectedColorScheme(savedScheme)
      applyColorScheme(savedScheme)
    }
  }, [])

  const applyColorScheme = (schemeId: string) => {
    const scheme = colorSchemes.find(s => s.id === schemeId)
    if (!scheme) return

    const root = document.documentElement

    // Update CSS custom properties for the color scheme
    root.style.setProperty('--brand-500', scheme.primary)
    root.style.setProperty('--brand-600', scheme.secondary)

    // Save to localStorage
    localStorage.setItem('color-scheme', schemeId)
    setSelectedColorScheme(schemeId)
  }

  const getThemeIcon = (themeName: 'light' | 'dark' | 'system') => {
    switch (themeName) {
      case 'light':
        return <SunIcon className="h-4 w-4" />
      case 'dark':
        return <MoonIcon className="h-4 w-4" />
      case 'system':
        return <ComputerDesktopIcon className="h-4 w-4" />
    }
  }

  const getThemeLabel = (themeName: 'light' | 'dark' | 'system') => {
    switch (themeName) {
      case 'light':
        return 'Claro'
      case 'dark':
        return 'Escuro'
      case 'system':
        return 'Sistema'
    }
  }

  // Smooth theme transition
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    // Add transition class before changing theme
    document.documentElement.classList.add('theme-transition')

    setTheme(newTheme)

    // Remove transition class after animation
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 300)

    setShowDropdown(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Theme Toggle Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn btn-ghost p-2 relative group"
        aria-label="Alternar tema"
      >
        <div className="flex items-center space-x-1">
          {getThemeIcon(theme)}
          <ChevronDownIcon className="h-3 w-3 transition-transform duration-200 group-hover:scale-110" />
        </div>

        {/* Active theme indicator */}
        <div
          className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full transition-all duration-200"
          style={{ backgroundColor: colorSchemes.find(s => s.id === selectedColorScheme)?.primary }}
        />
      </button>

      {/* Advanced Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
              Personalizar Tema
            </h3>
            <p className="text-sm text-description">
              Escolha seu tema e esquema de cores preferidos
            </p>
          </div>

          {/* Theme Selection */}
          <div className="p-4">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              Modo de Aparência
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map((themeName) => (
                <button
                  key={themeName}
                  onClick={() => handleThemeChange(themeName)}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 ${
                    theme === themeName
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className={`p-2 rounded-full mb-2 ${
                    theme === themeName
                      ? 'bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-400'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-description'
                  }`}>
                    {getThemeIcon(themeName)}
                  </div>
                  <span className={`text-xs font-medium ${
                    theme === themeName
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-description'
                  }`}>
                    {getThemeLabel(themeName)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Scheme Section */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Esquema de Cores
              </h4>
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="btn btn-ghost btn-sm"
              >
                <SwatchIcon className="h-4 w-4 mr-1" />
                Personalizar
              </button>
            </div>

            {/* Color Scheme Grid */}
            <div className="grid grid-cols-5 gap-2">
              {colorSchemes.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => applyColorScheme(scheme.id)}
                  className={`relative p-2 rounded-lg border-2 transition-all duration-200 group ${
                    selectedColorScheme === scheme.id
                      ? 'border-brand-500 scale-105'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                  title={scheme.name}
                >
                  {/* Color Preview */}
                  <div className="grid grid-cols-2 gap-1 h-8">
                    {scheme.preview.map((color, index) => (
                      <div
                        key={index}
                        className="rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {/* Selected Indicator */}
                  {selectedColorScheme === scheme.id && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                      <CheckIcon className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Custom Color Picker */}
            {showColorPicker && (
              <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <h5 className="text-xs font-medium text-description mb-2">
                  Cor Personalizada
                </h5>
                <div className="flex space-x-2">
                  <input
                    type="color"
                    defaultValue="#0ea5e9"
                    onChange={(e) => {
                      const color = e.target.value
                      document.documentElement.style.setProperty('--brand-500', color)
                      localStorage.setItem('custom-color', color)
                    }}
                    className="w-8 h-8 rounded border border-neutral-300 dark:border-neutral-600 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-muted-content">
                      Escolha uma cor personalizada para o tema
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
            <div className="flex items-center justify-between text-xs text-muted-content">
              <span>Tema atual: {getThemeLabel(theme)}</span>
              <span>Sistema: {resolvedTheme === 'dark' ? 'Escuro' : 'Claro'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}