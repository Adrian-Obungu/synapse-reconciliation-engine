import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PageErrorBoundary } from '../ErrorBoundary';

const TITLE_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/mappings': 'KRA Mappings',
};

export function AppShell() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('synapse_sidebar_collapsed');
    return saved === 'true';
  });
  const location = useLocation();

  // Force specific states based on screen size on mount and resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        // sm: always start collapsed (hidden overlay)
        setIsCollapsed(true);
      } else if (width >= 768 && width < 1024) {
        // md: force collapsed (icon rail)
        setIsCollapsed(true);
      }
    };
    
    handleResize(); // Check initial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('synapse_sidebar_collapsed', String(next));
  };

  // Derive title from pathname, fallback to generic
  const currentPath = location.pathname;
  let title = 'Synapse';
  for (const path in TITLE_MAP) {
    if (currentPath.startsWith(path)) {
      title = TITLE_MAP[path];
      break;
    }
  }

  return (
    <div className="flex h-screen bg-midnight-950 overflow-hidden">
      <Sidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header 
          title={title} 
          onMenuClick={window.innerWidth < 768 ? handleToggle : undefined} 
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-midnight-950 relative">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
