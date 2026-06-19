import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter } from 'lucide-react'
import { tasks } from '../../data/dummyData'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

const priorityColor = { P1: '#EF4444', P2: '#F59E0B', P3: '#3B82F6' }

export default function TaskUniverse() {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = tasks.filter(t => {
    const matchFilter = filter === 'all' || t.priority === filter || t.status === filter
    const matchQuery = t.title.toLowerCase().includes(query.toLowerCase())
    return matchFilter && matchQuery
  })

  const sizeFor = (t) => t.priority === 'P1' ? 90 : t.priority === 'P2' ? 70 : 54

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Task Universe</h1>
          <p className="text-slate-500 text-sm mt-1">Every task, sized by priority — click a star to inspect</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks..."
            className="bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 w-64" />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-slate-500" />
        {['all', 'P1', 'P2', 'P3', 'todo', 'in_progress', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filter === f ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-slate-500 border border-white/10 hover:text-slate-300'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="glass p-8 min-h-[420px] flex flex-wrap items-center justify-center gap-6">
        <AnimatePresence>
          {filtered.map((task, i) => {
            const size = sizeFor(task)
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ delay: i * 0.03, type: 'spring' }}
                whileHover={{ scale: 1.1 }}
                onClick={() => setSelected(task)}
                className="relative cursor-pointer flex items-center justify-center rounded-full"
                style={{
                  width: size, height: size,
                  background: `radial-gradient(circle at 35% 30%, ${priorityColor[task.priority]}55, ${priorityColor[task.priority]}15)`,
                  border: `1.5px solid ${priorityColor[task.priority]}66`,
                }}
              >
                {task.priority === 'P1' && (
                  <motion.div className="absolute inset-0 rounded-full" style={{ border: `1px solid ${priorityColor[task.priority]}` }}
                    animate={{ scale: [1, 1.3], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity }} />
                )}
                <span className="text-[10px] text-center text-white/90 font-medium px-2 leading-tight">
                  {task.title.split(' ').slice(0, 2).join(' ')}
                </span>
                {task.status === 'completed' && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[9px] text-white">✓</div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
        {filtered.length === 0 && <p className="text-slate-600 text-sm">No tasks match your search.</p>}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title || ''}>
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Badge label={selected.priority} type={selected.priority} />
              <Badge label={selected.status.replace('_', ' ')} type={selected.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div><p className="text-slate-500 text-xs">Category</p><p className="text-white">{selected.category}</p></div>
              <div><p className="text-slate-500 text-xs">Deadline</p><p className="text-white">{selected.deadline}</p></div>
              <div><p className="text-slate-500 text-xs">Effort</p><p className="text-white">{selected.effort}h</p></div>
              <div><p className="text-slate-500 text-xs">Impact</p><p className="text-white">{selected.impact}</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
