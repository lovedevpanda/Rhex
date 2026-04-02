"use client"

export interface MarkdownEditorState {
  value: string
  selectionStart: number
  selectionEnd: number
}

export interface MarkdownEditorUpdate {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type MarkdownAlignment = "left" | "center" | "right" | "justify"
export type MarkdownCodeFormat = "inline-code" | "code-block"
export type MarkdownListType = "unordered" | "unordered-star" | "ordered" | "task"
export type MarkdownMathFormat = "auto" | "inline" | "block"
export type MarkdownEditorUiAction = "open-link-panel" | "toggle-table-panel" | "trigger-image-upload"

export type MarkdownEditorKeydownResult =
  | { kind: "update"; update: MarkdownEditorUpdate }
  | { kind: "ui"; action: MarkdownEditorUiAction }

type ShortcutKeyboardEvent = Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "defaultPrevented" | "key" | "metaKey" | "shiftKey"> & {
  isComposing?: boolean
}

const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+/
const ORDERED_LIST_PATTERN = /^(\s*)(\d+)\.\s+(.*)$/
const UNORDERED_LIST_PATTERN = /^(\s*)([-*+])\s+(.*)$/
const TASK_LIST_PATTERN = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/
const TABLE_SEPARATOR_PATTERN = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/

export function insertText(source: string, selectionStart: number, selectionEnd: number, before: string, after = "") {
  return `${source.slice(0, selectionStart)}${before}${source.slice(selectionStart, selectionEnd)}${after}${source.slice(selectionEnd)}`
}

export function getBlockInsertPrefix(source: string, position: number) {
  if (position <= 0) {
    return ""
  }

  const previousChar = source[position - 1]
  if (previousChar === "\n") {
    return source[position - 2] === "\n" ? "" : "\n"
  }

  return "\n\n"
}

function createUpdate(value: string, selectionStart: number, selectionEnd: number = selectionStart): MarkdownEditorUpdate {
  return { value, selectionStart, selectionEnd }
}

function isBlankSelection(value: string) {
  return value.trim().length === 0
}

function getSafeSelectionEnd(state: MarkdownEditorState) {
  if (state.selectionEnd > state.selectionStart && state.value[state.selectionEnd - 1] === "\n") {
    return state.selectionEnd - 1
  }

  return state.selectionEnd
}

function getLineIndexAtPosition(value: string, position: number) {
  return value.slice(0, position).split("\n").length - 1
}

function getLineStartOffset(lines: string[], lineIndex: number) {
  let offset = 0
  for (let index = 0; index < lineIndex; index += 1) {
    offset += lines[index].length + 1
  }
  return offset
}

function getCurrentLineBounds(value: string, position: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, position - 1)) + 1
  const rawLineEnd = value.indexOf("\n", position)
  const lineEnd = rawLineEnd === -1 ? value.length : rawLineEnd
  return {
    lineStart,
    lineEnd,
    lineText: value.slice(lineStart, lineEnd),
  }
}

function getSelectedLines(state: MarkdownEditorState) {
  const lines = state.value.split("\n")
  const startLineIndex = getLineIndexAtPosition(state.value, state.selectionStart)
  const endLineIndex = getLineIndexAtPosition(state.value, getSafeSelectionEnd(state))
  return {
    lines,
    startLineIndex,
    endLineIndex,
  }
}

function replaceSelectedLines(
  state: MarkdownEditorState,
  mapper: (lines: string[]) => string[],
  selectionStartOffset = 0,
  selectionEndOffset?: number,
) {
  const { lines, startLineIndex, endLineIndex } = getSelectedLines(state)
  const nextLines = mapper(lines.slice(startLineIndex, endLineIndex + 1))
  const mergedLines = [...lines.slice(0, startLineIndex), ...nextLines, ...lines.slice(endLineIndex + 1)]
  const nextValue = mergedLines.join("\n")
  const nextStart = getLineStartOffset(mergedLines, startLineIndex) + selectionStartOffset
  const nextEnd = selectionEndOffset === undefined
    ? getLineStartOffset(mergedLines, startLineIndex) + nextLines.join("\n").length
    : getLineStartOffset(mergedLines, startLineIndex) + selectionEndOffset
  return createUpdate(nextValue, nextStart, nextEnd)
}

