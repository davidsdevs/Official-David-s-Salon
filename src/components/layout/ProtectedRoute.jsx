import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import toast from 'react-hot-toast';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { currentUser, activeRole } = useAuth();
  const location = useLocation();
  const lastToastPath = useRef('');

  // Show toast only once per path change (with slight delay to avoid overlap with success messages)
  useEffect(() => {
    if (allowedRoles.length > 0 && activeRole) {
      const hasAccess = allowedRoles.includes(activeRole);
      if (!hasAccess && lastToastPath.current !== location.pathname) {
        // Small delay to avoid overlapping with role switch success message
        const timer = setTimeout(() => {
          toast.error('Please switch to the required role to access this page');
        }, 100);
        lastToastPath.current = location.pathname;
        return () => clearTimeout(timer);
      }
    }
  }, [location.pathname, activeRole, allowedRoles]);

  // Not authenticated
  if (!currentUser) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Check role authorization
  // STRICT: User must be in the ACTIVE role to access (not just have the role)
  if (allowedRoles.length > 0) {
    const hasAccess = allowedRoles.includes(activeRole);
    
    if (!hasAccess) {
      // Redirect to current active role's dashboard
      const dashboardMap = {
        systemAdmin: ROUTES.ADMIN_DASHBOARD,
        operationalManager: ROUTES.OPERATIONAL_MANAGER_DASHBOARD,
        branchManager: ROUTES.MANAGER_DASHBOARD,
        receptionist: ROUTES.RECEPTIONIST_DASHBOARD,
        inventoryController: ROUTES.INVENTORY_DASHBOARD,
        stylist: ROUTES.STYLIST_DASHBOARD,
        client: ROUTES.CLIENT_DASHBOARD,
      };

      return <Navigate to={dashboardMap[activeRole] || ROUTES.HOME} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
