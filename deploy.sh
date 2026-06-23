#!/bin/bash
set -e

echo "=== Installing docker-compose ==="
sudo curl -sL 'https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64' -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "=== Setting up environment ==="
cd ~/book2audio

# Use EC2 instance IAM credentials (no keys needed)
cat > .env << 'EOF'
AWS_DEFAULT_REGION=us-east-1
EOF

# Update CORS to allow the public EC2 URL
export PUBLIC_URL="http://ec2-98-91-237-212.compute-1.amazonaws.com"

# Update docker-compose to pass ALLOWED_ORIGINS and set frontend API URL
cat > docker-compose.yml << YAML
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - AWS_DEFAULT_REGION=us-east-1
      - ALLOWED_ORIGINS=http://ec2-98-91-237-212.compute-1.amazonaws.com:3000,http://ec2-98-91-237-212.compute-1.amazonaws.com
    volumes:
      - audio_output:/app/output
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_API_URL: http://ec2-98-91-237-212.compute-1.amazonaws.com:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  audio_output:
YAML

echo "=== Building and starting containers ==="
sudo docker-compose up --build -d

echo "=== Waiting for services to start ==="
sleep 5
sudo docker-compose ps

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo "Frontend: http://ec2-98-91-237-212.compute-1.amazonaws.com:3000"
echo "Backend:  http://ec2-98-91-237-212.compute-1.amazonaws.com:8000"
