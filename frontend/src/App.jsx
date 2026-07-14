import React, { useState, useEffect } from 'react';
import VendorForm from './pages/VendorForm';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import UsersSettings from './pages/UsersSettings';
import { ShieldCheck, UserPlus, Sun, Moon, LogOut, ChevronLeft, ChevronRight, Users } from 'lucide-react';

export default function App() {
  // Simple state-based routing. Defaults to "admin"
  const [currentPage, setCurrentPage] = useState('admin');
  const theme = 'light';

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Authentication State
  const [token, setToken] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const handleLoginSuccess = (newToken, username, role) => {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_username', username);
    setToken(newToken);
    setAdminUser(username);
    setUserRole(role);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    setToken(null);
    setAdminUser(null);
    setUserRole(null);
  };

  // Force light mode on document root
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  // Handle URL hash changes for back-button compatibility
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/form') {
        setCurrentPage('form');
      } else if (hash === '#/users') {
        setCurrentPage('users');
      } else {
        setCurrentPage('admin');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial check
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page) => {
    if (page === 'form') {
      window.location.hash = '/form';
    } else if (page === 'users') {
      window.location.hash = '/users';
    } else {
      window.location.hash = '/admin';
    }
    setCurrentPage(page);
  };

  // Enforce Login globally before any page or navigation can be rendered
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
        <div className="w-full">
          <Login onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
      
      {/* Left Collapsible Sidebar */}
      <aside className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'} h-screen sticky top-0 z-40 shrink-0`}>
        
        {/* Top Branding Section */}
        <div className="flex flex-col">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center py-4' : 'justify-between p-4'} border-b border-slate-200 dark:border-slate-800 min-h-[73px]`}>
            {!sidebarCollapsed && (
              <img src="/logo.png" alt="Inteliwaves Logo" className="h-6 w-auto object-contain" />
            )}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all"
              title={sidebarCollapsed ? "Expand Menu" : "Collapse Menu"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Options */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => navigateTo('admin')}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                currentPage === 'admin' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Admin Panel"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Admin Panel</span>}
            </button>

            <button
              onClick={() => navigateTo('form')}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                currentPage === 'form' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vendor Form"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Vendor Form</span>}
            </button>

            {userRole === 'Admin' && (
              <button
                onClick={() => navigateTo('users')}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                  currentPage === 'users' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="User Settings"
              >
                <Users className="w-4 h-4 shrink-0 text-indigo-500" />
                {!sidebarCollapsed && <span>User Settings</span>}
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Preferences Section */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs md:text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent transition-all"
            title="Logout session"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 min-h-screen overflow-y-auto bg-slate-950 text-slate-100 transition-colors duration-200">
        {currentPage === 'form' ? (
          <VendorForm />
        ) : currentPage === 'users' ? (
          <UsersSettings token={token} />
        ) : (
          <Dashboard token={token} userRole={userRole} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
