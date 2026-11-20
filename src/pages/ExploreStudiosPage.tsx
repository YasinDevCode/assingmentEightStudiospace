import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { Studio } from '../types';
import { STUDIO_CATEGORIES } from '../types';
import { apiRequest } from '../lib/api';
import { StudioCard } from '../components/StudioCard';
import { StudioCardSkeleton } from '../components/Skeletons';
import { useDebounce } from '../hooks/useDebounce';

const ALL_CATEGORIES = ['All', ...STUDIO_CATEGORIES];

export function ExploreStudiosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';

  const [category, setCategory] = useState(
    ALL_CATEGORIES.includes(initialCategory) ? initialCategory : 'All'
  );
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 250);
  const [sort, setSort] = useState(
    ['rating', 'newest', 'price_asc', 'price_desc'].includes(searchParams.get('sort') || '')
      ? searchParams.get('sort') || 'rating'
      : 'rating'
  );
  const [maxRate, setMaxRate] = useState(searchParams.get('maxRate') || '');
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Keep filters synced when the URL changes or when the page is restored by navigation.
  useEffect(() => {
    const paramCat = searchParams.get('category') || 'All';
    if (ALL_CATEGORIES.includes(paramCat) && paramCat !== category) {
      setCategory(paramCat);
    }
    const paramSearch = searchParams.get('q') || '';
    if (paramSearch !== search) setSearch(paramSearch);
    const paramMaxRate = searchParams.get('maxRate') || '';
    if (paramMaxRate !== maxRate) setMaxRate(paramMaxRate);
    const paramSort = searchParams.get('sort') || 'rating';
    if (['rating', 'newest', 'price_asc', 'price_desc'].includes(paramSort) && paramSort !== sort) {
      setSort(paramSort);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFetchError('');
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (maxRate) params.set('maxRate', maxRate);
    if (sort) params.set('sort', sort);

    apiRequest<{ studios: Studio[] }>(`/api/studios?${params.toString()}`)
      .then((res) => {
        if (active) setStudios(res.studios || []);
      })
      .catch((error: unknown) => {
        if (active) {
          setStudios([]);
          setFetchError(error instanceof Error ? error.message : 'Could not load studio workspaces.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, debouncedSearch, sort, maxRate]);

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSearchChange = (next: string) => {
    setSearch(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next.trim()) {
      nextParams.set('q', next);
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleMaxRateChange = (next: string) => {
    setMaxRate(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next) {
      nextParams.set('maxRate', next);
    } else {
      nextParams.delete('maxRate');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSortChange = (next: string) => {
    setSort(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'rating') {
      nextParams.delete('sort');
    } else {
      nextParams.set('sort', next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const resetFilters = () => {
    setCategory('All');
    setSearch('');
    setMaxRate('');
    setSort('rating');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Heading */}
      <div className="max-w-2xl mb-8">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
          Creative Workspace Directory
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 text-balance">
          Explore Production Studios
        </h1>
        <p className="mt-2.5 text-base text-zinc-600 dark:text-zinc-400">
          Filter verified photography lofts, acoustic stages, broadcast rooms, and art ateliers by
          discipline, location, and hourly rate.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by studio name, city, neighborhood, or equipment..."
              aria-label="Search studios"
              className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={maxRate}
              onChange={(e) => handleMaxRateChange(e.target.value)}
              aria-label="Maximum hourly rate"
              className="w-full h-11 px-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Any Hourly Rate</option>
              <option value="100">Up to $100 / hr</option>
              <option value="150">Up to $150 / hr</option>
              <option value="200">Up to $200 / hr</option>
              <option value="300">Up to $300 / hr</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              aria-label="Sort studios"
              className="w-full h-11 px-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="rating">Top Rated</option>
              <option value="newest">Newest Listed</option>
              <option value="price_asc">Rate: Low to High</option>
              <option value="price_desc">Rate: High to Low</option>
            </select>
          </div>
        </div>

        {/* Interactive Category Segmented Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Studio category filters">
            {ALL_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-mono tabular-nums">
              {loading ? 'Searching...' : `${studios.length} ${studios.length === 1 ? 'workspace' : 'workspaces'}`}
            </span>
            {(category !== 'All' || search || maxRate) && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Grid / Skeleton / Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <StudioCardSkeleton key={idx} />
          ))}
        </div>
      ) : fetchError ? (
        <div className="py-20 px-6 text-center rounded-xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/60">
          <h2 className="font-display text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Studios could not be loaded
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            {fetchError}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      ) : studios.length === 0 ? (
        <div className="py-20 px-6 text-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            No studio workspaces match those filters
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Try widening your maximum hourly rate, clearing search terms, or switching to another
            studio category.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studios.map((studio) => (
            <StudioCard key={studio.id} studio={studio} />
          ))}
        </div>
      )}
    </div>
  );
}
