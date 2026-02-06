import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Zap, TrendingUp, User } from "lucide-react";

// Preserve scroll position for each tab
const tabScrollPositions = {};

export default function BottomNavbar() {
  const location = useLocation();

  const navItems = [
    { name: "Home", icon: Home, path: createPageUrl("Home") },
    { name: "Study", icon: Zap, path: createPageUrl("FlashStudy") },
    { name: "Progress", icon: TrendingUp, path: createPageUrl("Progress") },
    { name: "Profile", icon: User, path: createPageUrl("Profile") },
  ];

  // Save scroll position when leaving a tab
  React.useEffect(() => {
    const saveScroll = () => {
      const mainContent = document.querySelector('main > div');
      if (mainContent) {
        tabScrollPositions[location.pathname] = mainContent.scrollTop;
      }
    };

    return saveScroll;
  }, [location.pathname]);

  // Restore scroll position when entering a tab
  React.useEffect(() => {
    const mainContent = document.querySelector('main > div');
    if (mainContent && tabScrollPositions[location.pathname] !== undefined) {
      requestAnimationFrame(() => {
        mainContent.scrollTop = tabScrollPositions[location.pathname];
      });
    }
  }, [location.pathname]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-card/95 backdrop-blur-lg border-t border-border z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <nav className="flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 select-none ${
                isActive
                  ? 'text-teal-600 bg-teal-50 dark:bg-teal-950'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[11px] font-medium leading-none">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}