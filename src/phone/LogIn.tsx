import { useEffect, useRef } from 'react'
import { Sheet as Steps } from '../os/Account'
import { account, askLogIn, closeLogIn, logIn, refreshAccount, demoLink, type Why } from '../os/account'
import { asked } from '../os/address'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { closeSheet, launchAt, openSheet, sys } from './system'
import { chrome } from './chrome'
import { Sheet, useApp } from './ui'
import '../styles/phone/login.css'

// Logging in, on a phone. The desk has one sheet for it, let down from its menu bar (os/Account.tsx); a phone
// has no menu bar, and brings the same steps up as a sheet over whichever app asked: an email, six digits, a
// name the first time, and for someone logged in their points and Log Out. Anything that asks the desk for
// Log In (`askLogIn`: a store's pages, a locked folder) gets this one here.
//
// An app that can ask puts the sheet in its `SheetHost` under this name.

export const LOGIN = 'login'

/** The sheet itself: draw it from the app's `SheetHost` for the name `LOGIN`. */
export function LogInSheet() {
  const who = useStore(account, (s) => s)
  const why = useStore(logIn, (s) => s.why)
  const says = useStore(logIn, (s) => s.says)
  const hold = useRef(false)
  const member = who.status === 'member' ? who : null
  // It is as dark or as light as the app it is over: black over a store, pale over the folder of updates
  const { app } = useApp()
  const dark = useStore(chrome, (c) => c[app] === 'dark')
  return (
    <Sheet label={member ? 'Your account' : 'Log in'} title={member ? 'Account' : undefined} className={`login-ios${dark ? '' : ' login-ios--light'}`}>
      {who.status !== 'checking' && (
        <div className="account account--phone">
          <Steps who={member} why={why} says={says} hold={hold} onDone={() => closeSheet()} />
        </div>
      )}
    </Sheet>
  )
}

/** Asks for Log In from a phone's app: the same as the desk's, which the phone answers with its sheet. */
export const phoneLogIn = (why: Why = null) => askLogIn(why)

/** Keeps the phone's sheet and the desk's Log In as one thing: asked for, the sheet comes up over the app in
 * front (over My VIP, from the Home Screen); put away, nothing is left asking. Also what the desk's menu bar
 * does as it arrives: asks who is logged in, and lets Log In down for someone sent here to log in (?login). */
export function useLogIn() {
  useEffect(() => {
    let up = sys.get().sheet === LOGIN
    const wanted = () => {
      if (!wm.get().compact || !logIn.get().open) return
      const s = sys.get()
      if (s.locked || s.sheet === LOGIN) return
      if (s.app) openSheet(LOGIN)
      else launchAt('myvip', [], null, LOGIN)
    }
    const shown = () => {
      const is = sys.get().sheet === LOGIN
      if (up && !is) closeLogIn()
      up = is
      // (asked for while the phone was locked: it comes up once the phone is open)
      if (!is) wanted()
    }
    const offAsked = logIn.subscribe(wanted)
    const offShown = sys.subscribe(shown)
    const arrived = asked('login')
    if (arrived === 'link') demoLink()
    void refreshAccount().then(() => {
      if (arrived === null || !wm.get().compact) return
      askLogIn()
      const url = new URL(window.location.href)
      for (const key of [...url.searchParams.keys()]) if (key.toLowerCase() === 'login') url.searchParams.delete(key)
      window.history.replaceState(window.history.state, '', url)
    })
    return () => {
      offAsked()
      offShown()
    }
  }, [])
}
