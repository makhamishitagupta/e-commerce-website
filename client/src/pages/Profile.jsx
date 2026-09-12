import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api.js';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { Spinner } from '../components/ui/Spinner.jsx';
import { Button } from '../components/ui/Button.jsx';

const INITIAL_ADDRESS = {
  label: 'Home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
};

export const Profile = () => {
  const { user, loading } = useCurrentUser();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState(INITIAL_ADDRESS);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  useEffect(() => {
    if (user) setProfile(user);
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const handleAddressSubmit = async (event) => {
    event.preventDefault();

    // Basic format validation
    const phoneTrimmed = address.phone.trim();
    if (!/^\+?[0-9\s-]{8,15}$/.test(phoneTrimmed)) {
      toast.error('Please enter a valid phone number (8-15 digits)');
      return;
    }
    const pinTrimmed = address.postalCode.trim();
    if (!/^[0-9a-zA-Z\s-]{4,10}$/.test(pinTrimmed)) {
      toast.error('Please enter a valid postal/PIN code');
      return;
    }

    setAddressSubmitting(true);
    try {
      let response;
      if (editingAddressId) {
        response = await api.put(`/users/me/addresses/${editingAddressId}`, address);
        toast.success('Address updated successfully');
      } else {
        response = await api.post('/users/me/addresses', address);
        toast.success('Address added successfully');
      }
      setProfile(response.data.data);
      setAddress(INITIAL_ADDRESS);
      setEditingAddressId(null);
    } catch (error) {
      toast.error(error.message || 'Failed to save address');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      const response = await api.put(`/users/me/addresses/${addressId}`, { isDefault: true });
      setProfile(response.data.data);
      toast.success('Default delivery address updated');
    } catch (error) {
      toast.error(error.message || 'Failed to set default address');
    }
  };

  const startEditAddress = (savedAddress) => {
    setEditingAddressId(savedAddress._id);
    setAddress({
      label: savedAddress.label || 'Home',
      fullName: savedAddress.fullName || '',
      phone: savedAddress.phone || '',
      line1: savedAddress.line1 || '',
      line2: savedAddress.line2 || '',
      city: savedAddress.city || '',
      state: savedAddress.state || '',
      postalCode: savedAddress.postalCode || '',
      country: savedAddress.country || 'India',
      isDefault: Boolean(savedAddress.isDefault),
    });
  };

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">My Profile</h1>

      {!profile ? (
        <p className="mt-4 text-sm text-ink-500">
          Couldn&apos;t load your profile — please sign in to view your details.
        </p>
      ) : (
        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {profile.name?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-ink-900 dark:text-white">{profile.name}</p>
            <p className="text-sm text-ink-500">{profile.email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {profile.role}
            </span>
          </div>
        </div>
      )}

      {profile && (
        <>
          {/* Profile details form */}
          <form
            className="mt-6 space-y-4 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                const response = await api.put('/users/me', { name: profile.name, phone: profile.phone || '' });
                setProfile(response.data.data);
                toast.success('Profile details updated');
              } catch (error) {
                toast.error(error.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <h2 className="font-semibold text-base text-ink-900 dark:text-white">Profile Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Full Name</label>
                <input
                  required
                  value={profile.name || ''}
                  onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Phone Number</label>
                <input
                  value={profile.phone || ''}
                  onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <Button type="submit" loading={saving} size="sm">
              Save Profile
            </Button>
          </form>

          {/* Saved Addresses List */}
          <div className="mt-8 space-y-4">
            <h2 className="font-semibold text-base text-ink-900 dark:text-white">Saved Addresses</h2>
            {profile.addresses?.length === 0 ? (
              <p className="text-sm text-ink-500">No addresses saved yet. Add your delivery address below.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {profile.addresses.map((savedAddress) => (
                  <div
                    key={savedAddress._id}
                    className={`relative rounded-2xl border p-5 transition bg-white dark:bg-ink-950 ${
                      savedAddress.isDefault
                        ? 'border-brand-500 shadow-sm'
                        : 'border-ink-200 dark:border-ink-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-ink-900 dark:text-white">
                        {savedAddress.fullName}
                      </p>
                      {savedAddress.isDefault ? (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                          DEFAULT
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(savedAddress._id)}
                          className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Set as Default
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                      {savedAddress.line1}
                      {savedAddress.line2 && `, ${savedAddress.line2}`}
                    </p>
                    <p className="text-xs text-ink-600 dark:text-ink-300">
                      {savedAddress.city}, {savedAddress.state} {savedAddress.postalCode}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">Phone: {savedAddress.phone}</p>

                    <div className="mt-4 flex items-center gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
                      <button
                        type="button"
                        onClick={() => startEditAddress(savedAddress)}
                        className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Edit
                      </button>
                      <span className="text-ink-300 dark:text-ink-700">|</span>
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline"
                        onClick={async () => {
                          try {
                            const response = await api.delete(`/users/me/addresses/${savedAddress._id}`);
                            setProfile(response.data.data);
                            toast.success('Address deleted');
                            if (editingAddressId === savedAddress._id) {
                              setEditingAddressId(null);
                              setAddress(INITIAL_ADDRESS);
                            }
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add / Edit Address Form */}
          <form
            className="mt-8 space-y-4 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950"
            onSubmit={handleAddressSubmit}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base text-ink-900 dark:text-white">
                {editingAddressId ? 'Edit Address' : 'Add New Address'}
              </h2>
              {editingAddressId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAddressId(null);
                    setAddress(INITIAL_ADDRESS);
                  }}
                  className="text-xs text-ink-500 hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Recipient Name</label>
                <input
                  required
                  value={address.fullName}
                  onChange={(e) => setAddress((c) => ({ ...c, fullName: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Contact Phone</label>
                <input
                  required
                  value={address.phone}
                  onChange={(e) => setAddress((c) => ({ ...c, phone: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Address Line 1</label>
                <input
                  required
                  value={address.line1}
                  onChange={(e) => setAddress((c) => ({ ...c, line1: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="Street address, building, apartment"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Address Line 2 (Optional)</label>
                <input
                  value={address.line2}
                  onChange={(e) => setAddress((c) => ({ ...c, line2: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="Suite, unit, landmark"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">City</label>
                <input
                  required
                  value={address.city}
                  onChange={(e) => setAddress((c) => ({ ...c, city: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">State</label>
                <input
                  required
                  value={address.state}
                  onChange={(e) => setAddress((c) => ({ ...c, state: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="State"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Postal / PIN Code</label>
                <input
                  required
                  value={address.postalCode}
                  onChange={(e) => setAddress((c) => ({ ...c, postalCode: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="e.g. 560001"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Country</label>
                <input
                  required
                  value={address.country}
                  onChange={(e) => setAddress((c) => ({ ...c, country: e.target.value }))}
                  className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  placeholder="Country"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-2 text-xs text-ink-700 dark:text-ink-300 cursor-pointer">
              <input
                type="checkbox"
                checked={address.isDefault}
                onChange={(e) => setAddress((c) => ({ ...c, isDefault: e.target.checked }))}
                className="rounded border-ink-300 text-brand-500"
              />
              Make this my default shipping address
            </label>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={addressSubmitting} size="sm">
                {editingAddressId ? 'Update Address' : 'Save Address'}
              </Button>
              {editingAddressId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAddressId(null);
                    setAddress(INITIAL_ADDRESS);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
};
