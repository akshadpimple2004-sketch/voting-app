import time
import json
import logging
import sys
import os
import signal
import redis
import psycopg2
from psycopg2 import OperationalError

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Configuration from Environment Variables
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)

POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = int(os.getenv('POSTGRES_PORT', 5432))
POSTGRES_DB = os.getenv('POSTGRES_DB', 'voting_db')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')

# Global variables for clean shutdown
running = True

def handle_shutdown(signum, frame):
    global running
    logging.info("Shutdown signal received. Stopping worker...")
    running = False

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

def connect_to_redis():
    """Connect to Redis with retry mechanism."""
    while running:
        try:
            logging.info(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}...")
            r = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                socket_timeout=5,
                decode_responses=True
            )
            r.ping()
            logging.info("Connected to Redis successfully!")
            return r
        except redis.ConnectionError as e:
            logging.error(f"Redis connection failed: {e}. Retrying in 5 seconds...")
            time.sleep(5)
    return None

def connect_to_postgres():
    """Connect to PostgreSQL with retry mechanism."""
    while running:
        try:
            logging.info(f"Connecting to PostgreSQL at {POSTGRES_HOST}:{POSTGRES_PORT}...")
            conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                database=POSTGRES_DB,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                connect_timeout=5
            )
            logging.info("Connected to PostgreSQL successfully!")
            return conn
        except OperationalError as e:
            logging.error(f"PostgreSQL connection failed: {e}. Retrying in 5 seconds...")
            time.sleep(5)
    return None

def init_db(conn):
    """Initialize database tables and indexes."""
    try:
        with conn.cursor() as cursor:
            # Create table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS votes (
                    id SERIAL PRIMARY KEY,
                    voter_id VARCHAR(50) UNIQUE NOT NULL,
                    vote VARCHAR(1) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Create index for query performance
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_votes_vote ON votes(vote);
            """)
            conn.commit()
            logging.info("Database initialized successfully.")
    except Exception as e:
        logging.error(f"Database initialization failed: {e}")
        conn.rollback()
        raise e

def main():
    global running
    logging.info("Starting Voting App Python Worker...")

    r_client = connect_to_redis()
    db_conn = connect_to_postgres()

    if not r_client or not db_conn:
        logging.error("Failed to establish required database connections. Exiting.")
        sys.exit(1)

    # Initialize DB schema
    init_db(db_conn)

    while running:
        try:
            # Check DB health (ping query)
            with db_conn.cursor() as cur:
                cur.execute("SELECT 1;")
        except (OperationalError, psycopg2.InterfaceError) as e:
            logging.error(f"PostgreSQL connection lost: {e}. Reconnecting...")
            db_conn = connect_to_postgres()
            if not db_conn:
                logging.error("Reconnection to PostgreSQL failed. Exiting.")
                sys.exit(1)
            continue

        try:
            # Perform blocking pop from Redis queue 'votes'
            # BRPOP returns a tuple: (list_key, value)
            vote_data = r_client.brpop('votes', timeout=3)
            
            if vote_data:
                _, raw_val = vote_data
                logging.info(f"Popped vote from queue: {raw_val}")
                
                try:
                    data = json.loads(raw_val)
                    vote = data.get('vote')
                    voter_id = data.get('voter_id')
                    
                    if not vote or vote not in ['A', 'B'] or not voter_id:
                        logging.warning(f"Invalid vote data: {data}")
                        continue
                    
                    # Upsert vote: Allow voter to update their vote choice
                    with db_conn.cursor() as cursor:
                        cursor.execute("""
                            INSERT INTO votes (voter_id, vote) 
                            VALUES (%s, %s) 
                            ON CONFLICT (voter_id) 
                            DO UPDATE SET vote = EXCLUDED.vote, created_at = CURRENT_TIMESTAMP;
                        """, (voter_id, vote))
                        db_conn.commit()
                        logging.info(f"Persisted vote '{vote}' for voter '{voter_id}' to Postgres.")
                except json.JSONDecodeError:
                    logging.error(f"Failed to decode JSON from queue: {raw_val}")
                except Exception as ex:
                    logging.error(f"Error persisting vote: {ex}")
                    db_conn.rollback()
                    
        except redis.ConnectionError:
            logging.error("Redis connection lost. Reconnecting...")
            r_client = connect_to_redis()
            if not r_client:
                logging.error("Reconnection to Redis failed. Exiting.")
                sys.exit(1)
        except Exception as e:
            logging.error(f"Unexpected error in worker loop: {e}")
            time.sleep(1)

    # Clean up on exit
    if db_conn:
        db_conn.close()
        logging.info("PostgreSQL connection closed.")
    logging.info("Worker stopped.")

if __name__ == '__main__':
    main()
