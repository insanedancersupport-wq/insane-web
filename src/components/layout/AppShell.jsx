import {
  Bell,
  BarChart3,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Trophy,
  Users,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { Button } from '../ui/Button'
import { useAuth } from '../../features/auth/AuthContext'

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/app/dashboard' },
  { icon: CalendarDays, label: 'Calendar', to: '/app/calendar' },
  { icon: Users, label: 'Groups', to: '/app/groups' },
  { icon: UserRound, label: 'Students', to: '/app/students' },
  { icon: Trophy, label: 'Competitions', to: '/app/competitions' },
  { icon: BarChart3, label: 'Reports', to: '/app/reports' },
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
          end={to === '/app/dashboard'}
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

function roleLabel(role) {
  return role === 'admin' ? 'Admin' : 'Trainer'
}

function UserMenu() {
  const { profile, session, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)
  const email = session?.user?.email ?? ''
  const displayName = profile?.full_name || email || 'Account'

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function closeOnOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  async function handleSignOut() {
    setError('')
    setIsSigningOut(true)

    try {
      await signOut()
      setIsOpen(false)
      navigate('/login', { replace: true })
    } catch (signOutError) {
      setError(signOutError.message)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        aria-controls="user-menu-popover"
        aria-expanded={isOpen}
        aria-label="Open user menu"
        className="icon-button user-menu__trigger"
        onClick={() => setIsOpen((open) => !open)}
        ref={buttonRef}
        type="button"
      >
        <UserRound aria-hidden="true" size={22} />
      </button>
      {isOpen && (
        <section className="user-menu__popover" id="user-menu-popover">
          <p className="user-menu__name">{displayName}</p>
          <p className="user-menu__role">{roleLabel(profile?.role)}</p>
          {email && <p className="user-menu__email">{email}</p>}
          <div className="user-menu__separator" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button disabled={isSigningOut} onClick={() => void handleSignOut()} variant="tertiary">
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </section>
      )}
    </div>
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
          <UserMenu />
          <h1>{title}</h1>
        </header>

        <main className="app-shell__main">{children}</main>
        <Navigation variant="bottom" />
      </div>
    </div>
  )
}
