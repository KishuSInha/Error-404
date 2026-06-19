import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Search, Bell, Cpu, Command } from 'lucide-react'

export default function Navbar() {
  const { user, sidebarCollapsed } = useApp()
  const [searchFocused, setSearchFocused] = useState(false)
  const navigate = useNavigate()
  const marginLeft = sidebarCollapsed ? 72 : 240

  return (
    <motion.header
      animate={{ marginLeft }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className="fixed top-0 right-0 h-16 z-30 flex items-center gap-4 px-6 bg-space-900/80 backdrop-blur-xl border-b border-white/5"
      style={{ left: marginLeft }}
    >
      <div className={`relative flex-1 max-w-md transition-all ${searchFocused ? 'max-w-xl' : ''}`}>
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search tasks, emails, meetings..."
          className="w-full bg-white/5 border border-white/8 rounded-2xl pl-9 pr-4 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-600 text-xs">
          <Command size={10} /><span>K</span>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20">
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
            className="w-2 h-2 rounded-full bg-green-400" />
          <Cpu size={13} className="text-green-400" />
          <span className="text-xs text-green-400 font-medium">AI Active</span>
        </div>

        <span className="text-xs text-slate-500 hidden md:block">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </motion.button>

        <motion.div whileHover={{ scale: 1.05 }}
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center cursor-pointer">
          <span className="text-xs font-bold text-white">
            {user.name.charAt(0)}
          </span>
        </motion.div>
      </div>
    </motion.header>
  )
}
