import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
}

interface CategorySelectorProps {
  value?: Category | null;
  onChange: (category: Category | null) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function CategorySelector({ 
  value, 
  onChange, 
  placeholder = "Search and select category...",
  error,
  required = false,
  disabled = false
}: CategorySelectorProps) {
  const [searchTerm, setSearchTerm] = useState(value?.name || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced search function
  const searchCategories = async (query: string) => {
    if (!query.trim()) {
      setCategories([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/categories/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      if (data.success) {
        setCategories(data.data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Search categories error:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    setShowDropdown(true);

    // If input is cleared and we had a selected value, clear the selection
    if (!query && value) {
      onChange(null);
    }

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer for debounced search
    const timer = setTimeout(() => {
      searchCategories(query);
    }, 300); // 300ms debounce

    setDebounceTimer(timer);
  };

  // Handle category selection
  const handleCategorySelect = (category: Category) => {
    setSearchTerm(category.name);
    setShowDropdown(false);
    onChange(category);
    setCategories([]);
    
    // Clear search results
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (searchTerm && !value) {
      setShowDropdown(true);
      searchCategories(searchTerm);
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    // Don't close dropdown immediately to allow for clicking on items
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setShowDropdown(false);
      }
    }, 150);
  };

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSearchTerm('');
    onChange(null);
    setCategories([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`pr-20 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${disabled ? 'bg-gray-50 text-gray-500' : ''}`}
        />
        
        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        )}
        
        {/* Clear button */}
        {(searchTerm || value) && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Selected category indicator */}
      {value && (
        <div className="mt-2 flex items-center space-x-2 text-sm text-green-600">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: value.color }}
          ></div>
          <span>Selected: {value.name}</span>
          {value.description && (
            <span className="text-gray-500">- {value.description}</span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Searching...
            </div>
          )}
          
          {!loading && categories.length === 0 && searchTerm && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No categories found for "{searchTerm}"
            </div>
          )}
          
          {!loading && categories.length === 0 && !searchTerm && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Start typing to search categories...
            </div>
          )}
          
          {!loading && categories.length > 0 && (
            <div className="py-1">
              {categories.map((category) => (
                <button
                  key={category._id}
                  type="button"
                  onClick={() => handleCategorySelect(category)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {category.name}
                      </div>
                      {category.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {category.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {/* Required indicator */}
      {required && (
        <p className="mt-1 text-xs text-gray-500">
          * Category selection is required
        </p>
      )}
    </div>
  );
} 