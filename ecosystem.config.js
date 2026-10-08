module.exports = {
  apps: [
    {
      name: "command-center-app",
      cwd: __dirname,
      script: "server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "512M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 8888,
      },
    },
  ],
}
