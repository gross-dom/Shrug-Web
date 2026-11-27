import { PointsMark } from '../../../store/src/brand'
import { account, askLogIn } from '../../os/account'
import { Face } from '../../os/Face'
import { useStore } from '../../os/store'
import { openSheet } from '../system'
import { GlassButton } from '../ui'

// The end of a store's bar: whose it is. Someone logged in has their balance there, and pressed it brings
// My VIP up over where they are (MyVip.tsx: a sheet, put away with a pull, so that looking at their points
// or their orders never takes them off the thing they were about to buy). Nobody has Log In there.

/** The name My VIP's sheet goes by in an app's sheets. */
export const VIP = 'vip'

export function Wallet() {
  const who = useStore(account, (s) => s.status)
  const points = useStore(account, (s) => (s.status === 'member' ? s.points : null))
  if (points !== null)
    return (
      <GlassButton label={`Your balance: ${points.toLocaleString('en-US')} points. My VIP`} wide onClick={() => openSheet(VIP)}>
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

/** My VIP's own: their picture, which brings the account up (their name and picture to change, Log Out); for nobody, Log In. */
export function Me() {
  const who = useStore(account, (s) => s.status)
  const picture = useStore(account, (s) => (s.status === 'member' ? s.picture : null))
  const name = useStore(account, (s) => (s.status === 'member' ? s.name : ''))
  if (who === 'checking') return null
  if (who !== 'member')
    return (
      <GlassButton label="Log In" wide onClick={() => askLogIn()}>
        <span className="shop-ios__login">Log In</span>
      </GlassButton>
    )
  return (
    <GlassButton label="Your account" onClick={() => askLogIn()} className="shop-ios__me">
      <Face picture={picture} name={name} size={30} />
    </GlassButton>
  )
}
