import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Moon, Mail, Shield, Sparkles } from 'lucide-react'
import GlassCard from '../../components/ui/GlassCard'

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-white/10'}`}>
      <motion.div animate={{ x: checked ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white" />
    </button>
  )
}

const initialSettings = [
  { id: 'notifs', icon: Bell, label: 'Push notifications', desc: 'Get notified about urgent tasks', value: true },
  { id: 'ai', icon: Sparkles, label: 'AI auto-extraction', desc: 'Automatically extract tasks from emails & meetings', value: true },
  { id: 'digest', icon: Mail, label: 'Daily email digest', desc: 'Summary of your day each morning', value: false },
  { id: 'dark', icon: Moon, label: 'Dark mode', desc: 'Always-on space theme', value: true },
  { id: 'privacy', icon: Shield, label: 'Private mode', desc: 'Hide task details from notifications', value: false },
]

export default function Settings() {
  const [settings, setSettings] = useState(initialSettings)

  const update = (id, value) => setSettings(prev => prev.map(s => s.id === id ? { ...s, value } : s))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-white">Settings</h1>

      <GlassCard hover={false} className="!p-2">
        {settings.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-4 p-4 ${i !== settings.length - 1 ? 'border-b border-white/5' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <s.icon size={15} className="text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">{s.label}</p>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
            <Toggle checked={s.value} onChange={(v) => update(s.id, v)} />
          </motion.div>
        ))}
      </GlassCard>

      <GlassCard hover={false} className="!p-5">
        <p className="text-sm font-medium text-red-400 mb-1">Danger zone</p>
        <p className="text-xs text-slate-500 mb-3">Permanently delete your account and all associated data.</p>
        <button className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
          Delete account
        </button>
      </GlassCard>
    </div>
  )
}
