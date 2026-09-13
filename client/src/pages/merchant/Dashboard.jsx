import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../services/api.js';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';

const PLAYGROUND_KEY_STORAGE = 'luxestyle-playground-key';

const readPlaygroundKeys = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(PLAYGROUND_KEY_STORAGE);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const readPlaygroundKey = (merchantId) => readPlaygroundKeys()?.[merchantId] || null;

const readInitialPlaygroundKey = () => {
  const keys = readPlaygroundKeys();
  return keys ? Object.values(keys)[0] : null;
};

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
  const [productPagination, setProductPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [productPage, setProductPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [intelligenceResults, setIntelligenceResults] = useState(null);

  // Admin merchant selector
  const [merchantsList, setMerchantsList] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');

  // API key modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('Autonomous AI Shopping Agent');
  const [generatedKey, setGeneratedKey] = useState(() => readInitialPlaygroundKey()?.key || null);
  const [generatedKeyMerchantId, setGeneratedKeyMerchantId] = useState(() => readInitialPlaygroundKey()?.merchantId || null);
  const [selectedPermissions, setSelectedPermissions] = useState(['catalog:read', 'cart:write', 'checkout:write', 'analytics:read']);
  const [generatedKeyPermissions, setGeneratedKeyPermissions] = useState(() => readInitialPlaygroundKey()?.permissions || []);

  // Add/Edit Product modal & stock adjustment
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockAdjustment, setStockAdjustment] = useState('');
  const [savingStock, setSavingStock] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    price: '',
    discountPrice: '',
    stock: '',
    category: '',
    brand: '',
    sizes: '',
    colors: '',
    imageUrl: '',
    description: '',
  });

  // Agent sandbox
  const [sandboxTool, setSandboxTool] = useState('catalog');
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Catalog search within tab
  const [catalogSearch, setCatalogSearch] = useState('');

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
      const prodParams = activeId
        ? { merchant: activeId, limit: 12, page: productPage, includeInactive: true }
        : { limit: 12, page: productPage, includeInactive: true };

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
      setBundles(bundlesRes.data.data || []);
      setApiKeys(keysRes.data.data || []);
      setProducts(prodRes.data.data.products || []);
      setProductPagination(prodRes.data.data.pagination || { page: productPage, pages: 1, total: 0 });
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
  }, [isAdmin, productPage, selectedMerchantId]);

  const handleSelectMerchant = (newId) => {
    setSelectedMerchantId(newId);
    const stored = readPlaygroundKey(newId);
    if (stored?.merchantId === newId) {
      setGeneratedKey(stored.key);
      setGeneratedKeyMerchantId(stored.merchantId);
      setGeneratedKeyPermissions(stored.permissions || []);
    } else {
      setGeneratedKey(null);
      setGeneratedKeyMerchantId(null);
      setGeneratedKeyPermissions([]);
    }
  };

  /* ── Handlers ──────────────────────────────────────────── */

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    const tid = toast.loading('Running AI basket analysis…');
    try {
      const params = selectedMerchantId ? { merchantId: selectedMerchantId } : {};
      const res = await api.post('/merchants/intelligence/analyze', {}, { params });
      setIntelligenceResults(res.data.data);
      const bundlesRes = await api.get('/merchants/bundles', { params });
      setBundles(bundlesRes.data.data || []);
      toast.dismiss(tid);
      toast.success(
        `Analyzed ${res.data.data.totalOrders} orders — ${res.data.data.suggestions?.length || 0} new bundle proposals generated.`
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
      toast.error(err.message || 'Failed to update bundle');
    }
  };

  const handleCreateApiKey = async () => {
    const activeMerchantId = selectedMerchantId || dashboardData?.merchant?._id;
    if (!activeMerchantId) {
      toast.error('Select a merchant before generating an agent key');
      return;
    }
    if (selectedPermissions.length === 0) {
      toast.error('Select at least one permission');
      return;
    }
    try {
      const params = { merchantId: activeMerchantId };
      const res = await api.post(
        '/merchants/keys',
        {
          name: newKeyName,
          permissions: selectedPermissions,
          merchantId: activeMerchantId,
        },
        { params }
      );
      setGeneratedKey(res.data.data.apiKey);
      setGeneratedKeyMerchantId(activeMerchantId);
      setGeneratedKeyPermissions(selectedPermissions);
      const storedKeys = readPlaygroundKeys() || {};
      storedKeys[activeMerchantId] = {
        key: res.data.data.apiKey,
        merchantId: activeMerchantId,
        permissions: selectedPermissions,
      };
      sessionStorage.setItem(PLAYGROUND_KEY_STORAGE, JSON.stringify(storedKeys));
      toast.success('Agent API Key generated successfully');
      api.get('/merchants/keys', { params }).then((r) => setApiKeys(r.data.data || []));
    } catch (err) {
      toast.error(err.message || 'Failed to generate key');
    }
  };

  const handleOpenNewKeyModal = () => {
    setGeneratedKey(null);
    setGeneratedKeyMerchantId(null);
    setGeneratedKeyPermissions([]);
    const activeMerchantId = selectedMerchantId || dashboardData?.merchant?._id;
    const storedKeys = readPlaygroundKeys() || {};
    if (activeMerchantId) delete storedKeys[activeMerchantId];
    sessionStorage.setItem(PLAYGROUND_KEY_STORAGE, JSON.stringify(storedKeys));
    setShowKeyModal(true);
  };

  const handleRevokeKey = async (id) => {
    try {
      const params = selectedMerchantId ? { merchantId: selectedMerchantId } : {};
      await api.delete(`/merchants/keys/${id}`, { params });
      toast.success('Agent Key revoked');
      setApiKeys((prev) => prev.filter((k) => k._id !== id));
    } catch (err) {
      toast.error(err.message || 'Failed to revoke key');
    }
  };

  const handleOrderStatus = async (orderId, status) => {
    try {
      const res = await api.put(`/orders/${orderId}/status`, { status });
      setOrders((current) => current.map((order) => (order._id === orderId ? res.data.data : order)));
      toast.success('Order status updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update order status');
    }
  };

  const handleOpenProductModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setNewProduct({
        name: product.name || '',
        sku: product.sku || '',
        price: product.price || '',
        discountPrice: product.discountPrice || '',
        stock: product.stock || '',
        category: product.category?._id || product.category || '',
        brand: product.brand?._id || product.brand || '',
        sizes: (product.sizes || []).join(', '),
        colors: (product.colors || []).join(', '),
        imageUrl: product.images?.[0]?.url || '',
        description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setNewProduct({
        name: '',
        sku: '',
        price: '',
        discountPrice: '',
        stock: '',
        category: categories[0]?._id || '',
        brand: brands[0]?._id || '',
        sizes: 'S, M, L, XL',
        colors: 'Black, White',
        imageUrl: '',
        description: '',
      });
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const payload = {
        name: newProduct.name,
        sku: newProduct.sku,
        price: Number(newProduct.price),
        discountPrice: newProduct.discountPrice ? Number(newProduct.discountPrice) : undefined,
        stock: Number(newProduct.stock),
        category: newProduct.category,
        brand: newProduct.brand,
        description: newProduct.description,
        sizes: newProduct.sizes.split(',').map((s) => s.trim()).filter(Boolean),
        colors: newProduct.colors.split(',').map((c) => c.trim()).filter(Boolean),
        images: newProduct.imageUrl
          ? [{ url: newProduct.imageUrl, publicId: `prod_${Date.now()}` }]
          : undefined,
      };

      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct._id}`, payload);
        setProducts((prev) => prev.map((p) => (p._id === editingProduct._id ? res.data.data : p)));
        toast.success('Product updated successfully');
      } else {
        const res = await api.post('/products', payload);
        setProducts((prev) => [res.data.data, ...prev]);
        toast.success('Product created successfully');
      }
      setShowProductModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleProductStatus = async (product) => {
    try {
      const res = await api.put(`/products/${product._id}`, { isActive: !product.isActive });
      setProducts((prev) => prev.map((p) => (p._id === product._id ? res.data.data : p)));
      toast.success(product.isActive ? 'Product archived' : 'Product published');
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    const adjustment = Number(stockAdjustment);
    if (!Number.isInteger(adjustment) || adjustment === 0) {
      toast.error('Enter a non-zero whole number');
      return;
    }
    setSavingStock(true);
    try {
      const res = await api.patch(`/products/${stockProduct._id}/stock`, { adjustment });
      setProducts((current) => current.map((item) => (item._id === stockProduct._id ? res.data.data : item)));
      setStockProduct(null);
      setStockAdjustment('');
      toast.success('Stock updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update stock');
    } finally {
      setSavingStock(false);
    }
  };

  const handleRunSandbox = async () => {
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      const activeMerchantId = selectedMerchantId || dashboardData?.merchant?._id;
      if (!generatedKey || generatedKeyMerchantId !== activeMerchantId) {
        throw new Error('Generate a key for the selected merchant before using the playground.');
      }
      const headers = { 'X-Agent-Key': generatedKey };
      const requiredPermission =
        sandboxTool === 'analytics'
          ? 'analytics:read'
          : sandboxTool === 'cart'
          ? 'cart:write'
          : ['catalog', 'offers'].includes(sandboxTool)
          ? 'catalog:read'
          : null;
      if (requiredPermission && !generatedKeyPermissions.includes(requiredPermission)) {
        throw new Error(`This key does not include ${requiredPermission}. Generate a new key with that permission.`);
      }
      let url = '/agent/v1/catalog';
      let method = 'GET';

      if (sandboxTool === 'catalog') url = `/agent/v1/catalog?query=${encodeURIComponent(sandboxQuery)}`;
      else if (sandboxTool === 'offers') url = '/agent/v1/offers';
      else if (sandboxTool === 'tools') url = '/agent/v1/tools';
      else if (sandboxTool === 'analytics') url = '/agent/v1/analytics';
      else if (sandboxTool === 'cart') {
        url = '/agent/v1/cart';
        method = 'POST';
      }

      const res = await api({ url, method, headers, data: method === 'POST' ? {} : undefined });
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-xs uppercase tracking-widest text-ink-400">Loading Merchant Command Center…</p>
      </div>
    );
  }

  const { merchant, metrics, recentOrders, lowStockProducts } = dashboardData || {};

  const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'intelligence', label: 'AI Intelligence', icon: '🧠', badge: bundles.filter((b) => b.status === 'suggested').length },
    { id: 'agent-hub', label: 'Agent Hub', icon: '⚡' },
    { id: 'products', label: 'Products', icon: '📦', count: products.length },
    { id: 'orders', label: 'Orders', icon: '🛒', count: orders.length },
  ];

  const suggestedBundles = bundles.filter((b) => b.status === 'suggested');
  const activeBundles = bundles.filter((b) => b.status === 'approved');
  const activeMerchantId = selectedMerchantId || merchant?._id;
  const hasSandboxKey = Boolean(generatedKey && generatedKeyMerchantId === activeMerchantId);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="container-page py-8">

      {/* ─── Hero Merchant Header ─────────────────────────── */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-brand-200/80 bg-gradient-to-br from-brand-50/70 via-white to-brand-100/30 p-6 shadow-sm dark:border-brand-900/40 dark:from-ink-950 dark:via-ink-900 dark:to-brand-950/20 md:p-8">
        {/* Glow ambient background element */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/10" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4 sm:items-center">
            {/* Store Monogram Avatar */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 text-xl font-bold text-brand-300 shadow-md ring-4 ring-brand-100 dark:from-white dark:to-ink-200 dark:text-ink-900 dark:ring-ink-800">
              {merchant?.logo ? (
                <img src={merchant.logo} alt={merchant.storeName} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                merchant?.storeName?.slice(0, 2).toUpperCase() || 'LX'
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  {merchant?.businessCategory || 'Luxury Merchant'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Live Catalog
                </span>
                {isAdmin && (
                  <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    Admin Superview
                  </span>
                )}
              </div>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
                {merchant?.storeName || 'Merchant Command Center'}
              </h1>

              {merchant?.description && (
                <p className="mt-1 max-w-2xl text-xs text-ink-500 dark:text-ink-400 line-clamp-1">
                  {merchant.description}
                </p>
              )}
            </div>
          </div>

          {/* Quick Action Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={handleRunAnalysis}
              loading={analyzing}
              size="sm"
              className="group shadow-sm"
            >
              <SparkleIcon className="mr-1.5 h-3.5 w-3.5 transition group-hover:rotate-12" />
              Analyze Basket
            </Button>

            <Button
              onClick={() => handleOpenProductModal()}
              variant="outline"
              size="sm"
            >
              + Add Product
            </Button>

            <Button
              as={Link}
              to="/merchant/settings"
              variant="outline"
              size="sm"
            >
              <GearIcon className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </Button>
          </div>
        </div>

        {/* Admin Store Switcher Toolbar */}
        {isAdmin && merchantsList.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-brand-200/60 pt-4 dark:border-brand-900/40">
            <div className="flex items-center gap-2">
              <StoreIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                Switch Store Context:
              </span>
            </div>

            <select
              value={selectedMerchantId || ''}
              onChange={(e) => handleSelectMerchant(e.target.value)}
              aria-label="Switch Merchant Store Context"
              className="w-full sm:w-auto rounded-xl border border-ink-300 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-ink-900 shadow-sm transition dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              {merchantsList.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.storeName} ({m.businessCategory || 'Boutique'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ─── Segmented Navigation Controls ───────────────── */}
      <div className="mb-8 flex overflow-x-auto rounded-2xl border border-ink-200 bg-ink-50/80 p-1.5 backdrop-blur-md dark:border-ink-800 dark:bg-ink-900/60">
        <div className="flex w-full min-w-max gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-white'
                    : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && (
                  <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 dark:bg-ink-700 dark:text-ink-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB 1: OVERVIEW
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">

          {/* 4 Executive KPI Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue */}
            <div className="group relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-ink-800 dark:bg-ink-950 dark:hover:border-brand-700">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Total Gross Sales</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <CurrencyIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
                ₹{metrics?.totalRevenue?.toLocaleString() || 0}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <TrendUpIcon className="h-3.5 w-3.5" />
                <span>Consolidated across all channels</span>
              </div>
            </div>

            {/* AI Agent Commerce */}
            <div className="group relative overflow-hidden rounded-2xl border border-brand-200/90 bg-gradient-to-br from-brand-50/40 to-white p-5 shadow-sm transition hover:border-brand-400 dark:border-brand-900/60 dark:from-ink-950 dark:to-brand-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-800 dark:text-brand-300">Agentic Commerce</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow">
                  <BotIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
                ₹{metrics?.agentRevenue?.toLocaleString() || 0}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-300 font-semibold">
                <span className="rounded-full bg-brand-200/60 px-2 py-0.5 text-[10px] dark:bg-brand-900/60">
                  {metrics?.agentOrderShare || 0}% of volume
                </span>
                <span>Autonomous AI</span>
              </div>
            </div>

            {/* Active AI Bundles */}
            <div className="group relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-ink-800 dark:bg-ink-950 dark:hover:border-brand-700">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Approved Bundles</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <BundleIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
                {metrics?.activeBundles || 0}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                <span>{suggestedBundles.length} pending review</span>
              </div>
            </div>

            {/* Total Products in Catalog */}
            <div className="group relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-ink-800 dark:bg-ink-950 dark:hover:border-brand-700">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Active Catalog</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
                  <BoxIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
                {metrics?.totalProducts || 0}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                <span>Real-time inventory synced</span>
              </div>
            </div>
          </div>

          {/* Revenue Velocity & Channel Mix */}
          <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-display text-lg font-bold text-ink-900 dark:text-white">
                  Revenue Velocity & Channel Distribution
                </h3>
                <p className="text-xs text-ink-500">Autonomous AI Assistant orders vs Direct Web checkout revenue</p>
              </div>
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                Total Orders: {(metrics?.totalOrders || 0) + (recentOrders?.length || 0)}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {/* Dual Channel Visual Bar */}
              <div className="h-4 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800 flex">
                <div
                  style={{ width: `${Math.min(100, metrics?.agentOrderShare || 0)}%` }}
                  className="bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
                  title="Agent Revenue"
                />
                <div
                  style={{ width: `${Math.max(0, 100 - (metrics?.agentOrderShare || 0))}%` }}
                  className="bg-ink-700 dark:bg-ink-400 transition-all duration-500"
                  title="Direct Web Revenue"
                />
              </div>

              {/* Channel Stats Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl bg-brand-50/60 p-4 dark:bg-brand-950/20">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-brand-500" />
                    <div>
                      <p className="text-xs font-semibold text-ink-900 dark:text-white">AI Agent Commerce</p>
                      <p className="text-[11px] text-ink-500">Conversational Concierge Orders</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900 dark:text-white">
                      ₹{metrics?.agentRevenue?.toLocaleString() || 0}
                    </p>
                    <p className="text-[11px] font-semibold text-brand-600">{metrics?.agentOrderShare || 0}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-ink-50 p-4 dark:bg-ink-900/50">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-ink-600 dark:bg-ink-400" />
                    <div>
                      <p className="text-xs font-semibold text-ink-900 dark:text-white">Direct Web Shoppers</p>
                      <p className="text-[11px] text-ink-500">Standard storefront checkouts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900 dark:text-white">
                      ₹{((metrics?.totalRevenue || 0) - (metrics?.agentRevenue || 0)).toLocaleString()}
                    </p>
                    <p className="text-[11px] font-semibold text-ink-500">
                      {Math.max(0, 100 - (metrics?.agentOrderShare || 0))}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Dual Grid: Recent Orders & Low Stock Alerts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Recent Orders List */}
            <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
              <div className="flex items-center justify-between pb-4 border-b border-ink-100 dark:border-ink-900">
                <div>
                  <h3 className="font-display text-base font-bold text-ink-900 dark:text-white">Recent Store Orders</h3>
                  <p className="text-xs text-ink-500">Latest transactions from this boutique</p>
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  View All Orders →
                </button>
              </div>

              {recentOrders?.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-400">
                  No orders recorded yet. As customers buy through the web or AI Concierge, they appear here.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-ink-100 dark:divide-ink-900">
                  {recentOrders?.slice(0, 5).map((o) => (
                    <div key={o._id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-700 dark:bg-ink-800 dark:text-ink-300">
                          #{o._id.slice(-4).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink-900 dark:text-white">
                            Order #{o._id.slice(-8).toUpperCase()}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-ink-500">
                            <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                            {o.isAgentOrder && (
                              <span className="rounded-full bg-brand-100 px-2 py-0.2 text-[9px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                                AI AGENT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs font-bold text-ink-900 dark:text-white">
                          ₹{o.totalAmount?.toLocaleString()}
                        </p>
                        <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">
                          {o.orderStatus || 'confirmed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inventory Alerts */}
            <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
              <div className="flex items-center justify-between pb-4 border-b border-ink-100 dark:border-ink-900">
                <div>
                  <h3 className="font-display text-base font-bold text-ink-900 dark:text-white">Restock Attention</h3>
                  <p className="text-xs text-ink-500">Items running critically low in catalog</p>
                </div>
                <button
                  onClick={() => setActiveTab('products')}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  Manage Stock →
                </button>
              </div>

              {lowStockProducts?.length === 0 ? (
                <div className="py-12 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ All inventory levels are healthy with ample stock.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-ink-100 dark:divide-ink-900">
                  {lowStockProducts?.slice(0, 5).map((p) => (
                    <div key={p._id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-semibold text-ink-900 dark:text-white">{p.name}</p>
                        <p className="text-[11px] text-ink-400">SKU: {p.sku || 'N/A'}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                          {p.stock} units left
                        </span>
                        <button
                          onClick={() => {
                            setStockProduct(p);
                            setStockAdjustment('');
                          }}
                          className="rounded-lg border border-ink-300 px-2.5 py-1 text-[11px] font-semibold text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2: AI INTELLIGENCE & MARKET BASKET ANALYSIS
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'intelligence' && (
        <div className="space-y-8 animate-fade-in">

          {/* AI Basket Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-brand-300 bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 p-8 text-white shadow-xl">
            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300">
                  <SparkleIcon className="h-3.5 w-3.5" />
                  Apriori Association Engine
                </div>
                <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
                  Market Basket Intelligence
                </h2>
                <p className="mt-2 max-w-xl text-xs text-ink-300 sm:text-sm">
                  Continuously inspects co-purchase frequency in multi-item orders to compute mathematical
                  Support, Confidence, and Lift coefficients. High-lift pairs are recommended as automated discount bundles.
                </p>
              </div>

              <Button
                onClick={handleRunAnalysis}
                loading={analyzing}
                className="bg-brand-500 text-white shadow-lg hover:bg-brand-400 shrink-0"
              >
                <SparkleIcon className="mr-2 h-4 w-4" />
                Trigger Basket Analysis
              </Button>
            </div>
          </div>

          {/* Pending Suggestions */}
          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-ink-900 dark:text-white">
                  AI-Recommended Cross-Sell Bundles
                </h3>
                <p className="text-xs text-ink-500">
                  Review and approve bundles before they become discoverable by the AI Shopping Assistant
                </p>
              </div>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                {suggestedBundles.length} Pending
              </span>
            </div>

            {suggestedBundles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-ink-300 p-12 text-center dark:border-ink-800">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                  <SparkleIcon className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-ink-900 dark:text-white">No Pending Proposals</h4>
                <p className="mt-1 text-xs text-ink-500">
                  Click 'Trigger Basket Analysis' above to analyze your orders and discover fresh co-purchase bundles.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {suggestedBundles.map((bundle) => (
                  <div
                    key={bundle._id}
                    className="flex flex-col justify-between rounded-3xl border border-brand-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-brand-900/50 dark:bg-ink-950"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                          ⚡ Lift: {bundle.metrics?.lift || '2.1'}×
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Save {bundle.discountPercentage}%
                        </span>
                      </div>

                      <h4 className="mt-4 font-display text-lg font-bold text-ink-900 dark:text-white">
                        {bundle.title}
                      </h4>
                      <p className="mt-1 text-xs text-ink-500">{bundle.description}</p>

                      {/* Items in bundle with connector */}
                      <div className="mt-4 space-y-2 rounded-2xl bg-ink-50 p-4 dark:bg-ink-900/50">
                        {bundle.products?.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-ink-800 dark:text-ink-200 truncate">
                              • {item.product?.name || 'Catalog Item'}
                            </span>
                            <span className="text-ink-500">
                              ₹{(item.product?.discountPrice || item.product?.price || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}

                        <div className="mt-2 flex items-center justify-between border-t border-ink-200/60 pt-2 text-xs font-bold dark:border-ink-800">
                          <span className="text-ink-500 line-through">
                            Original: ₹{bundle.originalPrice?.toLocaleString()}
                          </span>
                          <span className="text-brand-600 dark:text-brand-400 text-sm">
                            Bundle Deal: ₹{bundle.bundlePrice?.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {bundle.aiRationale && (
                        <p className="mt-3 rounded-xl bg-brand-50/50 p-2.5 text-[11px] italic text-brand-800 dark:bg-brand-950/20 dark:text-brand-300">
                          "{bundle.aiRationale}"
                        </p>
                      )}
                    </div>

                    <div className="mt-6 flex gap-3 border-t border-ink-100 pt-4 dark:border-ink-900">
                      <Button
                        onClick={() => handleBundleStatus(bundle._id, 'approved')}
                        size="sm"
                        className="flex-1 bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900"
                      >
                        ✓ Approve Bundle
                      </Button>
                      <Button
                        onClick={() => handleBundleStatus(bundle._id, 'rejected')}
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Approved Bundles */}
          {activeBundles.length > 0 && (
            <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
              <h3 className="font-display text-lg font-bold text-ink-900 dark:text-white">
                Live Active Bundles ({activeBundles.length})
              </h3>
              <p className="text-xs text-ink-500">These bundle combinations are currently active in checkout and agent search</p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-ink-200 text-ink-400 dark:border-ink-800 uppercase tracking-wider">
                      <th className="py-3">Bundle Title</th>
                      <th className="py-3">Items Included</th>
                      <th className="py-3">Bundle Price</th>
                      <th className="py-3">Discount</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-900">
                    {activeBundles.map((b) => (
                      <tr key={b._id}>
                        <td className="py-3 font-semibold text-ink-900 dark:text-white">{b.title}</td>
                        <td className="py-3 text-ink-500 max-w-xs truncate">
                          {b.products?.map((p) => p.product?.name).join(' + ')}
                        </td>
                        <td className="py-3 font-bold text-ink-900 dark:text-white">
                          ₹{b.bundlePrice?.toLocaleString()}{' '}
                          <span className="text-[10px] font-normal line-through text-ink-400">
                            ₹{b.originalPrice?.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {b.discountPercentage}% OFF
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleBundleStatus(b._id, 'archived')}
                            className="font-semibold text-rose-500 hover:text-rose-700"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3: AGENT HUB & DEVELOPER PLAYGROUND
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'agent-hub' && (
        <div className="space-y-8 animate-fade-in">

          {/* Agent API Keys Console */}
          <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center pb-4 border-b border-ink-100 dark:border-ink-900">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldIcon className="h-4 w-4 text-brand-600" />
                  <h3 className="font-display text-lg font-bold text-ink-900 dark:text-white">
                    Agent API Credentials
                  </h3>
                </div>
                <p className="text-xs text-ink-500">
                  Allow external autonomous agents to authenticate via <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-brand-600 dark:bg-ink-800">X-Agent-Key</code>
                </p>
              </div>

              <Button onClick={handleOpenNewKeyModal} size="sm">
                + Generate Key
              </Button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-400">
                No active Agent API keys for this store. Generate a key to connect external AI agents.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-ink-100 dark:divide-ink-900">
                {apiKeys.map((key) => (
                  <div key={key._id} className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-ink-900 dark:text-white">{key.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.2 text-[10px] font-bold capitalize ${
                            key.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                        {key.keyPrefix}••••••••••••••••
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {key.permissions?.map((p) => (
                          <span key={p} className="rounded bg-ink-100 px-1.5 py-0.2 text-[10px] font-mono text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {key.isActive && (
                      <Button
                        onClick={() => handleRevokeKey(key._id)}
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-700"
                      >
                        Revoke Key
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Agent Sandbox Terminal */}
          <div className="rounded-3xl border border-ink-800 bg-ink-950 p-6 text-white shadow-2xl">
            <div className="flex flex-col justify-between gap-4 border-b border-ink-800/80 pb-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500" />
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white">Agent Commerce Playground</h3>
                  <p className="font-mono text-[11px] text-ink-400">
                    Live tool execution testing with merchant authentication
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!hasSandboxKey && (
                  <Button onClick={handleOpenNewKeyModal} variant="outline" size="sm" className="text-white border-ink-700">
                    + Generate Test Key
                  </Button>
                )}
                <Button
                  onClick={handleRunSandbox}
                  loading={sandboxLoading}
                  disabled={!hasSandboxKey}
                  size="sm"
                  className="bg-emerald-500 font-mono text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  ▶ Run Tool
                </Button>
              </div>
            </div>

            {/* Sandbox input controls */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block font-mono text-[11px] text-ink-400">Function Calling Tool</label>
                <select
                  value={sandboxTool}
                  onChange={(e) => setSandboxTool(e.target.value)}
                  className="w-full rounded-xl border border-ink-800 bg-ink-900 px-3 py-2 font-mono text-xs text-white outline-none focus:border-brand-500"
                >
                  <option value="catalog">search_catalog</option>
                  <option value="offers">get_approved_bundles</option>
                  <option value="analytics">get_analytics</option>
                  <option value="tools">get_tools</option>
                  <option value="cart">create_cart</option>
                </select>
              </div>

              {sandboxTool === 'catalog' && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-mono text-[11px] text-ink-400">Natural Language Query</label>
                  <input
                    type="text"
                    value={sandboxQuery}
                    onChange={(e) => setSandboxQuery(e.target.value)}
                    placeholder="e.g. Oxford Shirt, silk dresses under 5000..."
                    className="w-full rounded-xl border border-ink-800 bg-ink-900 px-3 py-2 font-mono text-xs text-white outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </div>

            {/* Output Inspector */}
            {sandboxResult && (
              <div className="mt-4">
                <div className="flex items-center justify-between py-1 text-[11px] font-mono text-ink-400">
                  <span>OUTPUT INSPECTOR:</span>
                  <span className="text-emerald-400">STATUS: 200 OK</span>
                </div>
                <pre className="max-h-72 overflow-auto rounded-xl bg-black/60 p-4 font-mono text-xs text-emerald-400 border border-ink-800/80">
                  {JSON.stringify(sandboxResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Machine-Readable Specs */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
              <h4 className="font-display text-base font-bold text-ink-900 dark:text-white">OpenAPI 3.0 Specification</h4>
              <p className="mt-1 text-xs text-ink-500">
                Machine-readable schema describing all available endpoints for agent frameworks and tools.
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-ink-200 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-900">
                <code className="font-mono text-xs text-brand-600 dark:text-brand-400">GET /api/agent/v1/openapi.json</code>
                <a
                  href="/api/agent/v1/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  View JSON ↗
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
              <h4 className="font-display text-base font-bold text-ink-900 dark:text-white">LLM Tool Calling Definitions</h4>
              <p className="mt-1 text-xs text-ink-500">
                Native JSON function schemas compatible with Gemini, OpenAI GPT, and Anthropic Claude agents.
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-ink-200 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-900">
                <code className="font-mono text-xs text-brand-600 dark:text-brand-400">GET /api/agent/v1/tools</code>
                <a
                  href="/api/agent/v1/tools"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  View Tools ↗
                </a>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 4: PRODUCTS INVENTORY
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-display text-xl font-bold text-ink-900 dark:text-white">
                Boutique Inventory ({products.length})
              </h3>
              <p className="text-xs text-ink-500">
                Manage your store's luxury items, adjust stock counts, and control visibility.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search products or SKU…"
                className="rounded-xl border border-ink-300 bg-white px-3.5 py-1.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
              <Button onClick={() => handleOpenProductModal()} size="sm">
                + Add Piece
              </Button>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink-300 p-12 text-center dark:border-ink-800">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">No products in this boutique yet.</p>
              <p className="mt-1 text-xs text-ink-500">Add your first luxury piece to start receiving orders.</p>
              <Button onClick={() => handleOpenProductModal()} size="sm" className="mt-4">
                + Add First Product
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-ink-100 rounded-3xl border border-ink-200/80 bg-white shadow-sm dark:divide-ink-900 dark:border-ink-800 dark:bg-ink-950">
              {filteredProducts.map((p) => (
                <div key={p._id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-900 flex items-center justify-center border border-ink-200 dark:border-ink-800">
                      {p.images?.[0]?.url ? (
                        <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display text-xs font-bold text-brand-600">LX</span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-ink-900 dark:text-white">{p.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                          }`}
                        >
                          {p.isActive ? 'Published' : 'Archived'}
                        </span>
                      </div>
                      <p className="text-xs text-ink-500">
                        SKU: <span className="font-mono">{p.sku}</span> ·{' '}
                        {p.stock <= 5 ? (
                          <span className="font-bold text-rose-500">{p.stock} units (Low)</span>
                        ) : (
                          <span className="text-emerald-600">{p.stock} in stock</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink-900 dark:text-white">
                        ₹{(p.discountPrice || p.price).toLocaleString()}
                      </p>
                      {p.discountPrice && (
                        <p className="text-[10px] text-ink-400 line-through">₹{p.price.toLocaleString()}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setStockProduct(p);
                          setStockAdjustment('');
                        }}
                        className="rounded-lg border border-ink-300 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                      >
                        Adjust Stock
                      </button>

                      <button
                        onClick={() => handleOpenProductModal(p)}
                        className="rounded-lg border border-ink-300 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:border-ink-700 dark:text-brand-400 dark:hover:bg-brand-950/30"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleProductStatus(p)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                          p.isActive
                            ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        {p.isActive ? 'Archive' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {productPagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-ink-200 pt-4 text-xs dark:border-ink-800">
              <span className="text-ink-500">{productPagination.total} total items</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={productPage <= 1}
                  onClick={() => setProductPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-ink-500 font-medium">Page {productPage} of {productPagination.pages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={productPage >= productPagination.pages}
                  onClick={() => setProductPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 5: ORDERS MANAGEMENT
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="font-display text-xl font-bold text-ink-900 dark:text-white">
              Orders & Fulfillment ({orders.length})
            </h3>
            <p className="text-xs text-ink-500">
              Track and update live order statuses from initial checkout to doorstep delivery
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink-300 p-12 text-center text-xs text-ink-400 dark:border-ink-800">
              No orders have been placed with this merchant yet.
            </div>
          ) : (
            <div className="divide-y divide-ink-100 rounded-3xl border border-ink-200/80 bg-white shadow-sm dark:divide-ink-900 dark:border-ink-800 dark:bg-ink-950">
              {orders.map((o) => (
                <div key={o._id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/orders/${o._id}`}
                        className="font-display text-sm font-bold text-ink-900 hover:text-brand-600 dark:text-white"
                      >
                        Order #{o._id.slice(-8).toUpperCase()}
                      </Link>
                      {o.isAgentOrder ? (
                        <span className="rounded-full bg-brand-100 px-2.5 py-0.2 text-[10px] font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-300">
                          AI AGENT
                        </span>
                      ) : (
                        <span className="rounded-full bg-ink-100 px-2 py-0.2 text-[10px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                          WEB
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {new Date(o.createdAt).toLocaleDateString()} · {o.items?.length || 1} line item(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <p className="text-sm font-bold text-ink-900 dark:text-white">
                      ₹{o.totalAmount?.toLocaleString()}
                    </p>

                    <select
                      value={o.orderStatus}
                      onChange={(e) => handleOrderStatus(o._id, e.target.value)}
                      disabled={o.orderStatus === 'delivered' || o.orderStatus === 'cancelled'}
                      aria-label="Order Status"
                      className="rounded-xl border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold capitalize dark:border-ink-700 dark:bg-ink-900 dark:text-white cursor-pointer"
                    >
                      {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: API Key Creation ───────────────────────── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-ink-200 bg-white p-6 shadow-2xl dark:border-ink-800 dark:bg-ink-950">
            <h3 className="font-display text-xl font-bold text-ink-900 dark:text-white">Generate Agent Key</h3>
            <p className="mt-1 text-xs text-ink-500">
              Create a merchant scoped key for external shopping agents to access catalog and checkout.
            </p>

            {generatedKey ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✓ Key generated! Please copy it now as it will not be displayed again.
                </div>
                <div className="select-all rounded-xl border border-ink-300 bg-ink-50 p-3 font-mono text-xs text-brand-600 dark:border-ink-700 dark:bg-ink-900 dark:text-brand-400">
                  {generatedKey}
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    toast.success('Key copied to clipboard');
                    setShowKeyModal(false);
                  }}
                  className="w-full"
                >
                  Copy & Done
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Agent Name / Identifier</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 text-xs dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-ink-700 dark:text-ink-300">Scoped Permissions</legend>
                  <div className="space-y-2">
                    {[
                      ['catalog:read', 'Read catalog & active bundle deals'],
                      ['cart:write', 'Create and modify agent carts'],
                      ['checkout:write', 'Initiate checkout session & payment links'],
                      ['analytics:read', 'Access merchant agent conversion analytics'],
                    ].map(([permission, label]) => (
                      <label key={permission} className="flex items-center gap-2.5 text-xs text-ink-600 dark:text-ink-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission)}
                          onChange={(e) =>
                            setSelectedPermissions((prev) =>
                              e.target.checked
                                ? [...new Set([...prev, permission])]
                                : prev.filter((p) => p !== permission)
                            )
                          }
                          className="rounded border-ink-300 text-brand-600"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowKeyModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreateApiKey}>
                    Generate Key
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Stock Adjustment ───────────────────────── */}
      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <form onSubmit={handleStockAdjustment} className="w-full max-w-sm rounded-3xl border border-ink-200 bg-white p-6 shadow-2xl dark:border-ink-800 dark:bg-ink-950">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Inventory Control</span>
            <h3 className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-white">Adjust Real-Time Stock</h3>
            <p className="mt-1 text-xs text-ink-500">
              {stockProduct.name} has <span className="font-bold text-ink-900 dark:text-white">{stockProduct.stock}</span> units in catalog.
            </p>

            <label className="mt-4 block text-xs font-medium text-ink-700 dark:text-ink-300">
              Quantity Adjustment (positive or negative)
              <input
                autoFocus
                type="number"
                step="1"
                required
                value={stockAdjustment}
                onChange={(e) => setStockAdjustment(e.target.value)}
                placeholder="e.g. +20 or -5"
                className="mt-1.5 w-full rounded-xl border border-ink-300 px-3 py-2.5 text-base font-bold dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStockProduct(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={savingStock}>
                Confirm Stock
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Add / Edit Product ─────────────────────── */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-ink-200 bg-white p-6 shadow-2xl dark:border-ink-800 dark:bg-ink-950">
            <h3 className="font-display text-xl font-bold text-ink-900 dark:text-white">
              {editingProduct ? 'Edit Catalog Piece' : 'Add New Boutique Piece'}
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Configure product details, pricing, sizes, and stock for the catalog.
            </p>

            <form onSubmit={handleSaveProduct} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Product Name</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Classic Oxford Shirt"
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value.toUpperCase() })}
                    placeholder="OXF-SHIRT-001"
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 uppercase font-mono dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Regular Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="2499"
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Discount Price (₹, optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.discountPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, discountPrice: e.target.value })}
                    placeholder="1999"
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Initial Stock</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    placeholder="50"
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Brand</label>
                  <select
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white cursor-pointer"
                  >
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Image URL</label>
                  <input
                    type="url"
                    value={newProduct.imageUrl}
                    onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Available Sizes (comma separated)</label>
                  <input
                    type="text"
                    value={newProduct.sizes}
                    onChange={(e) => setNewProduct({ ...newProduct, sizes: e.target.value })}
                    placeholder="S, M, L, XL"
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Available Colors (comma separated)</label>
                  <input
                    type="text"
                    value={newProduct.colors}
                    onChange={(e) => setNewProduct({ ...newProduct, colors: e.target.value })}
                    placeholder="Black, White, Navy"
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-ink-700 dark:text-ink-300">Description</label>
                <textarea
                  rows={3}
                  required
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Tailored from 100% fine cotton..."
                  className="w-full rounded-xl border border-ink-300 px-3 py-2 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowProductModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={savingProduct}>
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

/* ── Custom SVG Icons for Executive Design ─────────────── */

function SparkleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
    </svg>
  );
}

function GearIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function StoreIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v4H3V3zm0 4l3 13h12l3-13H3zm7 5a2 2 0 104 0" />
    </svg>
  );
}

function CurrencyIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m0-2c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TrendUpIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function BotIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="11" width="18" height="10" rx="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5" r="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v4m-4 5h.01m8 0h.01" />
    </svg>
  );
}

function BundleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function BoxIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function ShieldIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