function buildInlineMathMarkdown(selectedText: string) {
  const body = selectedText.trim() || "a^2 + b^2 = c^2"
  return `$${body}$`
}

function buildBlockMathMarkdown(selectedText: string) {
  const body = selectedText.trim() || "\\int_0^1 x^2 \\, dx"
  return `$$\n${body}\n$$`
}

function buildEmptyTableRow(columnCount: number) {
  return `| ${Array.from({ length: Math.max(1, columnCount) }, () => " ").join(" | ")} |`
}

function parseTableColumnCount(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .length
}

function isTableLine(line: string) {
  const trimmed = line.trim()
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length >= 2
}

function isTableSeparatorLine(line: string) {
  return TABLE_SEPARATOR_PATTERN.test(line)
}

function findTableContext(state: MarkdownEditorState) {
  const lines = state.value.split("\n")
  const currentLineIndex = getLineIndexAtPosition(state.value, state.selectionStart)
  if (!isTableLine(lines[currentLineIndex] ?? "")) {
    return null
  }

  let startLineIndex = currentLineIndex
  let endLineIndex = currentLineIndex

  while (startLineIndex > 0 && isTableLine(lines[startLineIndex - 1] ?? "")) {
    startLineIndex -= 1
  }

  while (endLineIndex < lines.length - 1 && isTableLine(lines[endLineIndex + 1] ?? "")) {
    endLineIndex += 1
  }

  const tableLines = lines.slice(startLineIndex, endLineIndex + 1)
  const separatorRelativeIndex = tableLines.findIndex(isTableSeparatorLine)
  if (separatorRelativeIndex <= 0) {
    return null
  }

  const headerLine = tableLines[0]
  const columnCount = parseTableColumnCount(headerLine)
  return {
    lines,
    currentLineIndex,
    startLineIndex,
    endLineIndex,
    separatorLineIndex: startLineIndex + separatorRelativeIndex,
    columnCount,
  }
}

function moveCaretToLine(lines: string[], lineIndex: number, column: number) {
  const safeLineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1))
  const safeColumn = Math.max(0, Math.min(column, lines[safeLineIndex]?.length ?? 0))
  const position = getLineStartOffset(lines, safeLineIndex) + safeColumn
  return position
}

function insertTableRow(state: MarkdownEditorState) {
  const context = findTableContext(state)
  if (!context) {
    return null
  }

  const nextLines = [...context.lines]
  const insertAfterIndex = context.currentLineIndex <= context.separatorLineIndex
    ? context.separatorLineIndex
    : context.currentLineIndex
  const nextLineIndex = insertAfterIndex + 1
  nextLines.splice(nextLineIndex, 0, buildEmptyTableRow(context.columnCount))
  const nextValue = nextLines.join("\n")
  const nextSelection = moveCaretToLine(nextLines, nextLineIndex, 2)
  return createUpdate(nextValue, nextSelection, nextSelection)
}

function deleteTableRow(state: MarkdownEditorState) {
  const context = findTableContext(state)
  if (!context || context.currentLineIndex <= context.separatorLineIndex) {
    return null
  }

  const nextLines = [...context.lines]
  nextLines.splice(context.currentLineIndex, 1)
  const fallbackLineIndex = Math.min(context.currentLineIndex, nextLines.length - 1)
  const nextValue = nextLines.join("\n")
  const nextSelection = moveCaretToLine(nextLines, fallbackLineIndex, 0)
  return createUpdate(nextValue, nextSelection, nextSelection)
}

