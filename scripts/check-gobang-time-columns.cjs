const { Client } = require("pg")

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres:123456@localhost:5432/bbs?schema=public",
  })

  await client.connect()

  const result = await client.query(`
    SELECT
      current_setting('TimeZone') AS timezone,
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name
    FROM information_schema.columns c
    CROSS JOIN LATERAL (SELECT 1) t
    WHERE c.table_name IN ('GobangMatch', 'GobangMove')
      AND c.column_name IN ('createdAt', 'updatedAt')
    ORDER BY c.table_name, c.column_name
  `)

  console.log(JSON.stringify(result.rows, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
