import { getLevelDefinitionByLevel, getLevelDefinitions } from "@/lib/level-system"

export interface LevelBadgeData {
  level: number
  name: string
  color: string
  icon: string
}

export async function getLevelBadgeData(level: number): Promise<LevelBadgeData> {
  const definition = await getLevelDefinitionByLevel(level)

  if (definition) {
    return {
      level: definition.level,
      name: definition.name,
      color: definition.color,
      icon: definition.icon,
    }
  }

  const levels = await getLevelDefinitions()
  const fallback = levels.find((item) => item.level === 1) ?? {
    level: 1,
    name: "新手",
    color: "#64748b",
    icon: "🌱",
  }

  return {
    level,
    name: fallback.name,
    color: fallback.color,
    icon: fallback.icon,
  }
}