function moveTableRow(state: MarkdownEditorState, direction: "up" | "down") {
  const context = findTableContext(state)
  if (!context || context.currentLineIndex <= context.separatorLineIndex) {
    return null
  }

  const targetLineIndex = direction === "up" ? context.currentLineIndex - 1 : context.currentLineIndex + 1
  if (targetLineIndex <= context.separatorLineIndex || targetLineIndex > context.endLineIndex) {
    return null
  }

  const nextLines = [...context.lines]
  const currentColumn = state.selectionStart - getLineStartOffset(context.lines, context.currentLineIndex)
  const currentLine = nextLines[context.currentLineIndex]
  nextLines[context.currentLineIndex] = nextLines[targetLineIndex]
  nextLines[targetLineIndex] = currentLine
  const nextValue = nextLines.join("\n")
  const nextSelection = moveCaretToLine(nextLines, targetLineIndex, currentColumn)
  return createUpdate(nextValue, nextSelection, nextSelection)
}

function normalizeHeadingLine(line: string) {
  return line.replace(HEADING_PATTERN, "")
}

function isListLine(line: string) {
  return ORDERED_LIST_PATTERN.test(line) || UNORDERED_LIST_PATTERN.test(line) || TASK_LIST_PATTERN.test(line)
}

function hasIndentedLine(lines: string[]) {
  return lines.some((line) => /^(\t| {1,2})/.test(line))
}

function tryCompleteSymbolPair(state: MarkdownEditorState) {
  if (state.selectionStart !== state.selectionEnd || state.selectionStart === 0) {
    return null
  }

  const previousChar = state.value[state.selectionStart - 1]
  const closingCharMap: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
  }
  const closingChar = closingCharMap[previousChar]
  if (!closingChar) {
    return null
  }

  const nextChar = state.value[state.selectionStart]
  if (nextChar === closingChar) {
    return createUpdate(state.value, state.selectionStart + 1, state.selectionStart + 1)
  }

  const nextValue = insertText(state.value, state.selectionStart, state.selectionEnd, closingChar)
  return createUpdate(nextValue, state.selectionStart, state.selectionStart)
}

function insertSoftIndent(state: MarkdownEditorState) {
  const nextValue = insertText(state.value, state.selectionStart, state.selectionEnd, "  ")
  const nextSelection = state.selectionStart + 2
  return createUpdate(nextValue, nextSelection, nextSelection)
}

function handleTabKey(state: MarkdownEditorState, backwards: boolean) {
  const { lines, startLineIndex, endLineIndex } = getSelectedLines(state)
  const selectedLines = lines.slice(startLineIndex, endLineIndex + 1)
  const shouldAdjustLines = selectedLines.length > 1 || selectedLines.some(isListLine) || hasIndentedLine(selectedLines)

  if (backwards) {
    if (!shouldAdjustLines) {
      return null
    }

    return replaceSelectedLines(state, (currentLines) => currentLines.map((line) => line.replace(/^(\t| {1,2})/, "")))
  }

  if (shouldAdjustLines) {
    return replaceSelectedLines(state, (currentLines) => currentLines.map((line) => `  ${line}`))
  }

  const pairCompletion = tryCompleteSymbolPair(state)
  if (pairCompletion) {
    return pairCompletion
  }

  return insertSoftIndent(state)
}

