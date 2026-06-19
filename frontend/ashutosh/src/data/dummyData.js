export const user = {
  name: 'Arjun',
  email: 'arjun@taskpilot.ai',
  role: 'Product Lead',
  streak: 12,
  avatar: 'A',
}

export const tasks = [
  { id: 't1', title: 'Finalize Q3 investor deck', category: 'Strategy', priority: 'P1', status: 'in_progress', deadline: 'Today, 5:00 PM', effort: 3, impact: 'CRITICAL', blocked: false, deps: [] },
  { id: 't2', title: 'Fix checkout payment bug', category: 'Engineering', priority: 'P1', status: 'todo', deadline: 'Today, 6:00 PM', effort: 2, impact: 'CRITICAL', blocked: false, deps: [] },
  { id: 't3', title: 'Respond to Series B counsel', category: 'Legal', priority: 'P1', status: 'todo', deadline: 'Tomorrow, 10:00 AM', effort: 1, impact: 'HIGH', blocked: true, deps: ['t1'] },
  { id: 't4', title: 'Review design system v2', category: 'Design', priority: 'P2', status: 'todo', deadline: 'Fri, 2:00 PM', effort: 2, impact: 'MEDIUM', blocked: false, deps: [] },
  { id: 't5', title: 'Onboard new backend hire', category: 'People', priority: 'P2', status: 'in_progress', deadline: 'Fri, 4:00 PM', effort: 1.5, impact: 'MEDIUM', blocked: false, deps: [] },
  { id: 't6', title: 'Prepare sprint retro notes', category: 'Engineering', priority: 'P2', status: 'todo', deadline: 'Mon, 9:00 AM', effort: 1, impact: 'LOW', blocked: false, deps: [] },
  { id: 't7', title: 'Audit Q2 ad spend', category: 'Marketing', priority: 'P2', status: 'completed', deadline: 'Yesterday', effort: 2, impact: 'MEDIUM', blocked: false, deps: [] },
  { id: 't8', title: 'Update API rate-limit docs', category: 'Engineering', priority: 'P3', status: 'todo', deadline: 'Next week', effort: 1, impact: 'LOW', blocked: false, deps: [] },
  { id: 't9', title: 'Schedule customer interviews', category: 'Research', priority: 'P3', status: 'todo', deadline: 'Next week', effort: 1, impact: 'LOW', blocked: false, deps: [] },
  { id: 't10', title: 'Clean up Notion workspace', category: 'Ops', priority: 'P3', status: 'completed', deadline: 'Done', effort: 0.5, impact: 'LOW', blocked: false, deps: [] },
  { id: 't11', title: 'Renew domain & SSL certs', category: 'Ops', priority: 'P3', status: 'todo', deadline: 'In 2 weeks', effort: 0.5, impact: 'LOW', blocked: false, deps: [] },
  { id: 't12', title: 'Draft August newsletter', category: 'Marketing', priority: 'P3', status: 'in_progress', deadline: 'In 5 days', effort: 1, impact: 'LOW', blocked: false, deps: [] },
]

export const weeklyStats = {
  tasksCompleted: 34,
  emailsAnalyzed: 218,
  hiddenTasks: 7,
  productivityScore: 82,
  focusHours: 26,
  contextSwitches: 14,
}

export const chartData = {
  weekly: [
    { day: 'Mon', completed: 5, added: 7 },
    { day: 'Tue', completed: 8, added: 5 },
    { day: 'Wed', completed: 4, added: 9 },
    { day: 'Thu', completed: 9, added: 4 },
    { day: 'Fri', completed: 6, added: 6 },
    { day: 'Sat', completed: 2, added: 2 },
    { day: 'Sun', completed: 3, added: 1 },
  ],
  radarData: [
    { metric: 'Focus', value: 78 },
    { metric: 'Speed', value: 65 },
    { metric: 'Quality', value: 88 },
    { metric: 'Collab', value: 72 },
    { metric: 'Planning', value: 80 },
  ],
  categoryBreakdown: [
    { name: 'Engineering', value: 4, color: '#3B82F6' },
    { name: 'Strategy', value: 1, color: '#8B5CF6' },
    { name: 'Marketing', value: 2, color: '#06B6D4' },
    { name: 'Design', value: 1, color: '#F59E0B' },
    { name: 'Ops', value: 2, color: '#10B981' },
    { name: 'Legal', value: 1, color: '#EF4444' },
  ],
}

