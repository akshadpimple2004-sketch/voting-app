FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-privileged user
RUN groupadd -r flask && useradd -no-log-init -r -g flask flask

COPY app.py .

# Change ownership of the app directory to the flask user
RUN chown -R flask:flask /app

# Switch to the non-privileged user
USER flask

# Set Python environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=5001

EXPOSE 5001

# Run Flask using Gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "4", "--threads", "2", "app:app"]
