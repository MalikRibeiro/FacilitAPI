import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Database, 
  Activity, 
  Zap,
  ChevronRight,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'integrations', label: 'Integrações', icon: Zap },
    { id: 'logs', label: 'Logs de Execução', icon: Activity },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar Desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-64' : 'w-20'
        } hidden md:block`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shrink-0">
              <Database className="h-6 w-6 text-white" />
            </div>
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-xl text-zinc-900 tracking-tight"
              >
                FacilitAPI
              </motion.span>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  activeTab === item.id 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${activeTab === item.id ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                {isSidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
                {isSidebarOpen && activeTab === item.id && (
                  <motion.div layoutId="active-pill" className="ml-auto">
                    <ChevronRight className="h-4 w-4" />
                  </motion.div>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-100">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-all"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-zinc-500">
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold text-zinc-900 capitalize">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-medium text-zinc-900">{user?.user_metadata?.name || user?.email?.split('@')[0]}</span>
              <span className="text-xs text-zinc-500">{user?.email}</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600">
              <UserIcon size={20} />
            </div>
            <button 
              onClick={() => signOut()}
              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
