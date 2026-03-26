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
  "问题",
  "分享",
  "讨论",
  "请教",
  "求助",
  "记录",
  "总结",
  "方案",
  "方法",
  "教程",
  "指南",
  "内容",
  "帖子",
  "主题",
  "标签",
])

const CHINESE_NOISE_SEGMENTS = [
  "有没有",
  "是什么",
  "为什么",
  "怎么",
  "如何",
  "一下",
  "一个",
  "一些",
  "这种",
  "那个",
  "这个",
  "这里",
  "那里",
  "真的",
  "感觉",
  "大家",
  "自己",
  "可以",
  "需要",
  "因为",
  "所以",
  "如果",
  "但是",
  "然后",
  "就是",
  "还是",
  "已经",
  "目前",
  "最近",
]

const LATIN_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "what",
  "when",
  "where",
  "which",
  "while",
  "into",
  "onto",
  "about",
  "post",
  "topic",
  "help",
  "question",
  "issue",
  "problem",
  "share",
  "summary",
  "guide",
  "demo",
  "test",
  "tips",
  "note",
  "notes",
])

const TITLE_SPLIT_PATTERN = /[\s,，。.!！?？:：;；/|()（）\[\]【】{}<>《》"'`~\-—_+=*&^%$#@]+/
const CONTENT_SPLIT_PATTERN = /[\s,，。.!！?？:：;；/|()（）\[\]【】{}<>《》"'`~\-—_+=*&^%$#@\n\r]+/
const ENGLISH_TOKEN_PATTERN = /^[a-z][a-z0-9+#.-]{1,23}$/i
const PURE_NUMBER_PATTERN = /^\d+$/
const VERSION_LIKE_PATTERN = /^v?\d+(?:\.\d+){1,3}$/i
const DATE_LIKE_PATTERN = /^\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?$/

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function normalizeChineseCandidate(value: string) {
  let normalized = normalizeWhitespace(value)

  CHINESE_NOISE_SEGMENTS.forEach((segment) => {
    normalized = normalized.replace(new RegExp(segment, "g"), "")
  })

  return normalized.trim()
}

function isInvalidLatinCandidate(value: string) {
  return PURE_NUMBER_PATTERN.test(value) || VERSION_LIKE_PATTERN.test(value) || DATE_LIKE_PATTERN.test(value) || LATIN_STOP_WORDS.has(value)
}

function isNoiseCandidate(value: string) {
  if (!value) {
    return true
  }

  if (STOP_WORDS.has(value)) {
    return true
  }

  if (value.length <= 1) {
    return true
  }

  if (/^[\p{P}\p{S}]+$/u.test(value)) {
    return true
  }

  if (/^[\d\W_]+$/u.test(value)) {
    return true
  }

  if (/[\u4e00-\u9fa5]/.test(value)) {
    return value.length < 2 || value.length > 8
  }

  if (ENGLISH_TOKEN_PATTERN.test(value)) {
    return value.length < 2 || isInvalidLatinCandidate(value.toLowerCase())
  }

  return true
}

export function slugifyTagName(name: string) {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32)
}

function buildChineseSegments(text: string) {
  return text
    .split(CONTENT_SPLIT_PATTERN)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => item.match(/[\u4e00-\u9fa5]{2,12}/g) ?? [])
}

function extractChinesePhrases(text: string) {
  const segments = buildChineseSegments(text)
  const phrases = new Set<string>()

  segments.forEach((segment) => {
    const normalizedSegment = normalizeChineseCandidate(segment)

    if (!isNoiseCandidate(normalizedSegment)) {
      phrases.add(normalizedSegment)
    }

    for (let size = 4; size >= 2; size -= 1) {
      if (normalizedSegment.length < size) {
        continue
      }

      for (let start = 0; start <= normalizedSegment.length - size; start += 1) {
        const candidate = normalizeChineseCandidate(normalizedSegment.slice(start, start + size))

        if (!isNoiseCandidate(candidate)) {
          phrases.add(candidate)
        }
      }
    }
  })

  return [...phrases]
}

function extractLatinTerms(text: string) {
  return (text.match(/[A-Za-z][A-Za-z0-9+#.-]{1,23}/g) ?? [])
    .map((item) => item.toLowerCase())
    .filter((item) => !isNoiseCandidate(item))
}

function addCandidateScore(scores: Map<string, number>, candidate: string, score: number) {
  if (isNoiseCandidate(candidate)) {
    return
  }

  scores.set(candidate, (scores.get(candidate) ?? 0) + score)
}

function buildWeightedCandidates(title: string, content: string) {
  const scores = new Map<string, number>()
  const normalizedTitle = normalizeWhitespace(title)
  const titleTokens = normalizedTitle.split(TITLE_SPLIT_PATTERN).map((item) => item.trim()).filter(Boolean)
  const contentPreview = content.slice(0, 1200)

  titleTokens.forEach((token) => {
    const normalizedChinese = normalizeChineseCandidate(token)
    addCandidateScore(scores, normalizedChinese, 10)

    if (ENGLISH_TOKEN_PATTERN.test(token)) {
      addCandidateScore(scores, token.toLowerCase(), 10)
    }
  })

  extractChinesePhrases(normalizedTitle).forEach((candidate) => addCandidateScore(scores, candidate, 8))
  extractLatinTerms(normalizedTitle).forEach((candidate) => addCandidateScore(scores, candidate, 8))
  extractChinesePhrases(contentPreview).forEach((candidate) => addCandidateScore(scores, candidate, 3))
  extractLatinTerms(contentPreview).forEach((candidate) => addCandidateScore(scores, candidate, 3))

  return scores
}

function pruneContainedCandidates(items: Array<[string, number]>) {
  return items.filter(([candidate, score], index, array) => {
    return !array.some(([otherCandidate, otherScore], otherIndex) => {
      if (index === otherIndex || candidate === otherCandidate) {
        return false
      }

      if (otherCandidate.length < candidate.length) {
        return false
      }

      if (!otherCandidate.includes(candidate)) {
        return false
      }

      return otherScore >= score + 2
    })
  })
}

export function extractAutoTags(title: string, content: string, limit = 5) {
  const scores = buildWeightedCandidates(title, content)

  return pruneContainedCandidates([...scores.entries()])
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
