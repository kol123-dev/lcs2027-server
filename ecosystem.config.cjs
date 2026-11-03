// PM2 process definition for the LCS2027 campaign API.
// Managed by .github/workflows/deploy.yml; manual start: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "lcs2027-api",
      script: "src/index.js",
      cwd: "/var/www/lcs2027-server",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};