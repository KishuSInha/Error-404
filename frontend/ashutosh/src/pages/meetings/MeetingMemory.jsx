import { motion } from 'framer-motion'
import { Calendar, Users, Sparkles } from 'lucide-react'
import { meetings } from '../../data/dummyData'
import GlassCard from '../../components/ui/GlassCard'

export default function MeetingMemory() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Meeting Memory</h1>
        <p className="text-slate-500 text-sm mt-1">AI summaries and action items from every meeting</p>
      </div>

      <div className="space-y-4">
        {meetings.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <GlassCard hover={false} className="!p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Calendar size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{m.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{m.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users size={12} />
                  <span>{m.attendees.join(', ')}</span>
                </div>
              </div>
              <p className="text-sm text-slate-400 mt-4 leading-relaxed">{m.summary}</p>
              <div className="mt-4 pt-3 border-t border-white/8 flex items-center gap-2">
                <Sparkles size={13} className="text-cyan-400" />
                <span className="text-xs text-cyan-400 font-medium">{m.tasksExtracted} tasks extracted</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
