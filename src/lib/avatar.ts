function stringToHue(input: string) {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = input.charCodeAt(index) + ((hash << 5) - hash)
  }

  return Math.abs(hash) % 360
}

export function getAvatarFallback(name: string) {
  const trimmed = name.trim()
  if (!trimmed) {
    return "U"
  }

  const segments = trimmed.split(/\s+/).filter(Boolean)
  if (segments.length >= 2) {
    return `${segments[0][0] ?? ""}${segments[1][0] ?? ""}`.toUpperCase()
  }

  return trimmed.slice(0, 2).toUpperCase()
}

export function getAvatarColor(name: string) {
  const hue = stringToHue(name)
  return {
    background: `hsl(${hue} 72% 92%)`,
    foreground: `hsl(${hue} 48% 28%)`,
  }
}

export function getAvatarUrl(avatarPath: string | null | undefined, name: string) {
  if (avatarPath && avatarPath.trim()) {
    return avatarPath
  }

  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundType=gradientLinear`
}
