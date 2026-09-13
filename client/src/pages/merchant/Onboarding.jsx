import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '../../services/api.js';
import { Button } from '../../components/ui/Button.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

export const MerchantOnboarding = () => {
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
    formState: { errors },
  } = useForm({
    defaultValues: {
      storeName: '',
      description: '',
      contactEmail: '',
      contactPhone: '',
      businessCategory: 'Haute Couture & Accessories',
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await api.post('/merchants/onboard', data);
      toast.success('Boutique store registered successfully!');
      if (res.data.data.apiKey) {
        setOnboardedKey(res.data.data.apiKey);
      } else {
        window.location.assign('/merchant');
      }
    } catch (err) {
      toast.error(err.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingMerchant) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-xs uppercase tracking-widest text-ink-400">Verifying Merchant Status…</p>
      </div>
    );
  }

  if (existingMerchant) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-2xl text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 shadow-sm">
          🏛️
        </div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white sm:text-3xl">
          Active Boutique Store Found
        </h1>
        <p className="max-w-md text-xs text-ink-500 sm:text-sm">
          Your account is currently the registered owner of{' '}
          <strong className="text-ink-900 dark:text-white">{existingMerchant.storeName}</strong>.
        </p>
        <Button as={Link} to="/merchant" className="mt-2 shadow-sm">
          Open Merchant Command Center →
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page py-12 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
          ✨ LuxeStyle Merchant Partner
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
          Onboard Your Luxury Boutique
        </h1>
        <p className="mt-2 text-xs text-ink-500 sm:text-sm max-w-xl mx-auto">
          Unlock market basket AI intelligence, machine-readable agent commerce APIs, and autonomous customer checkout.
        </p>
      </div>

      {onboardedKey ? (
        <div className="rounded-3xl border border-brand-300 bg-white p-8 shadow-xl dark:border-brand-800/80 dark:bg-ink-950 text-center animate-slide-up">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 shadow-sm">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink-900 dark:text-white">
            Your Boutique is Live & Agent-Ready!
          </h2>
          <p className="mt-2 text-xs text-ink-500 sm:text-sm max-w-md mx-auto">
            Below is your initial <strong className="text-ink-900 dark:text-white">Agent API Key</strong>. Copy it now — external AI agents and tools use this key to search your catalog and trigger checkouts:
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-900 font-mono text-xs">
            <span className="truncate select-all text-brand-600 dark:text-brand-400 font-bold">
              {onboardedKey}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(onboardedKey);
                toast.success('Agent API Key copied to clipboard');
              }}
              className="w-full sm:w-auto shrink-0"
            >
              Copy Key
            </Button>
          </div>

          <div className="mt-8 flex justify-center">
            <Button as={Link} to="/merchant" className="w-full sm:w-auto shadow-md">
              Enter Merchant Command Center →
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-xs">
            <div>
              <label className="mb-1 block font-bold text-ink-700 dark:text-ink-300">
                Boutique / Store Name <span className="text-brand-600">*</span>
              </label>
              <input
                {...register('storeName', { required: 'Store name is required' })}
                placeholder="e.g. Atelier Aurelia"
                className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
              {errors.storeName && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.storeName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block font-bold text-ink-700 dark:text-ink-300">
                Boutique Philosophy & Description
              </label>
              <textarea
                rows={3}
                {...register('description')}
                placeholder="Describe your boutique's specialty, craft, and fashion philosophy..."
                className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-bold text-ink-700 dark:text-ink-300">
                  Business Email
                </label>
                <input
                  type="email"
                  {...register('contactEmail')}
                  placeholder="contact@boutique.com"
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink-700 dark:text-ink-300">
                  Business Phone
                </label>
                <input
                  type="tel"
                  {...register('contactPhone')}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-bold text-ink-700 dark:text-ink-300">
                Primary Luxury Domain
              </label>
              <select
                {...register('businessCategory')}
                className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-xs text-ink-900 outline-none focus:border-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white cursor-pointer"
              >
                <option value="Haute Couture & Accessories">Haute Couture & Accessories</option>
                <option value="Contemporary Men's Tailoring">Contemporary Men's Tailoring</option>
                <option value="Fine Footwear & Leather">Fine Footwear & Leather</option>
                <option value="Timeless Everyday Essentials">Timeless Everyday Essentials</option>
                <option value="Artisanal Home Decor">Artisanal Home Decor</option>
              </select>
            </div>

            <Button type="submit" loading={submitting} className="w-full mt-4 py-3 shadow-md">
              Complete Onboarding & Generate Agent APIs →
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
