import '../../styles/variants/v2.css'
import { useEffect } from 'react'
import { startConvo } from '../convo'
import { Thread } from '../Thread'

// Version 2 starts from the conversation as it stands.
export default function V2({ active }: { active: boolean }) {
  useEffect(() => startConvo(), [])
  return (
    <div className="v2">
      <Thread active={active} />
    </div>
  )
}
