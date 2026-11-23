import { useEffect, useState } from 'react'
import { BUILT_IN } from './content'

/** The year, for a copyright line. The page as written says the year it was built in; once it is running it
 * looks at the clock, so that a build left standing over a new year still says the right one. */
export function useYear() {
  const [year, setYear] = useState(BUILT_IN)
  useEffect(() => setYear(new Date().getFullYear()), [])
  return year
}
