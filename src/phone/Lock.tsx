import { chat } from '../apps/chat'
import { PEOPLE } from '../data/people'
import { LockScreen, Notification } from '../kit/phone'
import { AppIcon } from '../os/icons'
import { useStore } from '../os/store'
import { latestReplies } from './apps'
import { openPhoneApp } from './nav'

// The phone's screen saver is its lock screen: the date and the time over the
// wallpaper, and the newest replies stacked at the bottom as notifications.
// Any touch opens it; touching a notification opens that conversation.

const DATE = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

const ago = (at: number, now: number) => {
  const minutes = Math.floor((now - at) / 60000)
  return minutes < 1 ? 'now' : `${minutes}m ago`
}

export function PhoneLock({ on, now }: { on: boolean; now: Date }) {
  const replied = useStore(chat, (s) => s.replied)
  const repliedAt = useStore(chat, (s) => s.repliedAt)
  return (
    <div className="ph-lock" data-on={on || undefined} aria-hidden={!on} {...(on ? null : ({ inert: '' } as object))}>
      <LockScreen date={DATE.format(now)} time={TIME.format(now).replace(/\s?[AP]M$/i, '')} controls={false}>
        {latestReplies(replied, 3).map((i) => (
          <Notification
            key={i}
            icon={<AppIcon id="messages" />}
            title={PEOPLE[i]!.name}
            body={PEOPLE[i]!.quote ?? PEOPLE[i]!.role}
            time={ago(repliedAt[i]!, now.getTime())}
            // On the press, not the click: the same press wakes the phone, and
            // by the click the lock screen has already let go of it
            onPointerDown={() => openPhoneApp('messages', ['list', `thread:${i}`])}
          />
        ))}
      </LockScreen>
      <div className="ph-lock__hint">Tap to open</div>
    </div>
  )
}
