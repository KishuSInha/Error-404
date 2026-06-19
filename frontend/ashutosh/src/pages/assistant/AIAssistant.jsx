import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Bot, Sparkles } from 'lucide-react'
import { assistantMessages as initialMessages } from '../../data/dummyData'

const suggestions = [
  'What should I focus on today?',
  'Summarize my unread emails',
  'What tasks are blocked?',
  'Plan my week',
]

const canned = "I've reviewed your current workload. Based on deadlines and impact, I'd recommend tackling your P1 tasks first, especially anything blocking other work. Want me to reorder your focus list?"

export default function AIAssistant() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const send = (text) => {
    if (!text.trim()) return
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: canned }])
      setTyping(false)
    }, 1200)
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Bot size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-white">AI Assistant</h1>
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online and watching your workload
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
        {messages.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'glass text-slate-200 rounded-bl-md'
            }`}>
              {m.content}
            </div>
          </motion.div>
        ))}
        {typing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="glass px-4 py-3 rounded-2xl rounded-bl-md flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400"
                  animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      <div className="pt-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          {suggestions.map(s => (
            <button key={s} onClick={() => send(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <Sparkles size={10} className="text-cyan-400" /> {s}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask your AI assistant anything..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit"
            className="w-12 h-12 shrink-0 rounded-2xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white">
            <Send size={16} />
          </motion.button>
        </form>
      </div>
    </div>
  )
}
