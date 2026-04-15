import { createRedisKey } from "@/lib/redis"

export const BACKGROUND_JOB_EXECUTION_LOG_RETENTION_SECONDS = 24 * 60 * 60
export const BACKGROUND_JOB_EXECUTION_LOG_RETENTION_MS = BACKGROUND_JOB_EXECUTION_LOG_RETENTION_SECONDS * 1_000
export const BACKGROUND_JOB_EXECUTION_LOG_KEY_EXPIRE_SECONDS = BACKGROUND_JOB_EXECUTION_LOG_RETENTION_SECONDS * 2

export function getBackgroundJobStreamKey() {
  return createRedisKey("background-jobs", "stream")
}

export function getBackgroundJobConsumerGroupName() {
  return createRedisKey("background-jobs", "group")
}

export function getBackgroundJobDelayedSetKey() {
  return createRedisKey("background-jobs", "delayed")
}

export function getBackgroundJobDeadLetterKey() {
  return createRedisKey("background-jobs", "dead-letter")
}

export function getBackgroundJobExecutionLogKey() {
  return createRedisKey("background-jobs", "execution-log")
}
