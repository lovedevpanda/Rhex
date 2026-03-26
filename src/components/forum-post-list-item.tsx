import Link from "next/link"

import { LevelIcon } from "@/components/level-icon"

import { MessageCircle } from "lucide-react"



import { UserAvatar } from "@/components/user-avatar"
import { UserStatusBadge } from "@/components/user-status-badge"
import { cn } from "@/lib/utils"

interface ForumPostListItemProps {
  item: {
    id: string
    slug: string
    title: string
    typeLabel: string
    type?: string
    pinScope?: string | null
    pinLabel?: string | null
    hasRedPacket?: boolean
    minViewLevel?: number
    isFeatured: boolean


    boardName: string
    boardSlug?: string
    boardIcon?: string
    authorName: string
    authorUsername: string
    authorAvatarPath?: string | null
    authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    authorNameClassName?: string
    authorDisplayedBadges?: Array<{
      id: string
      name: string
      color: string
      iconText?: string | null
    }>
    metaPrimary: string
    metaSecondary?: string | null
    commentCount: number
    commentAccentColor: string
  }
  showBoard?: boolean
  compactFirstItem?: boolean
}

function getPinTone(pinScope?: string | null) {
  if (pinScope === "GLOBAL") {
    return {
      titleClassName: "line-clamp-2 text-sm font-semibold text-red-700 transition-colors hover:text-red-600 sm:text-base dark:text-red-300 dark:hover:text-red-200",
      badgeClassName: "rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-500/15 dark:text-red-200 sm:px-2.5 sm:py-1 sm:text-xs",
    }
  }

  if (pinScope === "ZONE") {
    return {
      titleClassName: "line-clamp-2 text-sm font-semibold text-orange-700 transition-colors hover:text-orange-600 sm:text-base dark:text-orange-300 dark:hover:text-orange-200",
      badgeClassName: "rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-700 dark:bg-orange-500/15 dark:text-orange-200 sm:px-2.5 sm:py-1 sm:text-xs",
    }
  }

  if (pinScope === "BOARD") {
    return {
      titleClassName: "line-clamp-2 text-sm font-semibold text-amber-700 transition-colors hover:text-amber-600 sm:text-base dark:text-amber-300 dark:hover:text-amber-200",
      badgeClassName: "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:px-2.5 sm:py-1 sm:text-xs",
    }
  }

  return null
}

