#!/bin/bash
# Auto-commit and push every 5 minutes
while true; do
  cd /Users/dillip.behera/Downloads/ai-recruiter
  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add -A
    git commit -m "auto: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main
    echo "✅ Pushed at $(date '+%H:%M:%S')"
  else
    echo "⏳ No changes at $(date '+%H:%M:%S')"
  fi
  sleep 300
done
