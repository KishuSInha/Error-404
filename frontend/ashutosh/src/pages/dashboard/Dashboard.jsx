import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Mail, Eye, Zap } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import GlassCard from '../../components/ui/GlassCard'
import Badge from '../../components/ui/Badge'
import { tasks, weeklyStats, chartData, user } from '../../data/dummyData'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-space-800 border border-white/10 rounded-xl p-3 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
      </div>
    )
  }
  return null
}

function ProductivityRing({ score }) {
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <motion.circle
          cx="72" cy="72" r="52" fill="none"
          stroke="url(#ringGrad)" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center z-10">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="text-3xl font-bold font-display gradient-text">{score}</motion.p>
        <p className="text-xs text-slate-500">Score</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const urgentTasks = tasks.filter(t => t.priority === 'P1' && t.status !== 'completed')

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h1 className="text-3xl font-display font-bold text-white">
          {greeting}, <span className="gradient-text">{user.name}</span> ✦
        </h1>
        <p className="text-slate-500 text-sm">
          AI has analyzed your inbox and found <span className="text-cyan-400 font-medium">3 hidden tasks</span>. You have <span className="text-red-400 font-medium">{urgentTasks.length} urgent items</span> needing attention.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tasks Completed" value={weeklyStats.tasksCompleted} icon={CheckCircle2} color="green" trend="12% this week" delay={0} />
        <StatCard label="Urgent Tasks" value={urgentTasks.length} icon={AlertTriangle} color="red" delay={0.05} />
        <StatCard label="Emails Analyzed" value={weeklyStats.emailsAnalyzed} icon={Mail} color="cyan" trend="Today" delay={0.1} />
        <StatCard label="Hidden Tasks Found" value={weeklyStats.hiddenTasks} icon={Eye} color="purple" trend="This week" delay={0.15} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 md:col-span-4 flex flex-col items-center justify-center gap-4" hover={false}>
          <p className="text-sm font-medium text-slate-400 self-start">Productivity Score</p>
          <ProductivityRing score={weeklyStats.productivityScore} />
          <div className="w-full grid grid-cols-3 gap-2 text-center">
            {[['Focus', `${weeklyStats.focusHours}h`], ['Switches', weeklyStats.contextSwitches], ['Streak', `${user.streak}d`]].map(([l, v]) => (
              <div key={l}>
                <p className="text-lg font-bold text-white">{v}</p>
                <p className="text-xs text-slate-600">{l}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-8" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-300">Weekly Productivity</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Completed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />Added</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData.weekly}>
              <defs>
                <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="purple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="completed" stroke="#3B82F6" fill="url(#blue)" strokeWidth={2} name="Completed" />
              <Area type="monotone" dataKey="added" stroke="#8B5CF6" fill="url(#purple)" strokeWidth={2} name="Added" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-5" hover={false}>
          <p className="text-sm font-medium text-slate-300 mb-4">Activity Radar</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={chartData.radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 11 }} />
              <Radar name="Score" dataKey="value" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-7" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-300">Top Priorities Today</p>
            <Zap size={14} className="text-yellow-400" />
          </div>
          <div className="space-y-3">
            {urgentTasks.slice(0, 4).map((task, i) => (
              <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/3 hover:bg-white/5 transition-colors">
                <div className={`w-1.5 h-8 rounded-full ${task.priority === 'P1' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{task.title}</p>
                  <p className="text-xs text-slate-500">{task.category} · Due {task.deadline}</p>
                </div>
                <Badge label={task.priority} type={task.priority} />
              </motion.div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12" hover={false}>
          <p className="text-sm font-medium text-slate-300 mb-4">Task Distribution by Category</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData.categoryBreakdown} layout="vertical" barCategoryGap={6}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} width={75} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {chartData.categoryBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    </div>
  )
}
