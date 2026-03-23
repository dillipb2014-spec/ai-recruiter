module.exports = {
  apps: [
    {
      name: 'juspay-node',
      script: './src/server.js',
      cwd: './backend',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: { NODE_ENV: 'development', PORT: 4000 }
    },
    {
      name: 'juspay-ai',
      script: '/Users/dillip.behera/Downloads/ai-recruiter/.venv-1/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000',
      cwd: './ai-service',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: 'juspay-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    }
  ]
};