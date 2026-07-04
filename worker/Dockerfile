FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for compiling psycopg2 if binary fails
# (though psycopg2-binary usually doesn't need them, we keep it light)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-privileged user and group to run the app
RUN groupadd -r worker && useradd -no-log-init -r -g worker worker

COPY worker.py .

# Change ownership of the app directory to non-root user
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

ENV PYTHONUNBUFFERED=1

CMD ["python", "worker.py"]
