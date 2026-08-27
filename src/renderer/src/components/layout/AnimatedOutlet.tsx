import { useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

type PageMotion = 'fade' | 'left' | 'right'

const ROUTE_ORDER = ['/', '/history', '/settings'] as const

function routeIndex(pathname: string): number {
  const normalized = pathname === '' ? '/' : pathname
  const index = ROUTE_ORDER.indexOf(normalized as (typeof ROUTE_ORDER)[number])
  return index >= 0 ? index : 0
}

function AnimatedOutlet(): React.JSX.Element {
  const location = useLocation()
  const previousIndex = useRef(routeIndex(location.pathname))
  const [motion, setMotion] = useState<PageMotion>('fade')

  useLayoutEffect(() => {
    const nextIndex = routeIndex(location.pathname)
    const prev = previousIndex.current

    if (nextIndex > prev) setMotion('left')
    else if (nextIndex < prev) setMotion('right')
    else setMotion('fade')

    previousIndex.current = nextIndex
  }, [location.pathname])

  return (
    <div
      key={location.pathname}
      className={`page-transition page-transition-${motion}`}
    >
      <Outlet />
    </div>
  )
}

export default AnimatedOutlet
