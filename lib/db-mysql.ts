import mysql from "mysql2/promise"

let mysqlPool: mysql.Pool | null = null

export async function getMysqlDb() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      port: Number(process.env.MYSQL_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  }
  return mysqlPool
}
