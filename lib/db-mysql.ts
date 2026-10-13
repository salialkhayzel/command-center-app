import mysql from "mysql2/promise"

let mysqlPool: mysql.Pool | null = null
let appMysqlPool: mysql.Pool | null = null

function baseConfig() {
  return {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    port: Number(process.env.MYSQL_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  }
}

export async function getMysqlDb() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      ...baseConfig(),
      database: process.env.MYSQL_DATABASE,
    })
  }
  return mysqlPool
}

export async function getAppMysqlDb() {
  if (!appMysqlPool) {
    appMysqlPool = mysql.createPool({
      ...baseConfig(),
      database: process.env.APP_MYSQL_DATABASE || process.env.MYSQL_DATABASE,
    })
  }
  return appMysqlPool
}
