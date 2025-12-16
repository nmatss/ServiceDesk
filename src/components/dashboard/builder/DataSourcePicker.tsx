'use client';

import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { dataSourceRegistry } from '@/lib/analytics/data-sources';

export interface DataSourcePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dataSourceId: string) => void;
  currentDataSource?: string;
  filterCategory?: string;
}

export function DataSourcePicker({
  isOpen,
  onClose,
  onSelect,
  currentDataSource,
  filterCategory
}: DataSourcePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(filterCategory || 'all');

  const dataSources = Object.values(dataSourceRegistry);

  const categories = [
    { id: 'all', name: 'All Sources' },
    { id: 'tickets', name: 'Tickets' },
    { id: 'sla', name: 'SLA' },
    { id: 'agents', name: 'Agents' },
    { id: 'customers', name: 'Customers' },
    { id: 'custom', name: 'Custom' }
  ];

  const filteredDataSources = dataSources.filter(ds => {
    const matchesCategory = selectedCategory === 'all' || ds.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ds.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleSelect = (dataSourceId: string) => {
    onSelect(dataSourceId);
    onClose();
  };

  return (
    <Transition appear show={isOpen}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <DialogTitle className="text-lg font-medium text-gray-900 dark:text-white">
                    Select Data Source
                  </DialogTitle>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search data sources..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                  <nav className="-mb-px flex space-x-4">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          selectedCategory === category.id
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Data Sources List */}
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {filteredDataSources.map((ds) => (
                    <button
                      key={ds.id}
                      onClick={() => handleSelect(ds.id)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        currentDataSource === ds.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            {ds.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {ds.description}
                          </p>
                          <div className="flex items-center space-x-3 text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {ds.type}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              {ds.category}
                            </span>
                            {ds.requiredPermissions && ds.requiredPermissions.length > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                Requires permissions
                              </span>
                            )}
                          </div>
                        </div>
                        {currentDataSource === ds.id && (
                          <div className="flex-shrink-0 ml-3">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {ds.parameters && ds.parameters.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Parameters:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ds.parameters.map((param, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                              >
                                {param.name}
                                {param.required && <span className="text-red-500 ml-1">*</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {filteredDataSources.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                      No data sources found matching your criteria
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
