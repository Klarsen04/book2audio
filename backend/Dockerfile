FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data /app/output

ENV DOCKER=1
ENV DATABASE_PATH=/app/data/book2audio.db

EXPOSE 8000

RUN useradd -U -u 1000 appuser && chown -R 1000:1000 /app
USER 1000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
