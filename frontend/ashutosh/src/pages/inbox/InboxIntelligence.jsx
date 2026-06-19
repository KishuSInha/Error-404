import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Sparkles, ArrowRight } from 'lucide-react'
import { emails } from '../../data/dummyData'
import Badge from '../../components/ui/Badge'

export default function InboxIntelligence() {
  const [selected, setSelected] = useState(emails[0])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Inbox Intelligence</h1>
        <p className="text-slate-500 text-sm mt-1">AI reads every email and extracts the tasks hiding inside</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 space-y-2">
          {emails.map((email, i) => (
            <motion.div key={email.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => setSelected(email)}
              className={`glass !rounded-2xl p-4 cursor-pointer transition-all ${selected.id === email.id ? 'border-blue-500/40 bg-blue-500/5' : ''} ${!email.read ? '' : 'opacity-70'}`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center shrink-0 text-xs font-bold text-white">
                  {email.from.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${!email.read ? 'font-semibold text-white' : 'text-slate-300'}`}>{email.from}</p>
                    <span className="text-xs text-slate-600 shrink-0">{email.time}</span>
                  </div>
                  <p className="text-sm text-slate-400 truncate">{email.subject}</p>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{email.preview}</p>
                </div>
                {!email.read && <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1" />}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-5">
          <motion.div key={selected.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass p-6 space-y-5 sticky top-20">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-slate-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Email Detail</span>
            </div>
            <div>
              <p className="text-white font-semibold">{selected.subject}</p>
              <p className="text-sm text-slate-500 mt-1">From {selected.from} · {selected.time}</p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{selected.preview}</p>

            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">AI Extracted Task</span>
              </div>
              <div className="p-4 rounded-2xl bg-cyan-500/8 border border-cyan-500/20 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white font-medium">{selected.extractedTask}</p>
                  <div className="mt-1.5"><Badge label={selected.priority} type={selected.priority} /></div>
                </div>
                <ArrowRight size={16} className="text-cyan-400 shrink-0" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
