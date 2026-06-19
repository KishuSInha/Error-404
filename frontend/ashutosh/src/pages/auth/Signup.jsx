import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { setIsAuthenticated } = useApp()
  const navigate = useNavigate()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setIsAuthenticated(true)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl animate-pulse-slow" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mb-4">
              <Zap size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold gradient-text">TaskPilot AI</h1>
          </div>

          <h2 className="text-lg font-semibold text-white mb-1">Create account</h2>
          <p className="text-sm text-slate-500 mb-6">Join the next generation of task intelligence</p>

          <form onSubmit={handleSignup} className="space-y-4">
            {[
              { icon: User, placeholder: 'Full name', key: 'name', type: 'text' },
              { icon: Mail, placeholder: 'Email', key: 'email', type: 'email' },
              { icon: Lock, placeholder: 'Password', key: 'password', type: 'password' },
            ].map(({ icon: Icon, placeholder, key, type }) => (
              <div key={key} className="relative">
                <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/60 focus:bg-white/8 transition-all"
                  required
                />
              </div>
            ))}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <><span>Initialize AI System</span><ArrowRight size={14} /></>
              )}
            </motion.button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-sm text-slate-500">Already have an account? </span>
            <Link to="/login" className="text-sm text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
