import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../services/api.js';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';

/* ═══════════════════════════════════════════════════════════
   MerchantDashboard
   ─────────────────
   Layout: container-page within MainLayout (Navbar + Footer).
   Design tokens: identical to AdminDashboard, Checkout, Cart.
   Admin mode: allows selecting specific merchants to view/manage.
   ═══════════════════════════════════════════════════════════ */

export const MerchantDashboard = () => {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [bundles, setBundles] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [intelligenceResults, setIntelligenceResults] = useState(null);

  // Admin merchant selector
  const [merchantsList, setMerchantsList] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');

  // API key modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('External AI Assistant');
  const [generatedKey, setGeneratedKey] = useState(null);

  // Add Product modal & metadata
  const [showProductModal, setShowProductModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    price: '',
    discountPrice: '',
    stock: '10',
    category: '',
    brand: '',
    sizes: 'S, M, L',
    colors: 'Black, White',
    imageUrl: '',
    description: '',
  });

  // Agent sandbox
  const [sandboxTool, setSandboxTool] = useState('catalog');
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  /* ── Data fetching ─────────────────────────────────────── */

  const fetchAllData = async (targetMerchantId) => {
    setLoading(true);
    try {
      let activeId = targetMerchantId !== undefined ? targetMerchantId : selectedMerchantId;

      if (isAdmin) {
        const listRes = await api.get('/merchants/all');
        const list = listRes.data.data || [];
        setMerchantsList(list);
        if (!activeId && list.length > 0) {
          activeId = list[0]._id;
          setSelectedMerchantId(activeId);
        }
      }

      const params = activeId ? { merchantId: activeId } : {};
      const prodParams = activeId ? { merchant: activeId, limit: 50 } : { limit: 50 };

      const [dashRes, bundlesRes, keysRes, prodRes, ordersRes] = await Promise.all([
        api.get('/merchants/dashboard', { params }),
        api.get('/merchants/bundles', { params }),
        api.get('/merchants/keys', { params }),
        api.get('/products', { params: prodParams }),
        api.get('/merchants/orders', { params }),
      ]);

      setDashboardData(dashRes.data.data);
      if (!activeId && dashRes.data.data?.merchant?._id) {
        setSelectedMerchantId(dashRes.data.data.merchant._id);
      }
      setBundles(bundlesRes.data.data);
      setApiKeys(keysRes.data.data);
      setProducts(prodRes.data.data.products || []);
      setOrders(ordersRes.data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load merchant data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    api.get('/categories').then((r) => setCategories(r.data.data || [])).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data.data || [])).catch(() => {});
  }, [isAdmin]);

  const handleSelectMerchant = (newId) => {
    setSelectedMerchantId(newId);
    fetchAllData(newId);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.sku || !newProduct.price) {
      toast.error('Product Name, SKU, and Price are required');
      return;
    }
    setSavingProduct(true);
    try {
      const activeMerchant = selectedMerchantId || dashboardData?.merchant?._id;
      const payload = {
        name: newProduct.name,
        sku: newProduct.sku,
        price: Number(newProduct.price),
        discountPrice: newProduct.discountPrice ? Number(newProduct.discountPrice) : undefined,
        stock: Number(newProduct.stock) || 0,
        category: newProduct.category || categories[0]?._id,
        brand: newProduct.brand || brands[0]?._id,
        sizes: newProduct.sizes ? newProduct.sizes.split(',').map((s) => s.trim()).filter(Boolean) : ['Standard'],
        colors: newProduct.colors ? newProduct.colors.split(',').map((c) => c.trim()).filter(Boolean) : ['Classic'],
        description: newProduct.description || `${newProduct.name} luxury collection.`,
        merchant: activeMerchant,
        images: newProduct.imageUrl ? [{ url: newProduct.imageUrl, publicId: newProduct.imageUrl }] : undefined,
      };

      await api.post('/products', payload);
      toast.success(`"${newProduct.name}" added to your boutique catalog!`);
      setShowProductModal(false);
      setNewProduct({
        name: '',
        sku: '',
        price: '',
        discountPrice: '',
        stock: '10',
        category: '',
        brand: '',
        sizes: 'S, M, L',
        colors: 'Black, White',
        imageUrl: '',
        description: '',
      });

      // Refresh products tab
      const prodParams = activeMerchant ? { merchant: activeMerchant, limit: 50 } : { limit: 50 };
      const prodRes = await api.get('/products', { params: prodParams });
      setProducts(prodRes.data.data.products || []);
    } catch (err) {
      toast.error(err.message || 'Failed to create product');
    } finally {
      setSavingProduct(false);
    }
  };

  /* ── Handlers ──────────────────────────────────────────── */

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    const tid = toast.loading('Running basket analysis…');
    try {
      const params = selectedMerchantId ? { merchantId: selectedMerchantId } : {};
      const res = await api.post('/merchants/intelligence/analyze', {}, { params });
      setIntelligenceResults(res.data.data);
      const bundlesRes = await api.get('/merchants/bundles', { params });
      setBundles(bundlesRes.data.data);
      toast.dismiss(tid);
      toast.success(
        `Analyzed ${res.data.data.totalOrders} orders — ${res.data.data.suggestions?.length || 0} new bundles suggested.`
      );
    } catch (err) {
      toast.dismiss(tid);
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBundleStatus = async (id, status) => {
    try {
      const params = selectedMerchantId ? { merchantId: selectedMerchantId } : {};
      await api.put(`/merchants/bundles/${id}`, { status });
      toast.success(`Bundle ${status}`);
      setBundles((prev) => prev.map((b) => (b._id === id ? { ...b, status } : b)));
      api.get('/merchants/dashboard', { params }).then((r) => setDashboardData(r.data.data));
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const params = selectedMerchantId ? { merchantId: selectedMerchantId } : {};
      const res = await api.post(
        '/merchants/keys',
        {
          name: newKeyName,
          permissions: ['catalog:read', 'cart:write', 'checkout:write', 'analytics:read'],
          merchantId: selectedMerchantId,
        },
        { params }
      );
      setGeneratedKey(res.data.data.apiKey);
      toast.success('API Key created');
      api.get('/merchants/keys', { params }).then((r) => setApiKeys(r.data.data));
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const handleRevokeKey = async (id) => {
    try {
      const params = selectedMerchantId ? { merchantId: selectedMerchantId } : {};
      await api.delete(`/merchants/keys/${id}`, { params });
      toast.success('Key revoked');
      setApiKeys((prev) => prev.filter((k) => k._id !== id));
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const handleRunSandbox = async () => {
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      const headers = { 'X-Agent-Key': 'lx_test_agent_key_2026' };
      let url = '/agent/v1/catalog';
      let method = 'GET';

      if (sandboxTool === 'catalog') url = `/agent/v1/catalog?query=${encodeURIComponent(sandboxQuery)}`;
      else if (sandboxTool === 'offers') url = '/agent/v1/offers';
      else if (sandboxTool === 'tools') url = '/agent/v1/tools';
      else if (sandboxTool === 'cart') { url = '/agent/v1/cart'; method = 'POST'; }

      const res = await api({ url, method, headers });
      setSandboxResult(res.data);
    } catch (err) {
      setSandboxResult({ error: err.message });
    } finally {
      setSandboxLoading(false);
    }
  };

  /* ── Loading state ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const { merchant, metrics, recentOrders, lowStockProducts } = dashboardData || {};

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'intelligence', label: 'AI Intelligence' },
    { id: 'agent-hub', label: 'Agent Hub' },
    { id: 'products', label: `Products` },
    { id: 'orders', label: `Orders` },
  ];

  const suggestedBundles = bundles.filter((b) => b.status === 'suggested');
  const activeBundles = bundles.filter((b) => b.status === 'approved');

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="container-page py-10">

      {/* Header — same pattern as Orders page heading + ProductDetails breadcrumb */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-ink-500">Merchant Portal</p>
            {isAdmin && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300 uppercase tracking-wider">
                Admin Mode
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 dark:text-white">
            {merchant?.storeName || 'Your Store'}
          </h1>
          {merchant?.description && (
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400 line-clamp-1 max-w-xl">
              {merchant.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleRunAnalysis} loading={analyzing} size="sm">
            Analyze Transactions
          </Button>
          <Button as={Link} to="/merchant/onboard" variant="outline" size="sm">
            Settings
          </Button>
        </div>
      </div>

      {/* Admin Specific Merchant Switcher */}
      {isAdmin && merchantsList.length > 0 && (
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-brand-300 bg-brand-50/70 p-4 shadow-sm dark:border-brand-800/80 dark:bg-ink-950">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-800 dark:text-brand-300">
                Switch Merchant Store
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                Inspect store analytics, basket intelligence, bundles, and agent keys for any boutique
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedMerchantId || ''}
              onChange={(e) => handleSelectMerchant(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-ink-300 bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm transition dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              {merchantsList.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.storeName} ({m.businessCategory || 'Boutique'})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tabs — same border-b + text-sm pattern as Products page sort / AdminLayout nav */}
      <div className="flex gap-6 border-b border-ink-200 dark:border-ink-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'border-ink-900 text-ink-900 dark:border-white dark:text-white'
                : 'border-transparent text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1 : Overview ────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="mt-8 animate-fade-in space-y-8">

          {/* Stats — exact AdminDashboard StatCard pattern */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Revenue', value: `₹${metrics?.totalRevenue?.toLocaleString() || 0}` },
              { label: 'Agent Revenue', value: `₹${metrics?.agentRevenue?.toLocaleString() || 0}` },
              { label: 'Active Bundles', value: metrics?.activeBundles || 0 },
              { label: 'Products', value: metrics?.totalProducts || 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold text-ink-900 dark:text-white">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Revenue breakdown */}
          <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950">
            <h2 className="font-semibold text-ink-900 dark:text-white">Revenue Breakdown</h2>
            <div className="mt-5 space-y-4">
              {[
                { label: 'Agent Commerce', value: metrics?.agentRevenue, pct: metrics?.agentOrderShare, color: 'bg-brand-500' },
                { label: 'Direct Web', value: (metrics?.totalRevenue || 0) - (metrics?.agentRevenue || 0), pct: 100 - (metrics?.agentOrderShare || 0), color: 'bg-ink-400' },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink-600 dark:text-ink-300">{r.label}: ₹{r.value?.toLocaleString()}</span>
                    <span className="text-ink-400">{r.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div className={`h-full rounded-full ${r.color} transition-all duration-500`} style={{ width: `${Math.min(100, r.pct || 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent orders + Low stock — mirrors AdminDashboard dual-card grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-ink-900 dark:text-white">Recent Orders</h2>
                <button onClick={() => setActiveTab('orders')} className="text-xs text-ink-400 hover:text-ink-700 dark:hover:text-ink-200">
                  View all
                </button>
              </div>
              {recentOrders?.length === 0 ? (
                <p className="text-sm text-ink-500">No orders yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recentOrders?.map((o) => (
                    <li key={o._id} className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-ink-900 dark:text-white">#{o._id.slice(-6).toUpperCase()}</span>
                        {o.isAgentOrder && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                            AI
                          </span>
                        )}
                      </span>
                      <span className="font-medium">₹{o.totalAmount?.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950">
              <h2 className="mb-3 font-semibold text-ink-900 dark:text-white">Low Stock</h2>
              {lowStockProducts?.length === 0 ? (
                <p className="text-sm text-ink-500">All products well stocked.</p>
              ) : (
                <ul className="space-y-2">
                  {lowStockProducts?.map((p) => (
                    <li key={p._id} className="flex justify-between text-sm">
                      <span>{p.name}</span>
                      <span className="text-red-500">{p.stock} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2 : AI Intelligence ─────────────────────── */}
      {activeTab === 'intelligence' && (
        <div className="mt-8 animate-fade-in space-y-8">

          {/* Scan banner — uses the Home promo section rounded-3xl pattern */}
          <div className="rounded-3xl bg-brand-50 p-8 dark:bg-brand-900/20">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-semibold text-ink-900 dark:text-white">Market Basket Analysis</h2>
                <p className="mt-1 max-w-xl text-sm text-ink-500 dark:text-ink-400">
                  Analyzes historical orders to find co-purchase patterns, then generates bundle suggestions using Support, Confidence, and Lift metrics.
                </p>
              </div>
              <Button onClick={handleRunAnalysis} loading={analyzing}>
                Run Analysis
              </Button>
            </div>
          </div>

          {/* Suggested bundles */}
          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold text-ink-900 dark:text-white">Suggested Bundles</h2>
              <span className="text-xs text-ink-400">{suggestedBundles.length} pending</span>
            </div>

            {suggestedBundles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-300 p-8 text-center text-sm text-ink-500 dark:border-ink-700">
                No pending suggestions. Run an analysis to discover new cross-sell combos.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {suggestedBundles.map((bundle) => (
                  <div
                    key={bundle._id}
                    className="flex flex-col justify-between rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          Lift: {bundle.metrics?.lift || '2.0'}×
                        </span>
                        <span className="text-sm font-semibold text-ink-900 dark:text-white">
                          Save {bundle.discountPercentage}%
                        </span>
                      </div>

                      <h3 className="mt-3 font-semibold text-ink-900 dark:text-white">{bundle.title}</h3>
                      <p className="mt-1 text-sm text-ink-500">{bundle.description}</p>

                      {/* Items — mirrors Checkout order summary item list */}
                      <ul className="mt-4 divide-y divide-ink-100 rounded-xl bg-ink-50 p-3 dark:divide-ink-800 dark:bg-ink-900">
                        {bundle.products?.map((item, idx) => (
                          <li key={idx} className="flex justify-between py-1.5 text-xs">
                            <span className="truncate text-ink-700 dark:text-ink-300">
                              {item.product?.name || 'Product'}
                            </span>
                            <span className="text-ink-500">₹{item.product?.discountPrice || item.product?.price}</span>
                          </li>
                        ))}
                        <li className="flex justify-between border-t border-ink-200 pt-2 text-xs font-semibold dark:border-ink-800">
                          <span className="text-ink-500">Combined ₹{bundle.originalPrice}</span>
                          <span className="text-brand-600 dark:text-brand-400">₹{bundle.bundlePrice}</span>
                        </li>
                      </ul>

                      {bundle.aiRationale && (
                        <p className="mt-3 text-xs italic text-ink-400">{bundle.aiRationale}</p>
                      )}
                    </div>

                    <div className="mt-4 flex gap-3 border-t border-ink-200 pt-4 dark:border-ink-800">
                      <Button onClick={() => handleBundleStatus(bundle._id, 'approved')} size="sm" className="flex-1">
                        Approve
                      </Button>
                      <Button onClick={() => handleBundleStatus(bundle._id, 'rejected')} variant="outline" size="sm">
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active bundles table — mirrors AdminOrders table */}
          {activeBundles.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-ink-900 dark:text-white">
                Active Bundles ({activeBundles.length})
              </h2>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-ink-400 dark:border-ink-800">
                    <th className="py-2">Bundle</th>
                    <th className="py-2">Products</th>
                    <th className="py-2">Price</th>
                    <th className="py-2">Savings</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBundles.map((b) => (
                    <tr key={b._id} className="border-b border-ink-100 dark:border-ink-900">
                      <td className="py-2 font-medium text-ink-900 dark:text-white">{b.title}</td>
                      <td className="py-2 text-xs text-ink-500">
                        {b.products?.map((p) => p.product?.name).join(', ')}
                      </td>
                      <td className="py-2">
                        <span className="font-semibold">₹{b.bundlePrice}</span>{' '}
                        <span className="text-xs text-ink-400 line-through">₹{b.originalPrice}</span>
                      </td>
                      <td className="py-2">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          {b.discountPercentage}% off
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleBundleStatus(b._id, 'archived')}
                          className="text-sm text-ink-400 hover:text-red-500"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3 : Agent Hub ───────────────────────────── */}
      {activeTab === 'agent-hub' && (
        <div className="mt-8 animate-fade-in space-y-8">

          {/* API Keys */}
          <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-ink-900 dark:text-white">API Keys</h2>
                <p className="text-sm text-ink-500">
                  Authenticate agents via <code className="font-mono text-brand-600 dark:text-brand-400">X-Agent-Key</code> header.
                </p>
              </div>
              <Button onClick={() => setShowKeyModal(true)} size="sm">
                + New Key
              </Button>
            </div>

            {apiKeys.length === 0 ? (
              <p className="text-sm text-ink-500">No keys yet.</p>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-800">
                {apiKeys.map((key) => (
                  <li key={key._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-white">{key.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-ink-500">{key.keyPrefix}••••••••</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                          key.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        }`}
                      >
                        {key.isActive ? 'active' : 'revoked'}
                      </span>
                      {key.isActive && (
                        <button onClick={() => handleRevokeKey(key._id)} className="text-sm text-ink-400 hover:text-red-500">
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Specs — same 2-col grid pattern as AdminDashboard */}
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { title: 'OpenAPI 3.0', desc: 'Machine-readable API spec for Swagger & agents', path: '/api/agent/v1/openapi.json', cta: 'View JSON ↗' },
              { title: 'Tool Definitions', desc: 'Function calling schemas for Gemini, GPT, Claude', path: '/api/agent/v1/tools', cta: 'View Tools ↗' },
            ].map((spec) => (
              <div key={spec.title} className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950">
                <h3 className="font-semibold text-ink-900 dark:text-white">{spec.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{spec.desc}</p>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-ink-300 bg-ink-50 px-3 py-2 dark:border-ink-700 dark:bg-ink-800">
                  <code className="font-mono text-xs text-brand-600 dark:text-brand-400">GET {spec.path}</code>
                  <a href={spec.path} target="_blank" rel="noreferrer" className="text-xs font-medium text-ink-400 hover:text-ink-700 dark:hover:text-ink-200">
                    {spec.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Sandbox */}
          <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-ink-900 dark:text-white">API Playground</h2>
              <Button onClick={handleRunSandbox} loading={sandboxLoading} size="sm">
                ▶ Execute
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Tool</label>
                <select
                  value={sandboxTool}
                  onChange={(e) => setSandboxTool(e.target.value)}
                  className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800"
                >
                  <option value="catalog">search_catalog</option>
                  <option value="offers">get_bundles</option>
                  <option value="tools">get_tools</option>
                  <option value="cart">create_cart</option>
                </select>
              </div>
              {sandboxTool === 'catalog' && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Query</label>
                  <input
                    type="text"
                    value={sandboxQuery}
                    onChange={(e) => setSandboxQuery(e.target.value)}
                    placeholder="Oxford, Silk Dress…"
                    className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                  />
                </div>
              )}
            </div>

            {sandboxResult && (
              <pre className="mt-4 max-h-60 overflow-auto rounded-lg bg-ink-900 p-4 font-mono text-xs text-green-400">
                {JSON.stringify(sandboxResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4 : Products ────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="mt-8 animate-fade-in space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink-900 dark:text-white">
                Boutique Catalog ({products.length})
              </h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                Products actively offered by this store and available for AI concierge and agent commerce.
              </p>
            </div>
            <Button onClick={() => setShowProductModal(true)} size="sm">
              + Add Product
            </Button>
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-300 p-10 text-center text-sm text-ink-500 dark:border-ink-700">
              <p className="font-medium text-ink-700 dark:text-ink-300">No products in this boutique yet.</p>
              <p className="mt-1 text-xs text-ink-400">Add your first luxury piece to unlock AI bundles and agent shopping.</p>
              <Button onClick={() => setShowProductModal(true)} size="sm" className="mt-4">
                + Add Product Now
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {products.map((p) => (
                <li
                  key={p._id}
                  className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4 transition hover:border-ink-400 dark:border-ink-800 dark:bg-ink-950 dark:hover:border-ink-600"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
                      {p.images?.[0]?.url ? (
                        <img
                          src={p.images[0].url}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-brand-600">LX</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-ink-900 dark:text-white">{p.name}</p>
                      <p className="text-sm text-ink-500">
                        {p.sku} · {p.stock <= 5 ? <span className="text-red-500 font-semibold">{p.stock} left</span> : `${p.stock} in stock`}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">
                    ₹{(p.discountPrice || p.price).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ─── TAB 5 : Orders ──────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="mt-8 animate-fade-in space-y-4">
          <h2 className="text-xl font-semibold text-ink-900 dark:text-white">
            All Orders ({orders.length})
          </h2>
          <ul className="space-y-4">
            {orders.map((o) => (
              <li
                key={o._id}
                className="flex items-center justify-between rounded-2xl border border-ink-200 p-4 dark:border-ink-800"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-white">
                    Order #{o._id.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-xs text-ink-500">
                    {new Date(o.createdAt).toLocaleDateString()} · {o.items?.length || 1} item(s)
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold">₹{o.totalAmount?.toLocaleString()}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      o.isAgentOrder
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                        : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300'
                    }`}
                  >
                    {o.isAgentOrder ? 'agent' : 'web'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── API Key Modal ───────────────────────────────── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 shadow-2xl dark:border-ink-800 dark:bg-ink-950">
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white">New Agent API Key</h3>
            <p className="mt-1 text-sm text-ink-500">
              External AI agents authenticate with this key.
            </p>

            {generatedKey ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
                  Key created. Copy it now — it won't be shown again.
                </div>
                <div className="select-all rounded-lg border border-ink-300 bg-ink-50 p-3 font-mono text-sm text-brand-600 dark:border-ink-700 dark:bg-ink-800 dark:text-brand-400">
                  {generatedKey}
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    toast.success('Copied');
                    setShowKeyModal(false);
                    setGeneratedKey(null);
                  }}
                  className="w-full"
                >
                  Copy & Close
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-900 dark:text-white">Agent Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setShowKeyModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreateApiKey}>
                    Generate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Add Product Modal ────────────────────────────── */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 shadow-2xl dark:border-ink-800 dark:bg-ink-950 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-ink-200 pb-3 dark:border-ink-800">
              <div>
                <h3 className="text-lg font-semibold text-ink-900 dark:text-white">Add New Luxury Product</h3>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  Publish to {dashboardData?.merchant?.storeName || 'Boutique'} catalog
                </p>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-ink-400 hover:text-ink-600 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Italian Cashmere Double-Breasted Coat"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="LX-CT-01"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Stock Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="9999"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Discount Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="8499"
                    value={newProduct.discountPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, discountPrice: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Category
                  </label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Default Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Brand
                  </label>
                  <select
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Default Brand</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Sizes (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newProduct.sizes}
                    onChange={(e) => setNewProduct({ ...newProduct, sizes: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Colors (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newProduct.colors}
                    onChange={(e) => setNewProduct({ ...newProduct, colors: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                  Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newProduct.imageUrl}
                  onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-700 dark:text-ink-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe material, silhouette, and craftsmanship..."
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ink-200 dark:border-ink-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowProductModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" loading={savingProduct}>
                  Publish Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