function continueListOnEnter(state: MarkdownEditorState) {
  if (state.selectionStart !== state.selectionEnd) {
    return null
  }

  const { lineStart, lineText } = getCurrentLineBounds(state.value, state.selectionStart)
  const caretOffset = state.selectionStart - lineStart
  const beforeCaret = lineText.slice(0, caretOffset)

  const taskMatch = beforeCaret.match(TASK_LIST_PATTERN)
  if (taskMatch) {
    const [, indent, marker, checked, content] = taskMatch
    if (!content.trim()) {
      const nextValue = `${state.value.slice(0, lineStart)}${state.value.slice(lineStart + beforeCaret.length)}`
      return createUpdate(nextValue, lineStart, lineStart)
    }

    const nextMarker = `${indent}${marker} [${checked}] `
    const nextValue = insertText(state.value, state.selectionStart, state.selectionEnd, `\n${nextMarker}`)
    const nextSelection = state.selectionStart + nextMarker.length + 1
    return createUpdate(nextValue, nextSelection, nextSelection)
  }

  const orderedMatch = beforeCaret.match(ORDERED_LIST_PATTERN)
  if (orderedMatch) {
    const [, indent, indexText, content] = orderedMatch
    if (!content.trim()) {
      const nextValue = `${state.value.slice(0, lineStart)}${state.value.slice(lineStart + beforeCaret.length)}`
      return createUpdate(nextValue, lineStart, lineStart)
    }

    const nextMarker = `${indent}${Number(indexText) + 1}. `
    const nextValue = insertText(state.value, state.selectionStart, state.selectionEnd, `\n${nextMarker}`)
    const nextSelection = state.selectionStart + nextMarker.length + 1
    return createUpdate(nextValue, nextSelection, nextSelection)
  }

  const unorderedMatch = beforeCaret.match(UNORDERED_LIST_PATTERN)
  if (!unorderedMatch) {
    return null
  }

  const [, indent, marker, content] = unorderedMatch
  if (!content.trim()) {
    const nextValue = `${state.value.slice(0, lineStart)}${state.value.slice(lineStart + beforeCaret.length)}`
    return createUpdate(nextValue, lineStart, lineStart)
  }

  const nextMarker = `${indent}${marker} `
  const nextValue = insertText(state.value, state.selectionStart, state.selectionEnd, `\n${nextMarker}`)
  const nextSelection = state.selectionStart + nextMarker.length + 1
  return createUpdate(nextValue, nextSelection, nextSelection)
}

export function buildLinkMarkdown(linkText: string, url: string) {
  const normalizedText = linkText.trim() || "链接文字"
  const normalizedUrl = url.trim() || "https://example.com"
  return `[${normalizedText}](${normalizedUrl})`
}

export function buildInlineCodeMarkdown(selectedText: string) {
  return isBlankSelection(selectedText) ? "`代码`" : `\`${selectedText}\``
}

export function buildInlineHighlightMarkdown(selectedText: string) {
  return isBlankSelection(selectedText) ? "==高亮内容==" : `==${selectedText}==`
}

export function buildCodeBlockMarkdown(selectedText: string) {
  const normalized = selectedText.trimEnd()
  const body = normalized || "// 在这里输入代码"
  return `\`\`\`ts\n${body}\n\`\`\``
}

export function buildSizedTableMarkdown(rows: number, columns: number) {
  const safeRows = Math.max(1, rows)
  const safeColumns = Math.max(1, columns)
  const header = Array.from({ length: safeColumns }, (_, index) => `列 ${index + 1}`)
  const separator = Array.from({ length: safeColumns }, () => "---")
  const body = Array.from({ length: safeRows }, (_, rowIndex) => (
    Array.from({ length: safeColumns }, (_, columnIndex) => `内容 ${rowIndex + 1}-${columnIndex + 1}`)
  ))

  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n")
}

export function buildAlignmentHtml(alignment: MarkdownAlignment, selectedText: string) {
  const body = selectedText.trim() || "输入内容"
  if (alignment === "center") {
    return `<center>${body}</center>`
  }

  if (alignment === "justify") {
    return `<p align="justify">${body}</p>`
  }

  return `<p align="${alignment}">${body}</p>`
}

export function wrapSelection(state: MarkdownEditorState, before: string, after = "") {
  const nextValue = insertText(state.value, state.selectionStart, state.selectionEnd, before, after)
  return createUpdate(
    nextValue,
    state.selectionStart + before.length,
    state.selectionEnd + before.length,
  )
}

export function insertSelection(state: MarkdownEditorState, transform: (selectedText: string) => string) {
  const selectedText = state.value.slice(state.selectionStart, state.selectionEnd)
  const nextText = transform(selectedText)
  const nextValue = `${state.value.slice(0, state.selectionStart)}${nextText}${state.value.slice(state.selectionEnd)}`
  return createUpdate(nextValue, state.selectionStart, state.selectionStart + nextText.length)
}

