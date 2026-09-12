import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { ProductCard } from '../components/product/ProductCard.jsx';
import { ProductCardSkeleton } from '../components/ui/Skeleton.jsx';
import { Button } from '../components/ui/Button.jsx';

const SORT_LABELS = {
  newest: 'Newest',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  popular: 'Best Selling',
  rating: 'Top Rated',
};

export const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const sort = searchParams.get('sort') || 'newest';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const search = searchParams.get('search') || searchParams.get('q') || '';
  const page = Number(searchParams.get('page')) || 1;

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.data)).catch(() => {});
    api.get('/brands').then((res) => setBrands(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 12, sort };
    if (category) params.category = category;
    if (brand) params.brand = brand;
    if (search) params.search = search;

    api
      .get('/products', { params })
      .then((res) => {
        setProducts(res.data.data.products);
        setPagination(res.data.data.pagination);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [sort, category, brand, search, page]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateParam('search', searchInput.trim());
  };

  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">Shop</h1>
          {search && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-ink-500">Search results for:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                &ldquo;{search}&rdquo;
                <button
                  onClick={() => updateParam('search', '')}
                  className="hover:text-red-500 transition"
                  title="Clear search"
                >
                  ✕
                </button>
              </span>
            </div>
          )}
        </div>

        {/* In-page search input */}
        <form onSubmit={handleSearchSubmit} className="flex max-w-sm w-full gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search within shop..."
            className="flex-1 rounded-xl border border-ink-300 bg-white px-3.5 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition"
          >
            Filter
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                updateParam('search', '');
              }}
              className="rounded-xl border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-900 dark:text-white">Category</h3>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => updateParam('category', '')}
                className={`text-left text-sm ${!category ? 'font-semibold text-brand-600' : 'text-ink-500'}`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c._id}
                  onClick={() => updateParam('category', c._id)}
                  className={`text-left text-sm ${category === c._id ? 'font-semibold text-brand-600' : 'text-ink-500'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-900 dark:text-white">Brand</h3>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => updateParam('brand', '')}
                className={`text-left text-sm ${!brand ? 'font-semibold text-brand-600' : 'text-ink-500'}`}
              >
                All
              </button>
              {brands.map((b) => (
                <button
                  key={b._id}
                  onClick={() => updateParam('brand', b._id)}
                  className={`text-left text-sm ${brand === b._id ? 'font-semibold text-brand-600' : 'text-ink-500'}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div>
          <div className="mb-4 flex justify-end">
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-800"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="py-20 text-center text-sm text-ink-500">No products found.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>

              {pagination.pages > 1 && (
                <div className="mt-10 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => updateParam('page', String(page - 1))}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-2 text-sm text-ink-500">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.pages}
                    onClick={() => updateParam('page', String(page + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
