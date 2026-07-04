import os
import sys
import logging
from flask import Flask, jsonify, Response
from flask_cors import CORS
import psycopg2
from psycopg2 import OperationalError, ProgrammingError
from prometheus_client import generate_latest, Counter, Histogram, CONTENT_TYPE_LATEST

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Postgres Connection parameters
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = int(os.getenv('POSTGRES_PORT', 5432))
POSTGRES_DB = os.getenv('POSTGRES_DB', 'voting_db')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')

# Prometheus metrics setup
REQUEST_COUNT = Counter(
    'results_api_requests_total',
    'Total requests to Results API',
    ['method', 'endpoint', 'http_status']
)
REQUEST_LATENCY = Histogram(
    'results_api_request_duration_seconds',
    'Time spent processing Results API requests',
    ['method', 'endpoint']
)

def get_db_connection():
    """Establish a connection to the PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            connect_timeout=3
        )
        return conn
    except OperationalError as e:
        logging.error(f"Error connecting to PostgreSQL: {e}")
        return None

@app.route('/api/results', methods=['GET'])
@REQUEST_LATENCY.labels(method='GET', endpoint='/api/results').time()
def get_results():
    conn = get_db_connection()
    if not conn:
        REQUEST_COUNT.labels(method='GET', endpoint='/api/results', http_status=500).inc()
        return jsonify({
            "success": false,
            "error": "Database connection unavailable."
        }), 500

    votes = {'A': 0, 'B': 0}
    total = 0

    try:
        with conn.cursor() as cursor:
            # Query vote counts grouped by option
            cursor.execute("SELECT vote, COUNT(*) FROM votes GROUP BY vote;")
            rows = cursor.fetchall()
            for row in rows:
                vote_opt = row[0]
                vote_count = row[1]
                if vote_opt in votes:
                    votes[vote_opt] = vote_count
            
            total = sum(votes.values())
        
        conn.close()
        REQUEST_COUNT.labels(method='GET', endpoint='/api/results', http_status=200).inc()
        return jsonify({
            "success": True,
            "votes": votes,
            "total": total
        })

    except ProgrammingError as e:
        # If the table doesn't exist yet, return 0 votes instead of failing
        logging.warning(f"Database table query error (possibly table doesn't exist yet): {e}")
        conn.close()
        REQUEST_COUNT.labels(method='GET', endpoint='/api/results', http_status=200).inc()
        return jsonify({
            "success": True,
            "votes": votes,
            "total": total,
            "note": "Database initialized, waiting for first votes."
        })
    except Exception as e:
        logging.error(f"Error fetching results from database: {e}")
        conn.close()
        REQUEST_COUNT.labels(method='GET', endpoint='/api/results', http_status=500).inc()
        return jsonify({
            "success": False,
            "error": "Failed to retrieve results."
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    conn = get_db_connection()
    if conn:
        conn.close()
        return jsonify({"status": "healthy", "database": "connected"}), 200
    else:
        return jsonify({"status": "unhealthy", "database": "disconnected"}), 503

@app.route('/metrics', methods=['GET'])
def metrics():
    # Generate Prometheus scrape data
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
