'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
  quizCount: number;
}

interface CategorySearchProps {
  isCollapsed?: boolean;
  onCategorySelect?: (categoryId: string | null) => void;
  showInHomepage?: boolean;
}

export function CategorySearch({ isCollapsed = false, onCategorySelect, showInHomepage = false }: CategorySearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentCategories, setRecentCategories] = useState<Category[]>([]);
  
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Debounce search term để tránh search quá nhiều
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch all categories khi component mount
  useEffect(() => {
    fetchCategories();
    loadRecentCategories();
  }, []);

  // Filter categories khi search term thay đổi
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      const filtered = categories.filter(category =>
        category.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        category.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      // Hiển thị recent categories nếu không có search term
      setFilteredCategories(recentCategories.length > 0 ? recentCategories.slice(0, 5) : categories.slice(0, 8));
    }
    setSelectedIndex(-1);
  }, [debouncedSearchTerm, categories, recentCategories]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories/stats');
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.data.allCategories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentCategories = () => {
    try {
      const recent = localStorage.getItem('recentCategories');
      if (recent) {
        setRecentCategories(JSON.parse(recent));
      }
    } catch (error) {
      console.error('Failed to load recent categories:', error);
    }
  };

  const saveRecentCategory = (category: Category) => {
    try {
      const recent = [...recentCategories.filter(c => c._id !== category._id), category].slice(0, 5);
      setRecentCategories(recent);
      localStorage.setItem('recentCategories', JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to save recent category:', error);
    }
  };

  const handleCategorySelect = (category: Category | null) => {
    if (category) {
      saveRecentCategory(category);
      if (showInHomepage && onCategorySelect) {
        onCategorySelect(category._id);
      } else {
        const slug = category.name.toLowerCase().replace(/\s+/g, '-');
        router.push(`/category/${slug}`);
      }
    } else {
      if (showInHomepage && onCategorySelect) {
        onCategorySelect(null);
      } else {
        router.push('/');
      }
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCategories.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredCategories[selectedIndex]) {
          handleCategorySelect(filteredCategories[selectedIndex]);
        } else if (selectedIndex === -1) {
          handleCategorySelect(null); // All categories
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Search Categories"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading categories...</p>
            </div>
          ) : (
            <>
              {/* All Categories Option */}
              <button
                onClick={() => handleCategorySelect(null)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                  selectedIndex === -1 ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">All Categories</div>
                    <div className="text-xs text-gray-500">Browse all available subjects</div>
                  </div>
                </div>
              </button>

              {/* Recent Categories Section */}
              {!searchTerm && recentCategories.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Recent</p>
                </div>
              )}

              {/* Categories List */}
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category, index) => (
                  <button
                    key={category._id}
                    onClick={() => handleCategorySelect(category)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedIndex === index ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{category.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {category.quizCount} quiz{category.quizCount !== 1 ? 'zes' : ''}
                          {category.description && ` • ${category.description}`}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : searchTerm ? (
                <div className="p-4 text-center text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">No categories found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CategorySearch; 