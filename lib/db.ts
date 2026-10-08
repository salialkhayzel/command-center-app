import sql from "mssql"

let pool: sql.ConnectionPool | null = null

async function initPool() {
  const poolInstance = new sql.ConnectionPool({
    server: process.env.DB_SERVER || "",
    database: process.env.DB_DATABASE || "",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 15000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  })

  poolInstance.on("error", (err) => {
    console.error("SQL Pool Error:", err)
    pool = null
  })

  await poolInstance.connect()
  pool = poolInstance
}

export async function getDb() {
  if (!pool) {
    await initPool()
  }
  return { sql, pool: pool! }
}

export { sql }
