import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import styles from './Menu.module.css'

const CloseMenuContext = createContext<() => void>(() => {})

interface MenuProps {
  label: string
  trigger: ReactNode
  triggerClassName?: string
  children: ReactNode
}

export function Menu({ label, trigger, triggerClassName, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    items[(index + step + items.length) % items.length]?.focus()
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div ref={listRef} role="menu" aria-label={label} className={styles.menu} onKeyDown={handleKeyDown}>
          <CloseMenuContext.Provider value={close}>{children}</CloseMenuContext.Provider>
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  onSelect: () => void
  checked?: boolean
  icon?: ReactNode
  children: ReactNode
}

export function MenuItem({ onSelect, checked, icon, children }: MenuItemProps) {
  const closeMenu = useContext(CloseMenuContext)
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      tabIndex={-1}
      className={styles.item}
      onClick={() => {
        closeMenu()
        onSelect()
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function MenuSection({ children }: { children: ReactNode }) {
  return <div className={styles.section}>{children}</div>
}
