module.exports = {
  apps: [
    {
      name: 'seo-backend',
      cwd: './backend',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4800,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'seo-crawler',
      cwd: './crawler',
      script: 'run.py',
      interpreter: 'python3',
      env: {
        PORT: 4801,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/crawler-error.log',
      out_file: './logs/crawler-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
