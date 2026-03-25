import path from "path"

import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/db/client"
import { getSiteSettings } from "@/lib/site-settings"
import { saveUploadedFile } from "@/lib/upload"

const ALLOWED_UPLOAD_FOLDERS = new Set(["avatars", "posts", "friend-links", "site-logo"])



function normalizeExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase()
}

export async function POST(request: Request) {
  const settings = await getSiteSettings()
  const currentUser = await getCurrentUser()

  if (settings.uploadRequireLogin && !currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录后再上传" }, { status: 401 })
  }

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "当前上传需要登录用户归属，暂不支持匿名上传" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const rawFolder = String(formData.get("folder") ?? "avatars").trim().toLowerCase()
  const folder = ALLOWED_UPLOAD_FOLDERS.has(rawFolder) ? rawFolder : "avatars"

  if (!(file instanceof File)) {
    return NextResponse.json({ code: 400, message: "缺少上传文件" }, { status: 400 })
  }

  if (file.size <= 0) {
    return NextResponse.json({ code: 400, message: "上传文件不能为空" }, { status: 400 })
  }

  const extension = normalizeExtension(file.name)
  const allowedExtensions = settings.uploadAllowedImageTypes.map((item) => item.trim().toLowerCase()).filter(Boolean)
  const maxSizeMb = folder === "avatars" ? settings.uploadAvatarMaxFileSizeMb : settings.uploadMaxFileSizeMb
  const normalizedMaxSizeMb = Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 5
  const maxSizeBytes = normalizedMaxSizeMb * 1024 * 1024


  if (!extension || extension === "svg" || !allowedExtensions.includes(extension)) {
    return NextResponse.json({ code: 400, message: `仅支持上传 ${allowedExtensions.join(" / ")} 格式的图片` }, { status: 400 })
  }


  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ code: 400, message: "仅允许上传图片文件" }, { status: 400 })
  }

  if (file.size > maxSizeBytes) {
    return NextResponse.json({ code: 400, message: `上传文件不能超过 ${maxSizeMb}MB` }, { status: 400 })
  }

  try {
    const saved = await saveUploadedFile(file, folder)

    await prisma.upload.create({
      data: {
        userId: currentUser.id,
        bucketType: folder,
        originalName: file.name,
        fileName: saved.fileName,
        fileExt: saved.fileExt,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        storagePath: saved.storagePath,
        urlPath: saved.urlPath,
      },
    })

    return NextResponse.json({
      code: 0,
      message: "上传成功",
      data: {
        urlPath: saved.urlPath,
      },
    })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "上传失败" }, { status: 400 })
  }
}

