import logoUrl from '@resources/Flux Pomo logo.webp?url'

interface AppLogoProps {
  className?: string
  size?: number
  width?: number
  alt?: string
}

function AppLogo({
  className = 'app-logo',
  size = 24,
  width,
  alt = 'Flux Pomo'
}: AppLogoProps): React.JSX.Element {
  return (
    <img
      src={logoUrl}
      alt={alt}
      className={className}
      height={size}
      {...(width != null ? { width } : {})}
      draggable={false}
    />
  )
}

export default AppLogo
