import { handleAddonApiRoute } from "@/addons-host/runtime/http"

type RouteContext = {
  params: Promise<{
    addonId: string
    slug?: string[]
  }>
}

export function GET(request: Request, context: RouteContext) {
  return handleAddonApiRoute("admin", request, context)
}

export function POST(request: Request, context: RouteContext) {
  return handleAddonApiRoute("admin", request, context)
}

export function PUT(request: Request, context: RouteContext) {
  return handleAddonApiRoute("admin", request, context)
}

export function PATCH(request: Request, context: RouteContext) {
  return handleAddonApiRoute("admin", request, context)
}

export function DELETE(request: Request, context: RouteContext) {
  return handleAddonApiRoute("admin", request, context)
}

export function OPTIONS(request: Request, context: RouteContext) {
  return handleAddonApiRoute("admin", request, context)
}

export function HEAD(request: Request, context: RouteContext) {
  return handleAddonApiRoute("admin", request, context)
}
