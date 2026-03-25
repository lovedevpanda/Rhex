const STOP_WORDS = new Set([
  "的",
  "了",
  "和",
  "与",
  "及",
  "或",
  "呢",
  "吗",
  "吧",
  "啊",
  "呀",
  "哦",
  "在",
  "是",
  "就",
  "都",
  "很",
  "也",
  "还",
  "有",
  "没有",
  "这个",
  "那个",
  "我们",
  "你们",
  "他们",
  "自己",
  "以及",
  "一个",
  "一些",
  "什么",
  "如何",
  "怎么",
  "可以",
  "使用",
  "体验",
])

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function slugifyTagName(name: string) {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32)
}

function extractChinesePhrases(text: string) {
  const matches = text.match(/[\u4e00-\u9fa5]{2,8}/g) ?? []
  return matches
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length >= 2 && item.length <= 8 && !STOP_WORDS.has(item))
}

function extractLatinTerms(text: string) {
  const matches = text.match(/[A-Za-z][A-Za-z0-9+#.-]{1,23}/g) ?? []
  return matches
    .map((item) => item.toLowerCase())
    .filter((item) => item.length >= 2 && !STOP_WORDS.has(item))
}

export function extractAutoTags(title: string, content: string, limit = 5) {
  const source = `${title}\n${content}`
  const candidates = [...extractChinesePhrases(source), ...extractLatinTerms(source)]
  const scores = new Map<string, number>()

  candidates.forEach((candidate) => {
    const current = scores.get(candidate) ?? 0
    const titleBoost = title.includes(candidate) ? 3 : 1
    const lengthBoost = Math.min(3, Math.floor(candidate.length / 2))
    scores.set(candidate, current + titleBoost + lengthBoost)
  })

  return [...scores.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      return right[0].length - left[0].length
    })
    .map(([name]) => name)
    .filter((name, index, array) => array.findIndex((item) => item === name) === index)
    .slice(0, limit)
}
