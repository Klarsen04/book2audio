#!/bin/bash
# ffmpeg comes from the environment: the Dockerfile installs it for Docker
# deploys, and Render's native runtime ships it in the base image. (An apt-get
# here can't work — Render builds run unprivileged.)

# Install Python dependencies
pip install -r requirements.txt
