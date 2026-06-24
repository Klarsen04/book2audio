#!/bin/bash
# Install system dependencies
apt-get update && apt-get install -y ffmpeg 2>/dev/null || true

# Install Python dependencies
pip install -r requirements.txt
