import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'

function Particle({ style }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-blue-400/40"
      style={style}
      animate={{ y: [0, -80, 0], opacity: [0, 0.8, 0], scale: [0, 1, 0] }}
      transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 4 }}
    />
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setIsAuthenticated } = useApp()
  const navigate = useNavigate()
  const particles = Array.from({ length: 30 }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
  }))

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setIsAuthenticated(true)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-600/8 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {particles.map((p, i) => <Particle key={i} style={p} />)}

      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass p-8">
          <div className="flex flex-col items-center mb-8">
            <motion.div
              animate={{ boxShadow: ['0 0 20px rgba(59,130,246,0.3)', '0 0 40px rgba(59,130,246,0.6)', '0 0 20px rgba(59,130,246,0.3)'] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4"
            >
              <Zap size={24} className="text-white" />
            </motion.div>
            <h1 className="text-2xl font-display font-bold gradient-text">TaskPilot AI</h1>
            <p className="text-slate-500 text-sm mt-1">Agentic Task Intelligence</p>
          </div>

          <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to your command center</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                required
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="flex justify-end">
              <span className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                Forgot password?
              </span>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-70 shadow-glow-blue"
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <><span>Launch Mission Control</span><ArrowRight size={14} /></>
              )}
            </motion.button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-sm text-slate-500">No account? </span>
            <Link to="/signup" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Create one
            </Link>
          </div>

          <div className="mt-4 p-3 rounded-2xl bg-blue-500/8 border border-blue-500/15">
            <p className="text-xs text-blue-400 text-center">Demo: any email + password to sign in</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
