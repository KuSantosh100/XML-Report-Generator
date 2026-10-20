#!/bin/bash
# SQA Report Studio Launcher
cd "$(dirname "$0")/sqa_automation-node"

echo "=========================================================="
echo " Starting SQA Report Studio..."
echo " Node version: $(node -v)"
echo " Server URL:   http://localhost:3000"
echo "=========================================================="

npm run web