export function insertTemplate(state: MarkdownEditorState, template: string) {
  const prefix = getBlockInsertPrefix(state.value, state.selectionStart)
  const insertedText = prefix + template
  const nextValue = insertText(state.value, state.selectionStart, state.selectionEnd, insertedText)
  const nextSelection = state.selectionStart + insertedText.length
  return createUpdate(nextValue, nextSelection, nextSelection)
}

export function insertLinePrefix(state: MarkdownEditorState, prefix: string) {
  return replaceSelectedLines(state, (lines) => lines.map((line) => `${prefix}${line}`))
}

export function insertOrderedList(state: MarkdownEditorState) {
  return replaceSelectedLines(state, (lines) => lines.map((line, index) => `${index + 1}. ${line}`))
}

export function applyListFormat(state: MarkdownEditorState, listType: MarkdownListType) {
  if (listType === "ordered") {
    return insertOrderedList(state)
  }

  if (listType === "task") {
    return insertLinePrefix(state, "- [ ] ")
  }

  return insertLinePrefix(state, listType === "unordered-star" ? "* " : "- ")
}

export function applyCodeFormat(state: MarkdownEditorState, codeType: MarkdownCodeFormat) {
  if (codeType === "code-block") {
    return insertSelection(state, buildCodeBlockMarkdown)
  }

  return insertSelection(state, buildInlineCodeMarkdown)
}

export function setHeadingLevel(state: MarkdownEditorState, level: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
  return replaceSelectedLines(state, (lines) => lines.map((line) => {
    const normalized = normalizeHeadingLine(line)
    if (level === 0) {
      return normalized
    }

    return `${"#".repeat(level)} ${normalized}`
  }))
}

export function applyAlignment(state: MarkdownEditorState, alignment: MarkdownAlignment) {
  return insertSelection(state, (selectedText) => buildAlignmentHtml(alignment, selectedText))
}

export function applyMathFormat(state: MarkdownEditorState, format: MarkdownMathFormat) {
  if (format === "inline") {
    return insertSelection(state, buildInlineMathMarkdown)
  }

  if (format === "block") {
    return insertSelection(state, buildBlockMathMarkdown)
  }

  const selectedText = state.value.slice(state.selectionStart, state.selectionEnd)
  const preferredFormat = selectedText.includes("\n") || isBlankSelection(selectedText) ? "block" : "inline"
  return applyMathFormat(state, preferredFormat)
}