export function ForumPostListItem({ item, showBoard = true, compactFirstItem = false }: ForumPostListItemProps) {
  const isRestrictedAuthor = item.authorStatus === "BANNED" || item.authorStatus === "MUTED"
  const pinTone = getPinTone(item.pinScope)

  return (
    <div className={cn(
      compactFirstItem ? "flex gap-3 border-b pb-3 last:border-b-0 sm:gap-4" : "flex gap-3 border-b py-3 last:border-b-0 sm:gap-4",
      "rounded-xl px-2 transition-all duration-150 hover:bg-accent hover:shadow-sm sm:px-3",
    )}>
      <Link href={`/users/${item.authorUsername}`} className={cn("flex-shrink-0", isRestrictedAuthor && "grayscale")}>
        <UserAvatar name={item.authorName} avatarPath={item.authorAvatarPath} size="lg" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link href={`/posts/${item.slug}`} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className={item.isFeatured ? "line-clamp-2 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-600 sm:text-base dark:text-emerald-300 dark:hover:text-emerald-200" : pinTone ? pinTone.titleClassName : "line-clamp-2 text-sm font-medium text-foreground transition-colors hover:text-primary sm:text-base"}>
                {item.title}
              </h2>
              {item.hasRedPacket ? (
                <span title="红包帖">

        <svg   className="h-4 w-4" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7811" width="200" height="200"><path d="M154.999317 115.043826m170.266862 0l380.164372 0q170.266862 0 170.266862 170.266862l0 457.126794q0 170.266862-170.266862 170.266862l-380.164372 0q-170.266862 0-170.266862-170.266862l0-457.126794q0-170.266862 170.266862-170.266862Z" fill="#F55651" p-id="7812"></path><path d="M207.173841 437.98614v269.218545c0 58.721327-1.749146 132.685212 72.114788 199.052806-56.272523-21.689409-124.289312-67.766911-124.289312-153.82489V398.405466z" fill="#F67969" p-id="7813"></path><path d="M325.266179 912.754319h380.164372a170.316837 170.316837 0 0 0 170.266862-170.316837V388.410347L821.873694 434.787701v282.012299c0 39.530698-16.591898 144.279551-114.943875 144.279551H335.761054c-84.208882 0-168.217862-58.171596-180.761737-123.839531v4.997559a170.266862 170.266862 0 0 0 170.266862 170.51674z" fill="#E3413F" p-id="7814"></path><path d="M154.999317 285.360664v129.686676c31.134797 33.183797 87.607223 74.163787 176.41386 74.163787 33.533626 100.800781 110.546022 133.035041 188.058175 133.035042 79.960957 0 158.872426-75.61308 169.417277-134.934114a256.724646 256.724646 0 0 0 186.808784-74.963397V285.360664a169.517228 169.517228 0 0 0-44.628209-114.943875l-664.675451 53.373938a169.917033 169.917033 0 0 0-11.394436 61.569937z" fill="#E3413F" p-id="7815"></path><path d="M705.430551 922.749439H325.266179a180.511859 180.511859 0 0 1-180.261982-180.311957V285.360664A180.511859 180.511859 0 0 1 325.266179 104.948755h380.164372a180.511859 180.511859 0 0 1 180.261982 180.411909v457.076818a180.511859 180.511859 0 0 1-180.261982 180.311957zM325.266179 124.938995a160.471645 160.471645 0 0 0-160.271743 160.421669v457.076818a160.471645 160.471645 0 0 0 160.271743 160.321718h380.164372a160.471645 160.471645 0 0 0 160.271743-160.321718V285.360664A160.471645 160.471645 0 0 0 705.430551 124.938995z" fill="#4B2254" p-id="7816"></path><path d="M155.948853 267.119571c0 157.023328 93.20449 175.664226 194.405076 175.664226h329.838946c101.250561 0 194.405076-51.824695 194.405075-175.664226A170.316837 170.316837 0 0 0 705.430551 114.943875H325.266179a170.416789 170.416789 0 0 0-169.317326 152.175696z" fill="#F55651" p-id="7817"></path><path d="M204.775012 241.232211c30.884919-64.968277 76.612592-77.162323 161.121328-77.162323h333.587115c79.960957 0 118.642069 13.543387 136.283456 23.488531A166.868521 166.868521 0 0 0 698.084139 114.943875H325.116252A167.068424 167.068424 0 0 0 159.197267 264.220986c-4.048023 56.572377 2.848609 86.807613 23.888336 114.294192 4.99756 4.247926 25.637482 28.236213 35.582625 24.587994a221.741728 221.741728 0 0 1-27.636505-108.546998 124.938995 124.938995 0 0 1 13.743289-53.323963z" fill="#F67969" p-id="7818"></path><path d="M722.422255 115.943387c0.649683 0 105.848316 40.830063 105.848316 151.925817S709.928355 400.254563 631.466667 400.254563H405.62694c-61.270083 0-173.115471 14.043143-236.434553-65.767887a62.369546 62.369546 0 0 0 0.499756 10.694778C202.126306 408.200683 232.861298 442.783797 350.353929 442.783797h329.838946a195.354612 195.354612 0 0 0 194.405075-175.664226A170.266862 170.266862 0 0 0 722.422255 115.943387z" fill="#E3413F" p-id="7819"></path><path d="M680.292826 452.828892h-329.838946c-94.953636 0-204.400195-21.139678-204.400195-185.759297v-1.049488A179.912152 179.912152 0 0 1 325.266179 104.948755h380.164372a179.912152 179.912152 0 0 1 179.212494 160.971401 7.396388 7.396388 0 0 1 0 1.049488c0.049976 137.033089-105.748365 185.859248-204.350219 185.859248zM165.943973 267.619327c0 145.179112 88.756662 165.219327 184.409956 165.219326h329.838946c89.00654 0 184.160078-43.428795 184.409956-165.219326A159.921913 159.921913 0 0 0 705.430551 124.938995H325.266179a159.921913 159.921913 0 0 0-159.322206 142.680332z" fill="#4B2254" p-id="7820"></path><path d="M511.225378 438.785749m-139.581845 0a139.581845 139.581845 0 1 0 279.16369 0 139.581845 139.581845 0 1 0-279.16369 0Z" fill="#F8B031" p-id="7821"></path><path d="M498.181747 410.39961m-111.195705 0a111.195705 111.195705 0 1 0 222.39141 0 111.195705 111.195705 0 1 0-222.39141 0Z" fill="#FACF5D" p-id="7822"></path><path d="M511.225378 588.362714a149.576964 149.576964 0 1 1 149.576965-149.576965 149.926794 149.926794 0 0 1-149.576965 149.576965z m0-279.16369a129.586725 129.586725 0 1 0 129.586725 129.586725 129.936554 129.936554 0 0 0-129.586725-129.586725z" fill="#4B2254" p-id="7823"></path></svg>                </span>
              ) : null}
              {item.minViewLevel && item.minViewLevel > 0 ? (

                <span title={`访问需要至少 Lv.${item.minViewLevel}`} className="inline-flex shrink-0 rounded-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-white shadow-sm sm:px-2 sm:text-[11px]">
                  [权]
                </span>
              ) : null}
            </div>
          </Link>

          {item.type !== "NORMAL" ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground sm:px-2.5 sm:py-1 sm:text-xs">{item.typeLabel}</span> : null}
          {item.pinLabel && pinTone ? <span className={pinTone.badgeClassName}>{item.pinLabel}</span> : null}
          {item.isFeatured ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 sm:px-2.5 sm:py-1 sm:text-xs">精华</span> : null}
          <Link href={`/posts/${item.slug}#comments`} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-normal transition-colors hover:opacity-90 sm:px-2.5 sm:py-1 sm:text-xs" style={{ backgroundColor: `${item.commentAccentColor}14`, color: item.commentAccentColor }}>
            <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {item.commentCount}
          </Link>
        </div>

        <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:mt-2 sm:gap-2 sm:text-xs", isRestrictedAuthor && "grayscale")}>
          {showBoard && item.boardSlug ? (
            <>
              <Link href={`/boards/${item.boardSlug}`} className="flex items-center gap-1 font-semibold hover:underline">
                <LevelIcon icon={item.boardIcon} className="h-3 w-3 text-sm sm:h-3.5 sm:w-3.5" svgClassName="[&>svg]:block" />
                <span>{item.boardName}</span>
              </Link>

              <span>•</span>
            </>
          ) : null}
          <Link href={`/users/${item.authorUsername}`} className={item.authorNameClassName ?? "hover:underline"}>
            {item.authorName}
          </Link>
          {isRestrictedAuthor ? <UserStatusBadge status={item.authorStatus} compact /> : null}
          <span>•</span>
          <span>{item.metaPrimary}</span>
          {item.metaSecondary ? (
            <>
              <span>•</span>
              <span>{item.metaSecondary}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
