import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api.js';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { Spinner } from '../components/ui/Spinner.jsx';
import { Button } from '../components/ui/Button.jsx';

export const Profile = () => {
  const { user, loading } = useCurrentUser();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState({ fullName: '', phone: '', line1: '', city: '', state: '', postalCode: '', country: 'India' });

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

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">My Profile</h1>

      {!profile ? (
        <p className="mt-4 text-sm text-ink-500">
          Couldn&apos;t load your profile — the database or Clerk credentials may not be configured yet.
        </p>
      ) : (
        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-ink-200 p-6 dark:border-ink-800">
          {profile.avatar && (
            <img src={profile.avatar} alt={profile.name} className="h-16 w-16 rounded-full object-cover" />
          )}
          <div>
            <p className="text-lg font-medium text-ink-900 dark:text-white">{profile.name}</p>
            <p className="text-sm text-ink-500">{profile.email}</p>
            <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {profile.role}
            </span>
          </div>
        </div>
      )}

      {profile && (
        <>
          <form
            className="mt-6 space-y-4 rounded-2xl border border-ink-200 p-6 dark:border-ink-800"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                const response = await api.put('/users/me', { name: profile.name, phone: profile.phone || '' });
                setProfile(response.data.data);
                toast.success('Profile updated');
              } catch (error) {
                toast.error(error.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <h2 className="font-semibold text-ink-900 dark:text-white">Profile details</h2>
            <input
              value={profile.name || ''}
              onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              placeholder="Name"
            />
            <input
              value={profile.phone || ''}
              onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              placeholder="Phone"
            />
            <Button type="submit" loading={saving} size="sm">Save profile</Button>
          </form>

          <form
            className="mt-6 space-y-4 rounded-2xl border border-ink-200 p-6 dark:border-ink-800"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const response = await api.post('/users/me/addresses', address);
                setProfile(response.data.data);
                setAddress({ fullName: '', phone: '', line1: '', city: '', state: '', postalCode: '', country: 'India' });
                toast.success('Address added');
              } catch (error) {
                toast.error(error.message);
              }
            }}
          >
            <h2 className="font-semibold text-ink-900 dark:text-white">Add address</h2>
            {['fullName', 'phone', 'line1', 'city', 'state', 'postalCode'].map((field) => (
              <input
                key={field}
                required
                value={address[field]}
                onChange={(event) => setAddress((current) => ({ ...current, [field]: event.target.value }))}
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                placeholder={field}
              />
            ))}
            <Button type="submit" size="sm">Add address</Button>
          </form>

          {profile.addresses?.length > 0 && (
            <div className="mt-6 space-y-3">
              <h2 className="font-semibold text-ink-900 dark:text-white">Saved addresses</h2>
              {profile.addresses.map((savedAddress) => (
                <div key={savedAddress._id} className="rounded-2xl border border-ink-200 p-4 text-sm dark:border-ink-800">
                  <p className="font-medium text-ink-900 dark:text-white">{savedAddress.fullName}</p>
                  <p className="text-ink-500">{savedAddress.line1}, {savedAddress.city}, {savedAddress.state} {savedAddress.postalCode}</p>
                  <button
                    className="mt-2 text-xs text-red-500 hover:underline"
                    onClick={async () => {
                      try {
                        const response = await api.delete(`/users/me/addresses/${savedAddress._id}`);
                        setProfile(response.data.data);
                        toast.success('Address deleted');
                      }
                      catch (error) { toast.error(error.message); }
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