export const emails = [
  { id: 'e1', from: 'Priya Sharma', subject: 'Re: Series B term sheet — need your sign-off', preview: 'Can you review the redlines before EOD? Counsel flagged...', time: '9:42 AM', extractedTask: 'Respond to Series B counsel', priority: 'P1', read: false },
  { id: 'e2', from: 'Stripe Support', subject: 'Webhook failures detected on your account', preview: 'We noticed a spike in failed payment webhooks since...', time: '8:15 AM', extractedTask: 'Fix checkout payment bug', priority: 'P1', read: false },
  { id: 'e3', from: 'Dev Patel', subject: 'Design system v2 — ready for review', preview: 'Pushed the new tokens and components, would love your...', time: 'Yesterday', extractedTask: 'Review design system v2', priority: 'P2', read: true },
  { id: 'e4', from: 'Maya Chen', subject: 'Welcome aboard! Onboarding checklist', preview: 'Excited to start Monday — sending over my equipment...', time: 'Yesterday', extractedTask: 'Onboard new backend hire', priority: 'P2', read: true },
  { id: 'e5', from: 'Notion', subject: 'Your workspace storage is 90% full', preview: 'Consider archiving old pages or upgrading your plan...', time: '2 days ago', extractedTask: 'Clean up Notion workspace', priority: 'P3', read: true },
]

export const meetings = [
  { id: 'm1', title: 'Investor Sync — Series B', date: 'Today, 2:00 PM', attendees: ['Priya', 'Arjun', 'Counsel'], summary: 'Discussed term sheet redlines and valuation cap. Action items assigned around legal review.', tasksExtracted: 2 },
  { id: 'm2', title: 'Eng Standup', date: 'Today, 10:00 AM', attendees: ['Dev', 'Maya', 'Arjun'], summary: 'Payment webhook bug triaged as P1. Sprint velocity reviewed, retro scheduled.', tasksExtracted: 2 },
  { id: 'm3', title: 'Design Review', date: 'Yesterday, 3:00 PM', attendees: ['Dev', 'Arjun'], summary: 'Walked through design system v2 tokens. Minor spacing issues flagged for fix.', tasksExtracted: 1 },
  { id: 'm4', title: 'Marketing Planning', date: '2 days ago', attendees: ['Sam', 'Arjun'], summary: 'Q2 ad spend audit results reviewed. August newsletter topics brainstormed.', tasksExtracted: 2 },
]

export const notifications = [
  { id: 'n1', type: 'urgent', title: 'P1 task deadline in 1 hour', desc: 'Finalize Q3 investor deck is due at 5:00 PM', time: '10m ago' },
  { id: 'n2', type: 'ai', title: 'AI found a hidden task', desc: 'Extracted "Fix checkout payment bug" from Stripe email', time: '1h ago' },
  { id: 'n3', type: 'info', title: 'Weekly report ready', desc: 'Your productivity report for this week is available', time: '3h ago' },
  { id: 'n4', type: 'success', title: 'Task completed', desc: 'Audit Q2 ad spend marked as done', time: 'Yesterday' },
  { id: 'n5', type: 'warning', title: 'Task blocked', desc: 'Respond to Series B counsel is waiting on another task', time: 'Yesterday' },
]

export const assistantMessages = [
  { id: 'a1', role: 'assistant', content: "Good morning, Arjun. I've scanned your inbox and calendar — you have 3 P1 tasks today and one new blocker on the Series B response. Want me to suggest a focus order?" },
  { id: 'a2', role: 'user', content: 'Yes, what should I tackle first?' },
  { id: 'a3', role: 'assistant', content: "Start with the investor deck — it unblocks the counsel response and has the nearest deadline (5 PM). Then the checkout bug, since it's customer-facing. I've blocked 2 hours on your calendar for deep focus." },
]
