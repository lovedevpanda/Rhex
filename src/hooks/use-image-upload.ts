import { useCallback, useState } from "react"

export type UploadFileStatus = "pending" | "success" | "error"

export type UploadFileResult = {
  name: string
  status: UploadFileStatus
  urlPath?: string
  errorMessage?: string
}

type UseImageUploadOptions = {
  uploadFolder?: string
  onInsert: (markdown: string) => void
}

type UseImageUploadResult = {
  uploading: boolean
  uploadResults: UploadFileResult[]
  uploadImageFiles: (files: File[]) => Promise<number>
  clearUploadResults: () => void
}

export function useImageUpload({ uploadFolder = "posts", onInsert }: UseImageUploadOptions): UseImageUploadResult {
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadFileResult[]>([])

  const clearUploadResults = useCallback(() => {
    setUploadResults([])
  }, [])

  const uploadImageFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return 0
    }

    setUploading(true)
    const initialResults: UploadFileResult[] = files.map((file) => ({
      name: file.name,
      status: "pending",
    }))
    setUploadResults(initialResults)

    const uploadOne = async (file: File, index: number): Promise<string | null> => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", uploadFolder)

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const result = await response.json()

        if (!response.ok) {
          const errorMessage = result.message ?? `${file.name} 上传失败`
          setUploadResults((prev) => prev.map((item, i) =>
            i === index ? { ...item, status: "error", errorMessage } : item,
          ))
          return null
        }

        const urlPath: string = result.data?.urlPath ?? ""
        setUploadResults((prev) => prev.map((item, i) =>
          i === index ? { ...item, status: "success", urlPath } : item,
        ))
        return urlPath
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : `${file.name} 上传失败`
        setUploadResults((prev) => prev.map((item, i) =>
          i === index ? { ...item, status: "error", errorMessage } : item,
        ))
        return null
      }
    }

    try {
      const urlPaths = await Promise.all(files.map((file, index) => uploadOne(file, index)))
      const markdownLines = files
        .map((file, index) => urlPaths[index] !== null ? `![${file.name}](${urlPaths[index]})` : null)
        .filter((line): line is string => line !== null)

      if (markdownLines.length > 0) {
        onInsert(markdownLines.join("\n\n"))
      }

      return markdownLines.length
    } finally {
      setUploading(false)
    }
  }, [onInsert, uploadFolder])

  return {
    uploading,
    uploadResults,
    uploadImageFiles,
    clearUploadResults,
  }
}
