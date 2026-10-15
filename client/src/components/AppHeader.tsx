import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useAuth, useCurrentUser } from '../auth/AuthProvider'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'
import { Logo } from './Logo'
import { Menu, MenuItem, MenuSection } from './Menu'
import styles from './AppHeader.module.css'

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function AppHeader() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const CurrentThemeIcon = THEME_OPTIONS.find((option) => option.value === theme)?.icon ?? Monitor

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo />
        <div className={styles.actions}>
          <span className={styles.business}>{user.business.name}</span>
          <Menu
            label="Theme"
            triggerClassName={styles.iconButton}
            trigger={<CurrentThemeIcon size={18} aria-hidden />}
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <MenuItem
                key={value}
                checked={theme === value}
                icon={<Icon size={16} aria-hidden />}
                onSelect={() => setTheme(value)}
              >
                {label}
              </MenuItem>
            ))}
          </Menu>
          <Menu
            label="Account"
            triggerClassName={styles.avatar}
            trigger={<span aria-hidden>{initials(user.fullName)}</span>}
          >
            <MenuSection>
              <div className={styles.userName}>{user.fullName}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </MenuSection>
            <MenuItem icon={<LogOut size={16} aria-hidden />} onSelect={() => void logout()}>
              Log out
            </MenuItem>
          </Menu>
        </div>
      </div>
    </header>
  )
}
