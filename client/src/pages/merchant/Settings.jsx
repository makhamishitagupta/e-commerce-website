import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../services/api.js';
import { Button } from '../../components/ui/Button.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

const INITIAL_SETTINGS = {
  storeName: '',
  description: '',
  contactEmail: '',
  contactPhone: '',
  businessCategory: '',
  logo: '',
  allowAgentCheckout: true,
  maxDiscountPercent: 25,
  autoApproveBundles: false,
  currency: 'INR',
};

export const MerchantSettings = () => {
  const [form, setForm] = useState(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/merchants/me')
      .then(({ data }) => {
        const merchant = data.data;
        setForm({
          storeName: merchant.storeName || '',
          description: merchant.description || '',
          contactEmail: merchant.contactEmail || '',
          contactPhone: merchant.contactPhone || '',
          businessCategory: merchant.businessCategory || '',
          logo: merchant.logo || '',
          allowAgentCheckout: merchant.settings?.allowAgentCheckout ?? true,
          maxDiscountPercent: merchant.settings?.maxDiscountPercent ?? 25,
          autoApproveBundles: merchant.settings?.autoApproveBundles ?? false,
          currency: merchant.settings?.currency || 'INR',
        });
      })
      .catch((error) => {
        setLoadError(error.message || 'Unable to load store settings');
        toast.error(error.message || 'Unable to load store settings');
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put('/merchants/me', {
        storeName: form.storeName,
        description: form.description,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        businessCategory: form.businessCategory,
        logo: form.logo,
        settings: {
          allowAgentCheckout: form.allowAgentCheckout,
          maxDiscountPercent: Number(form.maxDiscountPercent),
          autoApproveBundles: form.autoApproveBundles,
          currency: form.currency,
        },
      });
      toast.success('Store settings saved successfully');
    } catch (error) {
      toast.error(error.message || 'Unable to save store settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-xs uppercase tracking-widest text-ink-400">Loading Store Configuration…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container-page flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-semibold text-ink-900 dark:text-white">Store settings unavailable</h1>
        <p className="text-sm text-ink-500">{loadError}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      {/* Breadcrumb & Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-400">
          <Link to="/merchant" className="hover:text-brand-600 transition">
            ← Back to Merchant Command Center
          </Link>
          <span>/</span>
          <span className="text-ink-700 dark:text-ink-200">Settings</span>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
              Store Configuration
            </h1>
            <p className="mt-1 text-xs text-ink-500 sm:text-sm">
              Manage your boutique profile, branding, and autonomous agent commerce rules.
            </p>
          </div>

          <Button form="settings-form" type="submit" loading={saving} size="sm">
            Save Changes
          </Button>
        </div>
      </div>

      <form id="settings-form" onSubmit={save} className="max-w-4xl space-y-8 animate-fade-in">
        {/* Section 1: Store Profile */}
        <section className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950 sm:p-8">
          <div className="flex items-center gap-3 pb-4 border-b border-ink-100 dark:border-ink-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <StoreIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Boutique Identity</h2>
              <p className="text-xs text-ink-500">Public store details displayed on listings and checkout</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-300">
                Store Name <span className="text-brand-600">*</span>
              </label>
              <input
                type="text"
                required
                value={form.storeName}
                onChange={(e) => update('storeName', e.target.value)}
                placeholder="e.g. Aria Studio Luxury"
                className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-300">Business Category</label>
              <input
                type="text"
                value={form.businessCategory}
                onChange={(e) => update('businessCategory', e.target.value)}
                placeholder="e.g. Haute Couture & Apparel"
                className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-300">Business Contact Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
                placeholder="concierge@store.com"
                className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-300">Support Phone</label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => update('contactPhone', e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-300">Store Logo URL</label>
              <input
                type="url"
                value={form.logo}
                onChange={(e) => update('logo', e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-300">Boutique Story & Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Crafting timeless luxury garments and curated artisanal pieces..."
                className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Agent Commerce & Autonomous Rules */}
        <section className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950 sm:p-8">
          <div className="flex items-center gap-3 pb-4 border-b border-ink-100 dark:border-ink-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              <BotIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
                Autonomous Commerce Rules
              </h2>
              <p className="text-xs text-ink-500">
                Configure automated AI agent checkout permissions and bundle thresholds
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6 text-xs">
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-ink-50 p-4 dark:bg-ink-900/50">
              <div>
                <p className="font-bold text-ink-900 dark:text-white">Enable Autonomous Agent Checkout</p>
                <p className="mt-0.5 text-ink-500">
                  Allows authenticated AI agents to initiate checkout sessions with Razorpay TEST authorization.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.allowAgentCheckout}
                onChange={(e) => update('allowAgentCheckout', e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-2xl bg-ink-50 p-4 dark:bg-ink-900/50">
              <div>
                <p className="font-bold text-ink-900 dark:text-white">Auto-Approve Discovered AI Bundles</p>
                <p className="mt-0.5 text-ink-500">
                  Automatically approve high-confidence basket combinations generated by the intelligence engine.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.autoApproveBundles}
                onChange={(e) => update('autoApproveBundles', e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block font-bold text-ink-700 dark:text-ink-300">
                  Max AI Bundle Discount Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.maxDiscountPercent}
                  onChange={(e) => update('maxDiscountPercent', e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-ink-700 dark:text-ink-300">Settlement Currency</label>
                <input
                  type="text"
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value.toUpperCase())}
                  className="mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 font-mono text-xs font-bold uppercase text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-2">
          <Button as={Link} to="/merchant" variant="ghost" size="sm">
            Cancel
          </Button>
          <Button type="submit" loading={saving} size="sm">
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
};

function StoreIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v4H3V3zm0 4l3 13h12l3-13H3zm7 5a2 2 0 104 0" />
    </svg>
  );
}

function BotIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="11" width="18" height="10" rx="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5" r="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v4m-4 5h.01m8 0h.01" />
    </svg>
  );
}
