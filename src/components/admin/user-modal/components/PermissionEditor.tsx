"use client"

import type { EditableScopeItem } from "@/components/admin/user-modal/types"

export function PermissionEditor({
  title,
  items,
  activeScopes,
  onToggle,
  onToggleEdit,
  onToggleWithdraw,
}: {
  title: string
  items: Array<{ id: string; label: string; description: string }>
  activeScopes: EditableScopeItem[]
  onToggle: (id: string) => void
  onToggleEdit: (id: string) => void
  onToggleWithdraw: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const active = activeScopes.find((scope) => scope.id === item.id)
          return (
            <label key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-border px-3 py-2">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
              </span>
              <span className="flex items-center gap-3">
                {active ? (
                  <>
                    <button
                      type="button"
                      className={active.canEditSettings ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"}
                      onClick={() => onToggleEdit(item.id)}
                    >
                      可改设置
                    </button>
                    <button
                      type="button"
                      className={active.canWithdrawTreasury ? "rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] text-white" : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"}
                      onClick={() => onToggleWithdraw(item.id)}
                    >
                      可提金库
                    </button>
                  </>
                ) : null}
                <input type="checkbox" checked={Boolean(active)} onChange={() => onToggle(item.id)} />
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
