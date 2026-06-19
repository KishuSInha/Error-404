import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import {
  LayoutDashboard, Crosshair, Target, Mail, Calendar, Star,
  GitBranch, CalendarDays, Bot, Bell, BarChart3, User, Settings,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { path: '/mission', label: 'Mission Control', icon: Crosshair, group: 'main' },
  { path: '/focus', label: "Today's Focus", icon: Target, group: 'main' },
  { path: '/inbox', label: 'Inbox Intelligence', icon: Mail, group: 'intelligence' },
  { path: '/meetings', label: 'Meeting Memory', icon: Calendar, group: 'intelligence' },
  { path: '/tasks', label: 'Task Universe', icon: Star, group: 'workspace' },
  { path: '/dependencies', label: 'Dependency Map', icon: GitBranch, group: 'workspace' },
  { path: '/weekly', label: 'Weekly Plan', icon: CalendarDays, group: 'workspace' },
  { path: '/assistant', label: 'AI Assistant', icon: Bot, group: 'ai' },
  { path: '/notifications', label: 'Notifications', icon: Bell, group: 'ai' },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, group: 'insights' },
  { path: '/profile', label: 'Profile', icon: User, group: 'account' },
  { path: '/settings', label: 'Settings', icon: Settings, group: 'account' },
]

const groups = {
  main: 'COMMAND',
  intelligence: 'INTELLIGENCE',
  workspace: 'WORKSPACE',
  ai: 'AI CORE',
  insights: 'INSIGHTS',
  account: 'ACCOUNT',
}

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useApp()

  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className="fixed left-0 top-0 h-screen z-40 flex flex-col bg-space-800 border-r border-white/5 overflow-hidden"
    >
      <div className="flex items-center h-16 px-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-display font-bold text-white text-sm whitespace-nowrap"
              >
                TaskPilot <span className="gradient-text">AI</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          whileTap={{ scale: 0.9 }}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </motion.button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-6 scrollbar-hide">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-4 mb-1.5 text-[10px] font-semibold tracking-widest text-slate-600"
                >
                  {groups[group]}
                </motion.p>
              )}
            </AnimatePresence>
            {items.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path}>
                {({ isActive }) => (
                  <motion.div
                    className={`relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    whileHover={{ x: 2 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-400 rounded-full"
                      />
                    )}
                    <Icon size={16} className="shrink-0" />
                    <AnimatePresence>
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-sm font-medium whitespace-nowrap"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </motion.aside>
  )
}
