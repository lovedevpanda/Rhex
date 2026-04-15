"use client"

import type { LocalPostDraft } from "@/lib/post-draft"
import {
  buildLotteryConditionItem,
  buildNextLotteryConditionGroupKey,
} from "@/components/post/create-post-form.shared"

interface UseCreatePostLotteryOptions {
  draft: LocalPostDraft
  pointName: string
  setDraft: React.Dispatch<React.SetStateAction<LocalPostDraft>>
  updateDraftField: <Key extends keyof LocalPostDraft>(
    field: Key,
    value: LocalPostDraft[Key],
  ) => void
}

export function useCreatePostLottery({
  draft,
  pointName,
  setDraft,
  updateDraftField,
}: UseCreatePostLotteryOptions) {
  function updatePollOption(index: number, value: string) {
    updateDraftField(
      "pollOptions",
      draft.pollOptions.map((item, currentIndex) =>
        currentIndex === index ? value : item),
    )
  }

  function addPollOption() {
    if (draft.pollOptions.length < 8) {
      updateDraftField("pollOptions", [...draft.pollOptions, ""])
    }
  }

  function removePollOption(index: number) {
    if (draft.pollOptions.length > 2) {
      updateDraftField(
        "pollOptions",
        draft.pollOptions.filter((_, currentIndex) => currentIndex !== index),
      )
    }
  }

  function updateLotteryPrize(
    index: number,
    field: keyof LocalPostDraft["lotteryPrizes"][number],
    value: string,
  ) {
    updateDraftField(
      "lotteryPrizes",
      draft.lotteryPrizes.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item),
    )
  }

  function addLotteryPrize() {
    if (draft.lotteryPrizes.length < 20) {
      updateDraftField("lotteryPrizes", [
        ...draft.lotteryPrizes,
        { title: "", quantity: "1", description: "" },
      ])
    }
  }

  function removeLotteryPrize(index: number) {
    if (draft.lotteryPrizes.length > 1) {
      updateDraftField(
        "lotteryPrizes",
        draft.lotteryPrizes.filter((_, currentIndex) => currentIndex !== index),
      )
    }
  }

  function updateLotteryCondition(
    index: number,
    field: keyof LocalPostDraft["lotteryConditions"][number],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      lotteryConditions: current.lotteryConditions.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item
        }

        if (field === "type") {
          return {
            ...item,
            ...buildLotteryConditionItem(value, pointName, item.groupKey),
          }
        }

        return { ...item, [field]: value }
      }),
    }))
  }

  function addLotteryCondition(type = "REPLY_CONTENT_LENGTH", groupKey = "default") {
    setDraft((current) => {
      if (current.lotteryConditions.length >= 20) {
        return current
      }

      return {
        ...current,
        lotteryConditions: [
          ...current.lotteryConditions,
          buildLotteryConditionItem(type, pointName, groupKey),
        ],
      }
    })
  }

  function addLotteryConditionGroup() {
    setDraft((current) => {
      if (current.lotteryConditions.length >= 20) {
        return current
      }

      return {
        ...current,
        lotteryConditions: [
          ...current.lotteryConditions,
          buildLotteryConditionItem(
            "REPLY_CONTENT_LENGTH",
            pointName,
            buildNextLotteryConditionGroupKey(current.lotteryConditions),
          ),
        ],
      }
    })
  }

  function removeLotteryCondition(index: number) {
    setDraft((current) => {
      if (current.lotteryConditions.length <= 1) {
        return current
      }

      return {
        ...current,
        lotteryConditions: current.lotteryConditions.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      }
    })
  }

  function removeLotteryConditionGroup(groupKey: string) {
    setDraft((current) => {
      const remainingConditions = current.lotteryConditions.filter(
        (item) => item.groupKey !== groupKey,
      )
      if (remainingConditions.length === 0) {
        return current
      }

      return {
        ...current,
        lotteryConditions: remainingConditions,
      }
    })
  }

  return {
    updatePollOption,
    addPollOption,
    removePollOption,
    updateLotteryPrize,
    addLotteryPrize,
    removeLotteryPrize,
    updateLotteryCondition,
    addLotteryCondition,
    addLotteryConditionGroup,
    removeLotteryCondition,
    removeLotteryConditionGroup,
  }
}
