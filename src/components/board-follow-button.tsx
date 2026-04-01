import { FollowToggleButton } from "@/components/follow-toggle-button"

interface BoardFollowButtonProps {
  boardId: string
  initialFollowed: boolean
}

export function BoardFollowButton({ boardId, initialFollowed }: BoardFollowButtonProps) {
  return (
    <FollowToggleButton
      targetType="board"
      targetId={boardId}
      initialFollowed={initialFollowed}
      activeLabel="已关注节点"
      inactiveLabel="关注节点"
    />
  )
}
