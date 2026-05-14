'use client';

import { useEffect, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryOptionItem } from '@/features/categories/components/CategoryOptionItem';
import { useCategorySearch } from '@/features/categories/hooks/useCategorySearch';
import { useDropdownOutside } from '@/components/ui/hooks/use-dropdown-outside';
import { fetchApiData } from '@/lib/api/client';

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

interface CategorySearchState {
  isOpen: boolean;
  categories: Category[];
  loading: boolean;
  selectedIndex: number;
  recentCategories: Category[];
}

type CategorySearchAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'loading:start' }
  | { type: 'loading:finish'; categories?: Category[] }
  | { type: 'setRecentCategories'; recentCategories: Category[] }
  | { type: 'saveRecentCategory'; category: Category }
  | { type: 'setSelectedIndex'; selectedIndex: number }
  | { type: 'resetSelectedIndex' };

const RECENT_CATEGORIES_STORAGE_KEY = 'recentCategories:v1';

const initialState: CategorySearchState = {
  isOpen: false,
  categories: [],
  loading: false,
  selectedIndex: -1,
  recentCategories: [],
};

function categorySearchReducer(
  state: CategorySearchState,
  action: CategorySearchAction,
): CategorySearchState {
  switch (action.type) {
    case 'open':
      return { ...state, isOpen: true };
    case 'close':
      return { ...state, isOpen: false, selectedIndex: -1 };
    case 'loading:start':
      return { ...state, loading: true };
    case 'loading:finish':
      return {
        ...state,
        loading: false,
        categories: action.categories ?? state.categories,
      };
    case 'setRecentCategories':
      return { ...state, recentCategories: action.recentCategories };
    case 'saveRecentCategory':
      return {
        ...state,
        recentCategories: [
          ...state.recentCategories.filter((category) => category._id !== action.category._id),
          action.category,
        ].slice(0, 5),
      };
    case 'setSelectedIndex':
      return { ...state, selectedIndex: action.selectedIndex };
    case 'resetSelectedIndex':
      return { ...state, selectedIndex: -1 };
    default:
      return state;
  }
}

function CategorySearch({
  isCollapsed = false,
  onCategorySelect,
  showInHomepage = false,
}: CategorySearchProps) {
  const [state, dispatch] = useReducer(categorySearchReducer, initialState);

  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { push } = useRouter();
  const { query, setQuery, debouncedQuery, reset } = useCategorySearch();

  // Fetch all categories khi component mount
  useEffect(() => {
    fetchCategories();
    loadRecentCategories();
  }, []);

  useEffect(() => {
    dispatch({ type: 'resetSelectedIndex' });
  }, [debouncedQuery, state.categories, state.recentCategories]);

  const fetchCategories = async () => {
    try {
      dispatch({ type: 'loading:start' });
      const data = await fetchApiData<{ allCategories: Category[] }>('/api/categories/stats');
      dispatch({ type: 'loading:finish', categories: data.allCategories });
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      dispatch({ type: 'loading:finish' });
    }
  };

  const loadRecentCategories = () => {
    try {
      const recent = localStorage.getItem(RECENT_CATEGORIES_STORAGE_KEY);
      if (recent) {
        dispatch({ type: 'setRecentCategories', recentCategories: JSON.parse(recent) });
      }
    } catch (error) {
      console.error('Failed to load recent categories:', error);
    }
  };

  const saveRecentCategory = (category: Category) => {
    try {
      const nextRecentCategories = [
        ...state.recentCategories.filter((recentCategory) => recentCategory._id !== category._id),
        category,
      ].slice(0, 5);
      dispatch({ type: 'saveRecentCategory', category });
      localStorage.setItem(RECENT_CATEGORIES_STORAGE_KEY, JSON.stringify(nextRecentCategories));
    } catch (error) {
      console.error('Failed to save recent category:', error);
    }
  };

  const filteredCategories = debouncedQuery.trim()
    ? state.categories.filter(
        (category) =>
          category.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          category.description.toLowerCase().includes(debouncedQuery.toLowerCase()),
      )
    : state.recentCategories.length > 0
      ? state.recentCategories.slice(0, 5)
      : state.categories.slice(0, 8);

  const handleCategorySelect = (category: Category | null) => {
    if (category) {
      saveRecentCategory(category);
      if (showInHomepage && onCategorySelect) {
        onCategorySelect(category._id);
      } else {
        const slug = category.name.toLowerCase().replace(/\s+/g, '-');
        push(`/category/${slug}`);
      }
    } else {
      if (showInHomepage && onCategorySelect) {
        onCategorySelect(null);
      } else {
        push('/');
      }
    }
    dispatch({ type: 'close' });
    reset();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!state.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        dispatch({
          type: 'setSelectedIndex',
          selectedIndex:
            state.selectedIndex < filteredCategories.length - 1
              ? state.selectedIndex + 1
              : state.selectedIndex,
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        dispatch({
          type: 'setSelectedIndex',
          selectedIndex: state.selectedIndex > -1 ? state.selectedIndex - 1 : -1,
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (state.selectedIndex >= 0 && filteredCategories[state.selectedIndex]) {
          handleCategorySelect(filteredCategories[state.selectedIndex]);
        } else if (state.selectedIndex === -1) {
          handleCategorySelect(null); // All categories
        }
        break;
      case 'Escape':
        dispatch({ type: 'close' });
        reset();
        break;
    }
  };

  useDropdownOutside(dropdownRef, state.isOpen, () => dispatch({ type: 'close' }));

  if (isCollapsed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => dispatch({ type: 'open' })}
        className="w-full text-neutral-600 hover:bg-neutral-100"
        title="Search Categories"
      >
        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </Button>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Input
          ref={searchRef}
          type="text"
          placeholder="Search categories..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => dispatch({ type: 'open' })}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-4 text-sm"
        />
        <svg
          className="absolute left-3 top-2.5 size-4 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Dropdown */}
      {state.isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {state.loading ? (
            <div className="p-4 text-center">
              <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
              <p className="mt-2 text-sm text-neutral-500">Loading categories…</p>
            </div>
          ) : (
            <>
              {/* All Categories Option */}
              <button
                type="button"
                onClick={() => handleCategorySelect(null)}
                className={`w-full border-b border-neutral-100 px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--focus-ring)] ${
                  state.selectedIndex === -1
                    ? 'bg-neutral-100 text-brand-trust'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center">
                  <div className="size-8 bg-gradient-to-br from-brand-trust to-green-600 rounded-full flex items-center justify-center mr-3">
                    <svg
                      className="size-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">All Categories</div>
                    <div className="text-xs text-neutral-500">Browse all available subjects</div>
                  </div>
                </div>
              </button>

              {/* Recent Categories Section */}
              {!query && state.recentCategories.length > 0 && (
                <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100">
                  <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">
                    Recent
                  </p>
                </div>
              )}

              {/* Categories List */}
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category, index) => (
                  <CategoryOptionItem
                    key={category._id}
                    title={category.name}
                    subtitle={`${category.quizCount} quiz${category.quizCount !== 1 ? 'zes' : ''}${category.description ? ` • ${category.description}` : ''}`}
                    color={category.color}
                    selected={state.selectedIndex === index}
                    onClick={() => handleCategorySelect(category)}
                  />
                ))
              ) : query ? (
                <div className="p-4 text-center text-neutral-500">
                  <svg
                    className="size-8 mx-auto mb-2 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
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
