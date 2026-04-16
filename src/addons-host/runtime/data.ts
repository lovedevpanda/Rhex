import "server-only"

import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import {
  ensureDirectory,
  fileExists,
  getAddonsStateDirectory,
  readJsonFile,
} from "@/addons-host/runtime/fs"
import type {
  AddonDataCollectionDefinition,
  AddonDataIndexDefinition,
  AddonDataQueryOptions,
  AddonDataQueryResult,
  AddonDataRecord,
} from "@/addons-host/types"

interface StoredAddonDataMeta {
  schemaVersion: number
  collections: Record<string, AddonDataCollectionDefinition>
}

interface StoredAddonDataCollectionFile {
  definition: AddonDataCollectionDefinition
  records: Record<string, AddonDataRecord<Record<string, unknown>>>
  indexes: Record<string, Record<string, string[]>>
}

const ADDON_DATA_DIRECTORY_NAME = "data"
const ADDON_DATA_META_FILE_NAME = "__meta.json"

let addonDataMutationQueue = Promise.resolve()

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeCollectionName(value: string) {
  const normalizedValue = normalizeOptionalString(value).toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(normalizedValue)) {
    throw new Error(`invalid addon data collection name "${value}"`)
  }

  return normalizedValue
}

function normalizeIndexDefinition(
  value: AddonDataIndexDefinition,
  collectionName: string,
  index: number,
): AddonDataIndexDefinition {
  const fields = Array.isArray(value.fields)
    ? value.fields
      .map((item) => normalizeOptionalString(item))
      .filter(Boolean)
    : []

  if (fields.length === 0) {
    throw new Error(
      `addon data index "${collectionName}:${index}" requires at least one field`,
    )
  }

  return {
    name: normalizeOptionalString(value.name)
      || `${collectionName}:idx:${index + 1}`,
    fields,
  }
}

function normalizeCollectionDefinition(
  definition: AddonDataCollectionDefinition,
): AddonDataCollectionDefinition {
  const name = normalizeCollectionName(definition.name)
  const indexes = Array.isArray(definition.indexes)
    ? definition.indexes.map((item, index) =>
      normalizeIndexDefinition(item, name, index))
    : []

  return {
    name,
    indexes,
    ttlDays:
      typeof definition.ttlDays === "number"
      && Number.isFinite(definition.ttlDays)
      && definition.ttlDays > 0
        ? Math.floor(definition.ttlDays)
        : null,
  }
}

function getAddonDataRootDirectory() {
  return path.join(
    getAddonsStateDirectory(),
    ADDON_DATA_DIRECTORY_NAME,
  )
}

function getAddonDataDirectory(addonId: string) {
  return path.join(getAddonDataRootDirectory(), addonId)
}

function getAddonDataMetaFilePath(addonId: string) {
  return path.join(getAddonDataDirectory(addonId), ADDON_DATA_META_FILE_NAME)
}

function getAddonCollectionFilePath(addonId: string, collectionName: string) {
  return path.join(
    getAddonDataDirectory(addonId),
    `${normalizeCollectionName(collectionName)}.json`,
  )
}

async function readAddonDataMeta(addonId: string): Promise<StoredAddonDataMeta> {
  const filePath = getAddonDataMetaFilePath(addonId)
  if (!(await fileExists(filePath))) {
    return {
      schemaVersion: 0,
      collections: {},
    }
  }

  try {
    const parsed = await readJsonFile<StoredAddonDataMeta>(filePath)
    return {
      schemaVersion:
        typeof parsed.schemaVersion === "number"
        && Number.isFinite(parsed.schemaVersion)
        && parsed.schemaVersion >= 0
          ? Math.floor(parsed.schemaVersion)
          : 0,
      collections:
        parsed.collections && typeof parsed.collections === "object"
          ? parsed.collections
          : {},
    }
  } catch {
    return {
      schemaVersion: 0,
      collections: {},
    }
  }
}

async function writeAddonDataMeta(
  addonId: string,
  payload: StoredAddonDataMeta,
) {
  await ensureDirectory(getAddonDataDirectory(addonId))
  await fs.writeFile(
    getAddonDataMetaFilePath(addonId),
    JSON.stringify(payload, null, 2),
    "utf8",
  )
}

