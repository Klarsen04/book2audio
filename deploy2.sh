#!/bin/bash
set -e

echo "=== Installing Docker Compose plugin ==="
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -sL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "=== Adding swap (needed for builds on small instances) ==="
if [ ! -f /swapfile ]; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
fi

cd ~/book2audio

echo "=== Building backend ==="
sudo docker build -t book2audio-backend ./backend

echo "=== Building frontend ==="
sudo docker build --build-arg NEXT_PUBLIC_API_URL=http://ec2-98-91-237-212.compute-1.amazonaws.com:8000 -t book2audio-frontend ./frontend

echo "=== Stopping old containers ==="
sudo docker rm -f book2audio-backend book2audio-frontend 2>/dev/null || true

echo "=== Starting backend ==="
sudo docker run -d \
  --name book2audio-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  -e AWS_DEFAULT_REGION=us-east-1 \
  -e "ALLOWED_ORIGINS=http://ec2-98-91-237-212.compute-1.amazonaws.com:3000,http://ec2-98-91-237-212.compute-1.amazonaws.com" \
  -v audio_output:/app/output \
  book2audio-backend

echo "=== Starting frontend ==="
sudo docker run -d \
  --name book2audio-frontend \
  --restart unless-stopped \
  -p 3000:3000 \
  book2audio-frontend

echo "=== Checking containers ==="
sleep 3
sudo docker ps

echo ""
echo "========================================="
echo "DEPLOYMENT COMPLETE!"
echo "Frontend: http://ec2-98-91-237-212.compute-1.amazonaws.com:3000"
echo "Backend:  http://ec2-98-91-237-212.compute-1.amazonaws.com:8000"
echo "========================================="
