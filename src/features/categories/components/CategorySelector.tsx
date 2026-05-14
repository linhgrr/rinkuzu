import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { CategoryOptionItem } from '@/features/categories/components/CategoryOptionItem';
import { useDropdownOutside } from '@/components/ui/hooks/use-dropdown-outside';
import { useCategorySearch } from '@/features/categories/hooks/useCategorySearch';
import { fetchApiData } from '@/lib/api/client';

interface Category {
  _id: string;
  name: string;
  description?: string;
  color?: string;
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
  placeholder = 'Search and select category...',
  error,
  required = false,
  disabled = false,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { query, setQuery, debouncedQuery } = useCategorySearch({
    initialQuery: value?.name || '',
    delay: 300,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDropdownOutside(dropdownRef, showDropdown, () => setShowDropdown(false));

  useEffect(() => {
    setQuery(value?.name || '');
  }, [setQuery, value?.name]);

  // Debounced search function
  const searchCategories = async (query: string) => {
    if (!query.trim()) {
      setCategories([]);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchApiData<Category[]>(
        `/api/categories/search?q=${encodeURIComponent(query)}&limit=10`,
      );
      setCategories(data);
    } catch (error) {
      console.error('Search categories error:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = e.target.value;
    setQuery(nextQuery);
    setShowDropdown(true);

    // If input is cleared and we had a selected value, clear the selection
    if (!nextQuery && value) {
      onChange(null);
    }
  };

  // Handle category selection
  const handleCategorySelect = (category: Category) => {
    setQuery(category.name);
    setShowDropdown(false);
    onChange(category);
    setCategories([]);
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (query && !value) {
      setShowDropdown(true);
      searchCategories(query);
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
    setQuery('');
    onChange(null);
    setCategories([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!showDropdown) return;
    searchCategories(debouncedQuery);
  }, [debouncedQuery, showDropdown]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`pr-20 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${disabled ? 'bg-neutral-50 text-neutral-500' : ''}`}
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <div className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          </div>
        )}

        {/* Clear button */}
        {(query || value) && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            aria-label="Clear selection"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Selected category indicator */}
      {value && (
        <div className="mt-2 flex items-center gap-x-2 text-sm text-green-600">
          <div className="size-3 rounded-full" style={{ backgroundColor: value.color }}></div>
          <span>Selected: {value.name}</span>
          {value.description && <span className="text-neutral-500">- {value.description}</span>}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-neutral-500 text-center">Searching…</div>
          )}

          {!loading && categories.length === 0 && query && (
            <div className="px-4 py-3 text-sm text-neutral-500 text-center">
              No categories found for &quot;{query}&quot;
            </div>
          )}

          {!loading && categories.length === 0 && !query && (
            <div className="px-4 py-3 text-sm text-neutral-500 text-center">
              Start typing to search categories...
            </div>
          )}

          {!loading && categories.length > 0 && (
            <div className="py-1">
              {categories.map((category) => (
                <CategoryOptionItem
                  key={category._id}
                  title={category.name}
                  subtitle={category.description}
                  color={category.color}
                  onClick={() => handleCategorySelect(category)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Required indicator */}
      {required && (
        <p className="mt-1 text-xs text-neutral-500">* Category selection is required</p>
      )}
    </div>
  );
}
