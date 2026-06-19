import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function MainLayout({ children }) {
  const { sidebarCollapsed } = useApp()
  const marginLeft = sidebarCollapsed ? 72 : 240

  return (
    <div className="min-h-screen bg-space-900">
      <Sidebar />
      <Navbar />
      <motion.main
        animate={{ marginLeft }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="pt-16 min-h-screen"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6"
        >
          {children}
        </motion.div>
      </motion.main>
    </div>
  )
}
