import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '../../services/api.js';
import { Button } from '../../components/ui/Button.jsx';

export const MerchantOnboarding = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [onboardedKey, setOnboardedKey] = useState(null);
  const [existingMerchant, setExistingMerchant] = useState(null);
  const [checkingMerchant, setCheckingMerchant] = useState(true);

  useEffect(() => {
    api.get('/merchants/me')
      .then((res) => setExistingMerchant(res.data.data))
      .catch(() => setExistingMerchant(null))
      .finally(() => setCheckingMerchant(false));
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      storeName: 'Atelier Aurelia',
      description: 'Handcrafted luxury apparel and bespoke Italian leather goods.',
      contactEmail: 'contact@atelieraurelia.com',
      contactPhone: '+91 98765 43210',
      businessCategory: 'Designer Apparel & Leather',
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await api.post('/merchants/onboard', data);
      toast.success('Merchant store registered!');
      if (res.data.data.apiKey) {
        setOnboardedKey(res.data.data.apiKey);
        localStorage.setItem('luxestyle-agent-key', res.data.data.apiKey);
      } else {
        window.location.assign('/merchant');
      }
    } catch (err) {
      toast.error(err.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunchDemoMerchant = () => {
    localStorage.setItem('luxestyle-demo-role', 'merchant');
    localStorage.setItem('luxestyle-agent-key', 'lx_test_agent_key_2026');
    toast.success('Connected as LuxeStyle Flagship Merchant!');
    navigate('/merchant');
  };

  if (checkingMerchant) return null;

  if (existingMerchant) {
    return (
      <div className="container-page flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">You already have a shop.</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Each account can own only one merchant store: {existingMerchant.storeName}.
        </p>
        <Button as={Link} to="/merchant">Open Merchant Portal</Button>
      </div>
    );
  }

  return (
    <div className="container-page py-12 max-w-3xl">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300 uppercase tracking-wider">
          Merchant Onboarding
        </span>
        <h1 className="mt-3 text-3xl font-display font-semibold text-ink-900 dark:text-white">
          Onboard Your Luxury Boutique
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          Unlock AI transaction intelligence, agent-ready commerce APIs, and automated bundle recommendations.
        </p>
      </div>

      {onboardedKey ? (
        <div className="rounded-2xl border border-brand-300 bg-white p-8 shadow-sm dark:border-brand-800/80 dark:bg-ink-950 text-center animate-slide-up">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-ink-900 dark:text-white">
            Your Store is Live & Agent-Ready!
          </h2>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            Below is your initial <strong className="text-ink-900 dark:text-white">Agent API Key</strong>. Copy it now — external AI agents and tools use this key to interact with your store:
          </p>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-ink-300 bg-ink-50 px-4 py-3 dark:border-ink-700 dark:bg-ink-800 font-mono text-sm">
            <span className="truncate select-all text-brand-600 dark:text-brand-400 font-semibold">
              {onboardedKey}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(onboardedKey);
                toast.success('Agent API Key copied!');
              }}
              className="ml-3 shrink-0"
            >
              Copy Key
            </Button>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <Button as={Link} to="/merchant" className="w-full sm:w-auto">
              Enter Merchant Dashboard →
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-200 bg-white p-8 shadow-sm dark:border-ink-800 dark:bg-ink-950">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-ink-200 pb-6 dark:border-ink-800">
            <div>
              <h2 className="font-semibold text-ink-900 dark:text-white">Quick Evaluation Mode</h2>
              <p className="text-xs text-ink-500">
                Want to test with pre-seeded products, historical orders, and analytics immediately?
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleLaunchDemoMerchant}
              className="shrink-0"
            >
              Launch Flagship Store Demo →
            </Button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-900 dark:text-white">
                Store Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('storeName', { required: 'Store name is required' })}
                placeholder="e.g. Atelier Aurelia"
                className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white focus:border-ink-900 dark:focus:border-white focus:outline-none transition"
              />
              {errors.storeName && (
                <p className="mt-1 text-xs text-red-500">{errors.storeName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink-900 dark:text-white">
                Store Description
              </label>
              <textarea
                rows={3}
                {...register('description')}
                placeholder="Describe your boutique's specialty and fashion philosophy..."
                className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white focus:border-ink-900 dark:focus:border-white focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-900 dark:text-white">
                  Business Email
                </label>
                <input
                  type="email"
                  {...register('contactEmail')}
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white focus:border-ink-900 dark:focus:border-white focus:outline-none transition"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-900 dark:text-white">
                  Business Phone
                </label>
                <input
                  type="tel"
                  {...register('contactPhone')}
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white focus:border-ink-900 dark:focus:border-white focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink-900 dark:text-white">
                Primary Luxury Category
              </label>
              <select
                {...register('businessCategory')}
                className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white focus:border-ink-900 dark:focus:border-white focus:outline-none transition"
              >
                <option value="Haute Couture & Accessories">Haute Couture & Accessories</option>
                <option value="Contemporary Men's Tailoring">Contemporary Men's Tailoring</option>
                <option value="Fine Footwear & Leather">Fine Footwear & Leather</option>
                <option value="Timeless Everyday Essentials">Timeless Everyday Essentials</option>
              </select>
            </div>

            <Button type="submit" loading={submitting} className="w-full mt-6 py-3">
              Complete Onboarding & Generate Agent APIs
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