async function readCollectionFile(
  addonId: string,
  collectionName: string,
): Promise<StoredAddonDataCollectionFile> {
  const filePath = getAddonCollectionFilePath(addonId, collectionName)
  if (!(await fileExists(filePath))) {
    return {
      definition: {
        name: normalizeCollectionName(collectionName),
        indexes: [],
        ttlDays: null,
      },
      records: {},
      indexes: {},
    }
  }

  try {
    const parsed = await readJsonFile<StoredAddonDataCollectionFile>(filePath)
    return {
      definition: normalizeCollectionDefinition(parsed.definition),
      records:
        parsed.records && typeof parsed.records === "object"
          ? parsed.records
          : {},
      indexes:
        parsed.indexes && typeof parsed.indexes === "object"
          ? parsed.indexes
          : {},
    }
  } catch {
    return {
      definition: {
        name: normalizeCollectionName(collectionName),
        indexes: [],
        ttlDays: null,
      },
      records: {},
      indexes: {},
    }
  }
}

async function writeCollectionFile(
  addonId: string,
  collectionName: string,
  payload: StoredAddonDataCollectionFile,
) {
  await ensureDirectory(getAddonDataDirectory(addonId))
  await fs.writeFile(
    getAddonCollectionFilePath(addonId, collectionName),
    JSON.stringify(payload, null, 2),
    "utf8",
  )
}

function runAddonDataMutation<T>(task: () => Promise<T>) {
  const run = addonDataMutationQueue.then(task, task)
  addonDataMutationQueue = run.then(() => undefined, () => undefined)
  return run
}

function stableSerializeIndexValue(value: unknown) {
  return JSON.stringify(value ?? null)
}

function buildIndexLookupKey(
  fields: string[],
  value: Record<string, unknown>,
) {
  return fields
    .map((field) => stableSerializeIndexValue(value[field]))
    .join("|")
}

function sortRecords(
  records: AddonDataRecord<Record<string, unknown>>[],
  sort: AddonDataQueryOptions["sort"],
) {
  if (!sort || sort.length === 0) {
    return [...records].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt, "zh-CN")
      || left.id.localeCompare(right.id, "zh-CN"))
  }

  return [...records].sort((left, right) => {
    for (const item of sort) {
      const direction = item.direction === "desc" ? -1 : 1
      const leftValue = left.value[item.field]
      const rightValue = right.value[item.field]
      const normalizedLeft = stableSerializeIndexValue(leftValue)
      const normalizedRight = stableSerializeIndexValue(rightValue)

      if (normalizedLeft === normalizedRight) {
        continue
      }

      return normalizedLeft.localeCompare(normalizedRight, "zh-CN") * direction
    }

    return left.id.localeCompare(right.id, "zh-CN")
  })
}

function filterRecords(
  records: AddonDataRecord<Record<string, unknown>>[],
  where?: Record<string, unknown>,
) {
  if (!where || Object.keys(where).length === 0) {
    return records
  }

  return records.filter((record) =>
    Object.entries(where).every(([field, expected]) =>
      stableSerializeIndexValue(record.value[field])
      === stableSerializeIndexValue(expected)))
}

function rebuildCollectionIndexes(
  definition: AddonDataCollectionDefinition,
  records: Record<string, AddonDataRecord<Record<string, unknown>>>,
) {
  const nextIndexes: Record<string, Record<string, string[]>> = {}

  for (const index of definition.indexes ?? []) {
    const indexName = normalizeOptionalString(index.name)
    const lookup: Record<string, string[]> = {}

    for (const record of Object.values(records)) {
      const lookupKey = buildIndexLookupKey(index.fields, record.value)
      lookup[lookupKey] = [...(lookup[lookupKey] ?? []), record.id]
    }

    nextIndexes[indexName] = lookup
  }

  return nextIndexes
}

