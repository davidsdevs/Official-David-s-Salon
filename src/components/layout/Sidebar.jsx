import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar, menuItems, bottomItems }) => {
  return (
    <>
      {/* Mobile/Tablet overlay - Show on mobile and tablet, hide on desktop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - Hidden by default on mobile/tablet, always visible on desktop */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-white border-r border-gray-200
          transition-transform duration-300 ease-in-out
          w-64 flex flex-col z-30
          ${isOpen ? 'translate-x-0 z-50' : '-translate-x-full'}
          lg:translate-x-0 lg:z-30
        `}
      >
        {/* Mobile/Tablet close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">DS</span>
            </div>
            <span className="font-semibold text-gray-900">DSMS</span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item, index) => {
            const isFirstSection = index === 0 || (item.section && index > 0);
            const prevItem = index > 0 ? menuItems[index - 1] : null;
            const showDivider = item.section && prevItem && !prevItem.section;
            
            return (
              <div key={index}>
                {/* Divider before section (except first section) */}
                {showDivider && (
                  <div className="my-3 border-t border-gray-200"></div>
                )}
                
                {/* Section Header */}
                {item.section && (
                  <div className={`px-3 ${index === 0 ? 'pt-0 pb-2' : 'pt-1 pb-2'} text-xs font-semibold text-gray-500 uppercase tracking-wider`}>
                    {item.section}
                  </div>
                )}
                
                {/* Menu Item */}
                {item.path && (
                  <NavLink
                    to={item.path}
                    end={item.path.endsWith('/settings') || item.label === 'Dashboard'}
                    onClick={toggleSidebar}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white font-medium shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                            isActive 
                              ? 'bg-white text-primary-600' 
                              : 'bg-red-500 text-white'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Items (Notifications, etc.) */}
        {bottomItems && bottomItems.length > 0 && (
          <div className="border-t border-gray-200 p-4 flex-shrink-0 space-y-1">
            {bottomItems.map((item, index) => (
              <NavLink
                key={index}
                to={item.path}
                onClick={toggleSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white font-medium shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        isActive 
                          ? 'bg-white text-primary-600' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
