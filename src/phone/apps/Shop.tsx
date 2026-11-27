import { useEffect, useRef, useState } from 'react'
import { PointsMark } from '../../../store/src/brand'
import { addressOf, StoreFrame, type FrameHandle, type Place, type Room } from '../../apps/storefront'
import { account, askLogIn } from '../../os/account'
import { Face } from '../../os/Face'
import { useStore } from '../../os/store'
import { LOGIN, LogInSheet } from '../LogIn'
import { launch } from '../system'
import { BackButton, GlassButton, NavStack, Screen, SheetHost, useApp } from '../ui'
import '../../styles/phone/shop.css'

// ArtStore and My VIP, on the phone (Dom, 27 Nov: the stores were links that opened in a tab of their own).
//
// Each is an app here as it is a window on the desk, and is the same thing inside: the store's own pages for
// its room (store/, at /vip/store/?k=art, yours) in a frame, so that buying is the same everywhere and
// nothing about it is written twice. The pages lay themselves out for a phone when they are as narrow as
// one, and in a frame they draw no bar of their own: the app's bar is the phone's, with the way back to the
// room's front, and at its end the balance (which opens My VIP) or, for nobody, Log In. (Workspace and Books
// are apps of their own, Workspace.tsx and Books.tsx, and come here only to buy: the same frame, on the
// page of the chair or the book.)
//
// Log In is the phone's own sheet (src/phone/LogIn.tsx), up over whichever of these asked for it: the bar's
// button, or anything in the pages that needs someone logged in. My VIP's bar has the account itself there:
// their picture, which brings the same sheet up with their name, their points and Log Out.

/** The end of a store's bar: their balance (which opens My VIP), or for nobody, Log In. */
export function Wallet() {
  const who = useStore(account, (s) => s.status)
  const points = useStore(account, (s) => (s.status === 'member' ? s.points : null))
  if (points !== null)
    return (
      <GlassButton label={`Your balance: ${points.toLocaleString('en-US')} points. My VIP`} wide onClick={() => launch('myvip')}>
        <span className="shop-ios__points">
          <PointsMark size={15} />
          {points.toLocaleString('en-US')}
        </span>
      </GlassButton>
    )
  if (who !== 'anon') return null
  return (
    <GlassButton label="Log In" wide onClick={() => askLogIn()}>
      <span className="shop-ios__login">Log In</span>
    </GlassButton>
  )
}

/** My VIP's: their own picture, which brings the account up (their name, their points, Log Out); for nobody, Log In. */
function Me() {
  const who = useStore(account, (s) => s.status)
  const picture = useStore(account, (s) => (s.status === 'member' ? s.picture : null))
  const name = useStore(account, (s) => (s.status === 'member' ? s.name : ''))
  if (who !== 'member') return <Wallet />
  return (
    <GlassButton label="Your account" onClick={() => askLogIn()} className="shop-ios__me">
      <Face picture={picture} name={name} size={30} />
    </GlassButton>
  )
}

function Shop({ room, title }: { room: Room; title: string }) {
  const frame = useRef<FrameHandle>(null)
  const [at, setAt] = useState<Place>({ section: room === 'yours' ? 'yours' : 'store', product: null })
  const [page, setPage] = useState<'card' | 'store'>('store')
  const deep = page === 'card' || !!at.product
  const { active } = useApp()
  // My VIP, as the desk's window has it (src/apps/MyVip.tsx): a card has a name on it, so someone logged in
  // who has not yet said what they are called is asked as it opens; and someone who logs out while their
  // card's page is showing is taken off it, back to My VIP's own page (which asks a visitor to log in)
  const nameless = useStore(account, (s) => s.status === 'member' && !s.name.trim())
  const member = useStore(account, (s) => s.status === 'member')
  useEffect(() => {
    if (room === 'yours' && active && nameless) askLogIn('name')
  }, [room, active, nameless])
  useEffect(() => {
    if (room === 'yours' && !member && page === 'card') frame.current?.to(addressOf(room))
  }, [room, member, page])
  return (
    <Screen
      title={title}
      tone="dark"
      fixed
      className="shop-ios"
      // Back is to the room's front: from a product, or from the card's page (their card, pressed in My VIP)
      leading={deep ? <BackButton label={title} onClick={() => (page === 'card' ? frame.current?.to(addressOf(room)) : frame.current?.go(null))} /> : null}
      trailing={page === 'card' ? undefined : room === 'yours' ? <Me /> : <Wallet />}
    >
      <StoreFrame ref={frame} room={room} title={title} onAt={setAt} onPage={setPage} />
    </Screen>
  )
}

/** A room of the store as an app of the phone's. */
export const shopApp = (room: Room, title: string) =>
  function ShopApp() {
    return (
      <>
        <NavStack>{() => <Shop room={room} title={title} />}</NavStack>
        <SheetHost>{(name) => (name === LOGIN ? <LogInSheet /> : null)}</SheetHost>
      </>
    )
  }
