import { useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { Tabs } from '../components/Tabs'
import { AppointmentsPanel } from '../features/appointments/AppointmentsPanel'
import { ChatPanel } from '../features/chat/ChatPanel'
import styles from './WorkspacePage.module.css'

type View = 'chat' | 'appointments'

const VIEWS: { id: View; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'appointments', label: 'Appointments' },
]

export function WorkspacePage() {
  const [view, setView] = useState<View>('chat')

  return (
    <div className={styles.shell}>
      <AppHeader />
      <main className={styles.workspace} data-view={view}>
        <Tabs
          idPrefix="workspace"
          label="Workspace"
          items={VIEWS}
          value={view}
          onChange={setView}
          className={styles.viewTabs}
        />
        <div id="workspace-panel-chat" className={styles.chat}>
          <ChatPanel />
        </div>
        <div id="workspace-panel-appointments" className={styles.appointments}>
          <AppointmentsPanel />
        </div>
      </main>
    </div>
  )
}
