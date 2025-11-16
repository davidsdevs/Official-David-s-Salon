/**
 * Role Badge Component
 * Displays role badges with appropriate colors
 */

import { ROLE_LABELS } from '../../utils/constants';

const RoleBadge = ({ role, size = 'sm' }) => {
  // Role color mapping
  const roleColors = {
    systemAdmin: 'bg-purple-100 text-purple-800 border-purple-200',
    operationalManager: 'bg-blue-100 text-blue-800 border-blue-200',
    branchManager: 'bg-green-100 text-green-800 border-green-200',
    receptionist: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    inventoryController: 'bg-orange-100 text-orange-800 border-orange-200',
    stylist: 'bg-pink-100 text-pink-800 border-pink-200',
    client: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const colorClass = roleColors[role] || 'bg-gray-100 text-gray-800 border-gray-200';
  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colorClass} ${sizeClass}`}
    >
      {ROLE_LABELS[role] || role}
    </span>
  );
};

export default RoleBadge;
