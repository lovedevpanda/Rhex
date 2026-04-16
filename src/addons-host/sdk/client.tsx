"use client"

import * as React from "react"
import { createRoot } from "react-dom/client"
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock3,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Heart,
  ImageIcon,
  Info,
  Link2,
  ListMusic,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquareMore,
  MoreHorizontal,
  Music4,
  Palette,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  FormModal,
  Modal,
} from "@/components/ui/modal"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from "@/components/ui/tooltip"
import { ForumPostStreamView } from "@/components/forum/forum-post-stream-view"
import { LevelBadge } from "@/components/level-badge"
import { LevelIcon } from "@/components/level-icon"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserDisplayedBadges } from "@/components/user/user-displayed-badges"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { UserVerificationBadge } from "@/components/user/user-verification-badge"
import { AvatarVipBadge } from "@/components/vip/avatar-vip-badge"
import { VipDisplayName } from "@/components/vip/vip-display-name"
import { VipLevelIcon } from "@/components/vip/vip-level-icon"
import { VipNameTooltip } from "@/components/vip/vip-name-tooltip"
import { cn } from "@/lib/utils"

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

const loadedScriptState = new Map<string, Promise<void>>()

function loadScriptOnce(
  src: string,
  options?: {
    async?: boolean
    defer?: boolean
    attributes?: Record<string, string>
    timeoutMs?: number
  },
) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadScriptOnce 仅能在浏览器环境调用"))
  }

  const normalizedSrc = normalizeOptionalString(src)
  if (!normalizedSrc) {
    return Promise.reject(new Error("loadScriptOnce 缺少有效的脚本地址"))
  }

  const existing = loadedScriptState.get(normalizedSrc)
  if (existing) {
    return existing
  }

  const promise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${CSS.escape(normalizedSrc)}"]`,
    )
    let settled = false

    const finish = (callback: () => void | ((reason?: unknown) => void), reason?: unknown) => {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timer)
      cleanup()

      if (callback === reject) {
        loadedScriptState.delete(normalizedSrc)
        reject(reason)
        return
      }

      resolve()
    }

    const handleLoad = () => finish(resolve)
    const handleError = () =>
      finish(reject, new Error(`脚本加载失败: ${normalizedSrc}`))

    const cleanup = () => {
      if (script) {
        script.removeEventListener("load", handleLoad)
        script.removeEventListener("error", handleError)
      }
    }

    const timer = window.setTimeout(() => {
      finish(reject, new Error(`脚本加载超时: ${normalizedSrc}`))
    }, Math.max(1000, options?.timeoutMs ?? 15000))

    if (!script) {
      script = document.createElement("script")
      script.src = normalizedSrc
      script.async = options?.async ?? true
      script.defer = options?.defer ?? true

      for (const [key, value] of Object.entries(options?.attributes ?? {})) {
        script.setAttribute(key, value)
      }

      document.head.appendChild(script)
    }

    script.addEventListener("load", handleLoad)
    script.addEventListener("error", handleError)

    const alreadyLoaded =
      script instanceof HTMLScriptElement
      && script.dataset.loaded === "true"
    if (alreadyLoaded) {
      handleLoad()
      return
    }

    script.setAttribute("data-loaded", "false")
  }).then(() => {
    const script = document.querySelector(
      `script[src="${CSS.escape(normalizedSrc)}"]`,
    )
    if (script instanceof HTMLScriptElement) {
      script.dataset.loaded = "true"
    }
  })

  loadedScriptState.set(normalizedSrc, promise)
  return promise
}

const addonClientUi = Object.freeze({
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  FormModal,
  Modal,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  ScrollArea,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  useSidebar,
})

export type AddonClientSdkUi = typeof addonClientUi

const addonClientUtils = Object.freeze({
  escapeHtml,
  isRecord,
  loadScriptOnce,
  normalizeOptionalString,
})

export type AddonClientSdkUtils = typeof addonClientUtils

const addonClientCustom = Object.freeze({
  AvatarVipBadge,
  ForumPostStreamView,
  LevelBadge,
  LevelIcon,
  UserAvatar,
  UserDisplayedBadges,
  UserStatusBadge,
  UserVerificationBadge,
  VipDisplayName,
  VipLevelIcon,
  VipNameTooltip,
})

export type AddonClientSdkCustom = typeof addonClientCustom

const addonClientIcons = Object.freeze({
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock3,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Heart,
  ImageIcon,
  Info,
  Link2,
  ListMusic,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquareMore,
  MoreHorizontal,
  Music4,
  Palette,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
})

export type AddonClientSdkIcons = typeof addonClientIcons

export interface AddonClientSdk {
  React: typeof React
  createRoot: typeof createRoot
  custom: AddonClientSdkCustom
  icons: AddonClientSdkIcons
  ui: AddonClientSdkUi
  utils: AddonClientSdkUtils
  toast: typeof toast
  cn: typeof cn
}

export interface RhexClientSessionUser {
  id: number
  username: string
  nickname: string | null
  avatarPath: string | null
  role: string
  status: string
  level: number
  points: number
  vipLevel: number | null
  vipExpiresAt: string | null
}

export interface RhexClientSession {
  isAuthenticated: boolean
  user: RhexClientSessionUser | null
}

export interface RhexClientSite {
  siteName: string
  pointName: string
  leftSidebarDisplayMode: string
  markdownImageUploadEnabled: boolean
}

export interface RhexClientGlobal extends AddonClientSdk {
  sdkVersion: 1
  getSdk: () => AddonClientSdk
  session: RhexClientSession
  site: RhexClientSite | null
}

declare global {
  interface Window {
    _rhex?: RhexClientGlobal
  }
}

let addonClientSdkSingleton: AddonClientSdk | null = null
let rhexClientGlobalSingleton: RhexClientGlobal | null = null

function createDefaultRhexClientSession(): RhexClientSession {
  return {
    isAuthenticated: false,
    user: null,
  }
}

export type AddonClientComponentProps<TProps extends Record<string, unknown> = Record<string, unknown>> =
  TProps & {
    sdk: AddonClientSdk
  }

export type AddonClientComponent<TProps extends Record<string, unknown> = Record<string, unknown>> =
  React.ComponentType<AddonClientComponentProps<TProps>>

export type AddonClientComponentFactory<TProps extends Record<string, unknown> = Record<string, unknown>> =
  (sdk: AddonClientSdk) => AddonClientComponent<TProps> | Promise<AddonClientComponent<TProps>>

export function createAddonClientSdk(): AddonClientSdk {
  if (!addonClientSdkSingleton) {
    addonClientSdkSingleton = {
      React,
      createRoot,
      custom: addonClientCustom,
      icons: addonClientIcons,
      ui: addonClientUi,
      utils: addonClientUtils,
      toast,
      cn,
    }
  }

  return addonClientSdkSingleton
}

export function getRhexClientGlobal(): RhexClientGlobal {
  if (!rhexClientGlobalSingleton) {
    const sdk = createAddonClientSdk()
    rhexClientGlobalSingleton = {
      ...sdk,
      sdkVersion: 1,
      getSdk: createAddonClientSdk,
      session: createDefaultRhexClientSession(),
      site: null,
    }
  }

  return rhexClientGlobalSingleton
}

export function installRhexClientGlobal(input?: {
  session?: RhexClientSession
  site?: RhexClientSite | null
}) {
  if (typeof window === "undefined") {
    return null
  }

  const globalSdk = getRhexClientGlobal()
  globalSdk.session = input?.session ?? createDefaultRhexClientSession()
  globalSdk.site = input?.site ?? null
  window._rhex = globalSdk
  return globalSdk
}