function resolveQueryCandidateRecordIds(
  collection: StoredAddonDataCollectionFile,
  where?: Record<string, unknown>,
) {
  if (!where || Object.keys(where).length === 0) {
    return null
  }

  for (const index of collection.definition.indexes ?? []) {
    if (!index.fields.every((field) => field in where)) {
      continue
    }

    const lookupKey = buildIndexLookupKey(index.fields, where)
    const indexName = normalizeOptionalString(index.name)
    return collection.indexes[indexName]?.[lookupKey] ?? []
  }

  return null
}

function coerceRecordValue<TValue>(value: TValue) {
  return JSON.parse(JSON.stringify(value)) as TValue
}

function normalizeExpiresAt(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function isExpiredRecord(record: AddonDataRecord<Record<string, unknown>>) {
  return Boolean(record.expiresAt && record.expiresAt <= new Date().toISOString())
}

export async function ensureAddonDataCollection(
  addonId: string,
  definition: AddonDataCollectionDefinition,
) {
  const normalizedDefinition = normalizeCollectionDefinition(definition)

  return runAddonDataMutation(async () => {
    const [meta, existingCollection] = await Promise.all([
      readAddonDataMeta(addonId),
      readCollectionFile(addonId, normalizedDefinition.name),
    ])

    const nextCollection: StoredAddonDataCollectionFile = {
      definition: normalizedDefinition,
      records: existingCollection.records,
      indexes: rebuildCollectionIndexes(
        normalizedDefinition,
        existingCollection.records,
      ),
    }

    await Promise.all([
      writeAddonDataMeta(addonId, {
        ...meta,
        collections: {
          ...meta.collections,
          [normalizedDefinition.name]: normalizedDefinition,
        },
      }),
      writeCollectionFile(addonId, normalizedDefinition.name, nextCollection),
    ])

    return normalizedDefinition
  })
}

export async function getAddonDataRecord<TValue = Record<string, unknown>>(
  addonId: string,
  collectionName: string,
  recordId: string,
) {
  const normalizedCollectionName = normalizeCollectionName(collectionName)
  const collection = await readCollectionFile(addonId, normalizedCollectionName)
  const record = collection.records[recordId] ?? null

  if (!record || isExpiredRecord(record)) {
    return null
  }

  return record as AddonDataRecord<TValue>
}

export async function putAddonDataRecord<TValue = Record<string, unknown>>(
  addonId: string,
  collectionName: string,
  input: {
    id?: string
    value: TValue
    expiresAt?: string | Date | null
  },
) {
  const normalizedCollectionName = normalizeCollectionName(collectionName)

  return runAddonDataMutation(async () => {
    const [meta, collection] = await Promise.all([
      readAddonDataMeta(addonId),
      readCollectionFile(addonId, normalizedCollectionName),
    ])

    const definition = meta.collections[normalizedCollectionName]
      ? normalizeCollectionDefinition(meta.collections[normalizedCollectionName]!)
      : normalizeCollectionDefinition({
          name: normalizedCollectionName,
          indexes: collection.definition.indexes,
          ttlDays: collection.definition.ttlDays,
        })
    const now = new Date().toISOString()
    const id = normalizeOptionalString(input.id) || randomUUID()
    const existing = collection.records[id] ?? null
    const record: AddonDataRecord<TValue> = {
      id,
      value: coerceRecordValue(input.value),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt:
        normalizeExpiresAt(input.expiresAt)
        || (definition.ttlDays
          ? new Date(
            Date.now() + definition.ttlDays * 24 * 60 * 60 * 1000,
          ).toISOString()
          : null),
    }

    const nextRecords = {
      ...collection.records,
      [id]: record as AddonDataRecord<Record<string, unknown>>,
    }
    const nextCollection: StoredAddonDataCollectionFile = {
      definition,
      records: nextRecords,
      indexes: rebuildCollectionIndexes(definition, nextRecords),
    }

    await Promise.all([
      writeAddonDataMeta(addonId, {
        ...meta,
        collections: {
          ...meta.collections,
          [normalizedCollectionName]: definition,
        },
      }),
      writeCollectionFile(addonId, normalizedCollectionName, nextCollection),
    ])

    return record
  })
}

export async function deleteAddonDataRecord(
  addonId: string,
  collectionName: string,
  recordId: string,
) {
  const normalizedCollectionName = normalizeCollectionName(collectionName)

  return runAddonDataMutation(async () => {
    const collection = await readCollectionFile(addonId, normalizedCollectionName)
    if (!(recordId in collection.records)) {
      return false
    }

    const nextRecords = {
      ...collection.records,
    }
    delete nextRecords[recordId]

    await writeCollectionFile(addonId, normalizedCollectionName, {
      definition: collection.definition,
      records: nextRecords,
      indexes: rebuildCollectionIndexes(collection.definition, nextRecords),
    })

    return true
  })
}

export async function queryAddonDataRecords<TValue = Record<string, unknown>>(
  addonId: string,
  collectionName: string,
  options?: AddonDataQueryOptions,
): Promise<AddonDataQueryResult<TValue>> {
  const normalizedCollectionName = normalizeCollectionName(collectionName)
  const collection = await readCollectionFile(addonId, normalizedCollectionName)
  const candidateIds = resolveQueryCandidateRecordIds(collection, options?.where)
  const candidateRecords = candidateIds
    ? candidateIds
      .map((id) => collection.records[id])
      .filter(Boolean)
    : Object.values(collection.records)
  const nonExpiredRecords = candidateRecords.filter((record) => !isExpiredRecord(record))
  const filteredRecords = filterRecords(nonExpiredRecords, options?.where)
  const sortedRecords = sortRecords(filteredRecords, options?.sort)
  const offset = Number.isInteger(options?.offset) && Number(options?.offset) > 0
    ? Number(options?.offset)
    : 0
  const startIndex = options?.cursor
    ? Math.max(
      0,
      sortedRecords.findIndex((record) => record.id === options.cursor) + 1,
    )
    : offset
  const limit = Number.isInteger(options?.limit) && Number(options?.limit) > 0
    ? Math.min(100, Number(options?.limit))
    : 20
  const items = sortedRecords
    .slice(startIndex, startIndex + limit)
    .map((record) => record as AddonDataRecord<TValue>)
  const nextCursor =
    startIndex + limit < sortedRecords.length
      ? (items[items.length - 1]?.id ?? null)
      : null

  return {
    items,
    nextCursor,
    total: options?.includeTotal ? sortedRecords.length : null,
  }
}

export async function cleanupAddonDataCollection(
  addonId: string,
  collectionName?: string,
) {
  const normalizedCollectionNames = collectionName
    ? [normalizeCollectionName(collectionName)]
    : Object.keys((await readAddonDataMeta(addonId)).collections)
  let deletedCount = 0
  let scannedCount = 0

  await runAddonDataMutation(async () => {
    for (const name of normalizedCollectionNames) {
      const collection = await readCollectionFile(addonId, name)
      const nextRecords: Record<
        string,
        AddonDataRecord<Record<string, unknown>>
      > = {}

      for (const [recordId, record] of Object.entries(collection.records)) {
        scannedCount += 1
        if (isExpiredRecord(record)) {
          deletedCount += 1
          continue
        }

        nextRecords[recordId] = record
      }

      await writeCollectionFile(addonId, name, {
        definition: collection.definition,
        records: nextRecords,
        indexes: rebuildCollectionIndexes(collection.definition, nextRecords),
      })
    }
  })

  return {
    deletedCount,
    scannedCount,
  }
}

export async function getAddonDataSchemaVersion(addonId: string) {
  const meta = await readAddonDataMeta(addonId)
  return meta.schemaVersion
}

export async function setAddonDataSchemaVersion(addonId: string, version: number) {
  await runAddonDataMutation(async () => {
    const meta = await readAddonDataMeta(addonId)
    await writeAddonDataMeta(addonId, {
      ...meta,
      schemaVersion: Math.max(0, Math.floor(version)),
    })
  })
}

export async function deleteAddonDataStore(addonId: string) {
  const targetPath = getAddonDataDirectory(addonId)
  if (!(await fileExists(targetPath))) {
    return
  }

  await fs.rm(targetPath, {
    recursive: true,
    force: true,
  })
}