export function getMarkdownEditorKeydownResult(event: ShortcutKeyboardEvent, state: MarkdownEditorState): MarkdownEditorKeydownResult | null {
  if (event.defaultPrevented || event.isComposing) {
    return null
  }

  if (event.key === "Tab") {
    const update = handleTabKey(state, event.shiftKey)
    return update ? { kind: "update", update } : null
  }

  if (event.key === "Enter") {
    const update = continueListOnEnter(state)
    return update ? { kind: "update", update } : null
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.shiftKey && event.code === "ArrowDown") {
      const update = insertTableRow(state)
      return update ? { kind: "update", update } : null
    }

    if (event.shiftKey && event.code === "ArrowUp") {
      const update = deleteTableRow(state)
      return update ? { kind: "update", update } : null
    }

    if (!event.shiftKey && event.code === "ArrowUp") {
      const update = moveTableRow(state, "up")
      return update ? { kind: "update", update } : null
    }

    if (!event.shiftKey && event.code === "ArrowDown") {
      const update = moveTableRow(state, "down")
      return update ? { kind: "update", update } : null
    }
  }

  const hasPrimaryModifier = event.ctrlKey || event.metaKey
  if (!hasPrimaryModifier) {
    if (event.shiftKey && event.altKey && event.code === "Digit5") {
      return {
        kind: "update",
        update: wrapSelection(state, "~~", "~~"),
      }
    }

    return null
  }

  if (event.altKey && !event.shiftKey) {
    const lowerKey = event.key.toLowerCase()
    if (lowerKey === "m") {
      return {
        kind: "update",
        update: applyMathFormat(state, "inline"),
      }
    }

    if (lowerKey === "b") {
      return {
        kind: "update",
        update: applyMathFormat(state, "block"),
      }
    }

    if (lowerKey === "c") {
      return {
        kind: "update",
        update: applyCodeFormat(state, "code-block"),
      }
    }

    // markdown.txt 将 Ctrl/Cmd+Shift+L 同时分配给无序列表和左对齐，这里给左对齐保留无冲突的备选键位。
    if (lowerKey === "l") {
      return {
        kind: "update",
        update: applyAlignment(state, "left"),
      }
    }
  }

  if (!event.altKey && !event.shiftKey) {
    const lowerKey = event.key.toLowerCase()
    if (lowerKey === "b") {
      return {
        kind: "update",
        update: wrapSelection(state, "**", "**"),
      }
    }

    if (lowerKey === "i") {
      return {
        kind: "update",
        update: wrapSelection(state, "*", "*"),
      }
    }

    if (lowerKey === "u") {
      return {
        kind: "update",
        update: wrapSelection(state, "<u>", "</u>"),
      }
    }

    if (lowerKey === "k") {
      return { kind: "ui", action: "open-link-panel" }
    }

    if (event.code === "Digit0") {
      return {
        kind: "update",
        update: setHeadingLevel(state, 0),
      }
    }

    if (event.code === "Digit1") {
      return {
        kind: "update",
        update: setHeadingLevel(state, 1),
      }
    }

    if (event.code === "Digit2") {
      return {
        kind: "update",
        update: setHeadingLevel(state, 2),
      }
    }

    if (event.code === "Digit3") {
      return {
        kind: "update",
        update: setHeadingLevel(state, 3),
      }
    }

    if (event.code === "Digit4") {
      return {
        kind: "update",
        update: setHeadingLevel(state, 4),
      }
    }

    if (event.code === "Digit5") {
      return {
        kind: "update",
        update: setHeadingLevel(state, 5),
      }
    }

    if (event.code === "Digit6") {
      return {
        kind: "update",
        update: setHeadingLevel(state, 6),
      }
    }
  }

  if (event.shiftKey && !event.altKey) {
    if (event.code === "Digit5") {
      return {
        kind: "update",
        update: wrapSelection(state, "~~", "~~"),
      }
    }

    if (event.code === "Backquote") {
      return {
        kind: "update",
        update: applyCodeFormat(state, "inline-code"),
      }
    }

    if (event.code === "Minus") {
      return {
        kind: "update",
        update: insertTemplate(state, "---"),
      }
    }

    const lowerKey = event.key.toLowerCase()
    if (lowerKey === "k") {
      return {
        kind: "update",
        update: applyCodeFormat(state, "code-block"),
      }
    }

    if (lowerKey === "q") {
      return {
        kind: "update",
        update: insertLinePrefix(state, "> "),
      }
    }

    if (lowerKey === "l") {
      return {
        kind: "update",
        update: applyListFormat(state, "unordered"),
      }
    }

    if (lowerKey === "o") {
      return {
        kind: "update",
        update: applyListFormat(state, "ordered"),
      }
    }

    if (lowerKey === "c") {
      return {
        kind: "update",
        update: applyAlignment(state, "center"),
      }
    }

    if (lowerKey === "r") {
      return {
        kind: "update",
        update: applyAlignment(state, "right"),
      }
    }

    if (lowerKey === "j") {
      return {
        kind: "update",
        update: applyAlignment(state, "justify"),
      }
    }

    if (lowerKey === "m") {
      return {
        kind: "update",
        update: applyMathFormat(state, "auto"),
      }
    }

    if (lowerKey === "i") {
      return { kind: "ui", action: "trigger-image-upload" }
    }
  }

  if (!event.shiftKey && !event.altKey && event.key.toLowerCase() === "t") {
    return { kind: "ui", action: "toggle-table-panel" }
  }

  return null
}
