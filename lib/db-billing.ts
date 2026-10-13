import sql from "mssql"

let billingPool: sql.ConnectionPool | null = null

export async function getBillingDb() {
  if (!billingPool) {
    billingPool = await new sql.ConnectionPool({
      server: process.env.BILLING_DB_SERVER || process.env.DB_SERVER || "",
      database: process.env.BILLING_DB_DATABASE || "",
      user: process.env.BILLING_DB_USER || process.env.DB_USER || "",
      password: process.env.BILLING_DB_PASSWORD || process.env.DB_PASSWORD || "",
      options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    }).connect()

    billingPool.on("error", () => {
      billingPool = null
    })
  }
  return billingPool
}

export { sql }
