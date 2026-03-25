export function renderRichTextToHtml(input: string) {
  return input.replace(/\r\n/g, "\n").trim()
}
