const { createServer } = require("http")
const next = require("next")

const port = parseInt(process.env.PORT || "8888", 10)
const host = process.env.HOST || "0.0.0.0"

const app = next({ dev: false, dir: __dirname })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, host, () => {
      console.log(`> command-center-app ready on http://${host}:${port}`)
    })
  })
  .catch((err) => {
    console.error("Failed to start Next.js server:", err)
    process.exit(1)
  })
