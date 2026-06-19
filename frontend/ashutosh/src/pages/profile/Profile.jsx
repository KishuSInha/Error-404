import { motion } from 'framer-motion'
import { Mail, Briefcase, Flame, Award } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import GlassCard from '../../components/ui/GlassCard'
import { weeklyStats } from '../../data/dummyData'

export default function Profile() {
  const { user } = useApp()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-white">Profile</h1>

      <GlassCard hover={false} className="!p-8 flex items-center gap-6 flex-wrap">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
          {user.avatar}
        </motion.div>
        <div>
          <h2 className="text-xl font-display font-bold text-white">{user.name}</h2>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><Briefcase size={12} /> {user.role}</p>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><Mail size={12} /> {user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <Flame size={16} className="text-orange-400" />
          <span className="text-sm font-bold text-orange-400">{user.streak} day streak</span>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Tasks Completed', weeklyStats.tasksCompleted],
          ['Productivity', `${weeklyStats.productivityScore}%`],
          ['Focus Hours', `${weeklyStats.focusHours}h`],
          ['Hidden Tasks Found', weeklyStats.hiddenTasks],
        ].map(([label, val]) => (
          <GlassCard key={label} hover={false} className="!p-4 text-center">
            <p className="text-2xl font-bold font-display gradient-text">{val}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard hover={false} className="!p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award size={15} className="text-yellow-400" />
          <p className="text-sm font-medium text-slate-300">Achievements</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {['12-Day Streak', 'Inbox Zero Hero', 'Sprint Champion', 'Early Bird'].map(a => (
            <span key={a} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">{a}</span>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
