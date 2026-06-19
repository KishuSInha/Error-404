import { motion } from 'framer-motion'
import { LineChart, Line, BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import GlassCard from '../../components/ui/GlassCard'
import StatCard from '../../components/ui/StatCard'
import { chartData, weeklyStats } from '../../data/dummyData'
import { TrendingUp, Clock, Target, Zap } from 'lucide-react'

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

export default function Analytics() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Your productivity, quantified</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Productivity Score" value={weeklyStats.productivityScore} icon={TrendingUp} color="blue" trend="5% vs last week" delay={0} />
        <StatCard label="Focus Hours" value={`${weeklyStats.focusHours}h`} icon={Clock} color="cyan" delay={0.05} />
        <StatCard label="Tasks Completed" value={weeklyStats.tasksCompleted} icon={Target} color="green" delay={0.1} />
        <StatCard label="Context Switches" value={weeklyStats.contextSwitches} icon={Zap} color="purple" delay={0.15} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 lg:col-span-8" hover={false}>
          <p className="text-sm font-medium text-slate-300 mb-4">Completion Trend</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData.weekly}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="completed" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: '#3B82F6', r: 4 }} name="Completed" />
              <Line type="monotone" dataKey="added" stroke="#8B5CF6" strokeWidth={2.5} dot={{ fill: '#8B5CF6', r: 4 }} name="Added" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="col-span-12 lg:col-span-4" hover={false}>
          <p className="text-sm font-medium text-slate-300 mb-4">By Category</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={chartData.categoryBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {chartData.categoryBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {chartData.categoryBreakdown.map(c => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12" hover={false}>
          <p className="text-sm font-medium text-slate-300 mb-4">Weekly Volume</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData.weekly}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Completed" />
              <Bar dataKey="added" fill="#8B5CF6" radius={[6, 6, 0, 0]} name="Added" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    </div>
  )
}
