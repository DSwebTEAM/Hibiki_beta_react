import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  { to: '/home',     label: 'Characters', icon: HomeIcon },
  { to: '/chats',    label: 'Chats',      icon: ChatsIcon },
  { to: '/studio',   label: 'Studio',     icon: StudioIcon },
  { to: '/settings', label: 'Settings',   icon: SettingsIcon },
  { to: '/status',   label: 'Status',     icon: StatusIcon },
]

// Mobile bottom nav — always shown on mobile
export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

// Desktop collapsible sidebar
// - On /home: always expanded (full width, logo + labels)
// - On other pages: collapsed to icon-only (48px), expands on hover or click
export function DesktopNav() {
  const location = useLocation()
  const isHome = location.pathname === '/home'
  const [pinned, setPinned] = useState(false) // user clicked to keep open
  const [hovered, setHovered] = useState(false)

  const expanded = isHome || pinned || hovered

  return (
    <div
      className="desktop-sidebar"
      style={{ width: expanded ? 200 : 52 }}
      onMouseEnter={() => !isHome && setHovered(true)}
      onMouseLeave={() => !isHome && setHovered(false)}
    >
      {/* Logo */}
      <div className="desktop-sidebar-logo">
        <span className="desktop-nav-kanji">響</span>
        {expanded && (
          <span className="desktop-nav-title" style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
            Hibiki
          </span>
        )}
        {/* Pin button — only shown when not on home and expanded */}
        {!isHome && expanded && (
          <button
            onClick={() => setPinned(p => !p)}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            style={{ marginLeft: 'auto', color: pinned ? 'var(--deep-rose)' : 'var(--muted)', padding: '2px 4px', borderRadius: '6px', fontSize: '0.7rem', lineHeight: 1, flexShrink: 0 }}
          >
            {pinned ? '◀' : '▶'}
          </button>
        )}
      </div>

      {/* Nav items */}
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `desktop-nav-item${isActive ? ' active' : ''}`}
          title={!expanded ? label : undefined}
        >
          <Icon size={16} />
          {expanded && <span style={{ opacity: 1, transition: 'opacity 0.1s', whiteSpace: 'nowrap' }}>{label}</span>}
        </NavLink>
      ))}
    </div>
  )
}

function HomeIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function ChatsIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function StudioIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
}
function SettingsIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function StatusIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
