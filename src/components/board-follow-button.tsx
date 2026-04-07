import { FollowToggleButton } from "@/components/follow-toggle-button"

interface BoardFollowButtonProps {
  boardId: string
  initialFollowed: boolean
  showLabel?: boolean
  className?: string
}

export function BoardFollowButton({ boardId, initialFollowed, showLabel = false, className }: BoardFollowButtonProps) {
  return (
    <FollowToggleButton
      targetType="board"
      targetId={boardId}
      initialFollowed={initialFollowed}
      activeLabel="已关注节点"
      inactiveLabel="关注节点"
      showLabel={showLabel}
      className={className}
    />
  )
}
