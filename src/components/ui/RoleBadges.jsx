/**
 * Role Badges Component
 * Displays multiple role badges for users with multiple roles
 */

import { getUserRoles } from '../../utils/helpers';
import RoleBadge from './RoleBadge';

const RoleBadges = ({ user, size = 'sm', maxDisplay = 3 }) => {
  const roles = getUserRoles(user);

  if (!roles || roles.length === 0) {
    return <span className="text-xs text-gray-400">No roles</span>;
  }

  const displayRoles = roles.slice(0, maxDisplay);
  const remainingCount = roles.length - maxDisplay;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {displayRoles.map((role) => (
        <RoleBadge key={role} role={role} size={size} />
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-gray-500 font-medium">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
};

export default RoleBadges;
