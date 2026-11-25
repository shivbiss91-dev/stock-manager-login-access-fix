module.exports = {
  apps: [
    {
      name: 'stockvista-server',
      script: 'server.js',
      instances: 1, // Single instance recommended for SQLite WAL write concurrency
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
      },
    },
  ],
};
