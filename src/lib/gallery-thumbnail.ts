const GALLERY_THUMBNAIL_DEFAULT_WIDTH = 640
const GALLERY_THUMBNAIL_SRCSET_WIDTHS = [384, 640, 750] as const
const GALLERY_THUMBNAIL_SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"])

function getPathExtension(pathname: string) {
  const fileName = pathname.split("/").pop() ?? ""
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
  return extension === fileName ? "" : extension
}

function canUseGalleryThumbnail(pathname: string) {
  return pathname.startsWith("/uploads/")
    && GALLERY_THUMBNAIL_SUPPORTED_EXTENSIONS.has(getPathExtension(pathname))
}

export function buildGalleryThumbnailUrl(src: string, width = GALLERY_THUMBNAIL_DEFAULT_WIDTH) {
  const normalizedSrc = src.trim()

  if (!normalizedSrc) {
    return normalizedSrc
  }

  try {
    const normalizedPathSrc = normalizedSrc.startsWith("uploads/") ? `/${normalizedSrc}` : normalizedSrc
    const isRelativePath = normalizedPathSrc.startsWith("/")
    const url = new URL(normalizedPathSrc, isRelativePath ? "http://rhex.local" : undefined)

    if (!canUseGalleryThumbnail(url.pathname)) {
      return normalizedSrc
    }

    const sourcePath = `${url.pathname}${url.search}`
    return `/_next/image?url=${encodeURIComponent(sourcePath)}&w=${width}&q=75`
  } catch {
    return normalizedSrc
  }
}

export function buildGalleryThumbnailSrcSet(src: string) {
  const entries = GALLERY_THUMBNAIL_SRCSET_WIDTHS
    .map((width) => {
      const url = buildGalleryThumbnailUrl(src, width)
      return url === src ? null : `${url} ${width}w`
    })
    .filter((entry): entry is string => Boolean(entry))

  return entries.length > 0 ? entries.join(", ") : undefined
}
