FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for network monitoring
RUN apt-get update && apt-get install -y \
    iproute2 \
    net-tools \
    procps \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
