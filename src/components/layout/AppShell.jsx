import {
  Bell,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Users,
  UserRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'

const navigationItems = [
  { icon: LayoutDashboard, label: 'Home', to: '/app' },
  { icon: CalendarDays, label: 'Calendar', to: '/app/calendar' },
  { icon: Users, label: 'Groups', to: '/app/groups' },
  { icon: UserRound, label: 'Students', to: '/app/students' },
  { icon: MoreHorizontal, label: 'More', to: '/app/more' },
]

const administrationItems = [
  { icon: UserRound, label: 'Trainers', to: '/app/trainers' },
  { icon: LayoutDashboard, label: 'Rooms', to: '/app/rooms' },
  { icon: Users, label: 'Users', to: '/app/users' },
]

function Brand() {
  return (
    <div aria-label="Insane Dance Center" className="brand">
      <span className="brand__mark" aria-hidden="true">I</span>
      <span className="brand__name">
        INSANE
        <small>DANCE CENTER</small>
      </span>
    </div>
  )
}

function Navigation({ variant }) {
  const { profile } = useAuth()
  const items = variant === 'sidebar' && profile?.role === 'admin'
    ? [...navigationItems, ...administrationItems]
    : navigationItems

  return (
    <nav aria-label="Primary navigation" className={`navigation navigation--${variant}`}>
      {items.map(({ icon: Icon, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            `navigation__link${isActive ? ' navigation__link--active' : ''}`
          }
          end={to === '/app'}
          key={to}
          to={to}
        >
          <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
          <span>{label}</span>
          {variant === 'sidebar' && <ChevronRight aria-hidden="true" size={18} />}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell({ children, title = 'Home' }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <Navigation variant="sidebar" />
        <p className="sidebar__footer">Insane Dance Center</p>
      </aside>

      <div className="app-shell__content">
        <header className="top-header">
          <button aria-label="Open navigation" className="icon-button top-header__menu" type="button">
            <Menu aria-hidden="true" size={24} />
          </button>
          <Brand />
          <button aria-label="Notifications" className="icon-button notification-button" type="button">
            <Bell aria-hidden="true" size={23} />
            <span aria-label="3 unread notifications" className="notification-button__badge">3</span>
          </button>
          <h1>{title}</h1>
        </header>

        <main className="app-shell__main">{children}</main>
        <Navigation variant="bottom" />
      </div>
    </div>
  )
}
