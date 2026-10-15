import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Tabs.module.css'

interface TabItem<T extends string> {
  id: T
  label: string
}

interface TabsProps<T extends string> {
  idPrefix: string
  label: string
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Tabs<T extends string>({ idPrefix, label, items, value, onChange, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = items.findIndex((item) => item.id === value)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = items[(index + step + items.length) % items.length]
    onChange(next.id)
    listRef.current?.querySelector<HTMLButtonElement>(`#${idPrefix}-tab-${next.id}`)?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={[styles.tabs, className].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            id={`${idPrefix}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  idPrefix: string
  value: string
  className?: string
  children: ReactNode
}

export function TabPanel({ idPrefix, value, className, children }: TabPanelProps) {
  return (
    <div
      id={`${idPrefix}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}-tab-${value}`}
      className={className}
    >
      {children}
    </div>
  )
}
