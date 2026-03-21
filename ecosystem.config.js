module.exports = {
  apps: [
    {
      name: 'genius-node',
      script: './src/server.js',
      cwd: './backend',
      env: { NODE_ENV: 'development', PORT: 4000 }
    },
    {
      name: 'genius-ai',
      interpreter: '/Users/dillip.behera/Downloads/ai-recruiter/.venv/bin/python',
      script: 'main.py',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      cwd: './ai-service', 
    },
    {
      name: 'genius-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
    }
  ]
};