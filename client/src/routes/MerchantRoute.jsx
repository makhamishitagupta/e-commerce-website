import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { Spinner } from '../components/ui/Spinner.jsx';

/**
 * Route guard that restricts access exclusively to users with 'merchant' or 'admin' roles.
 * Regular shoppers are redirected to /merchant/onboard or home.
 */
export const MerchantRoute = () => {
  const { user, loading, isLoaded, isSignedIn } = useCurrentUser();

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isAuthorized = isSignedIn && (user?.role === 'merchant' || user?.role === 'admin');

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
