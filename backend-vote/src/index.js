const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const client = require('prom-client');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Initialize Redis Client
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || null;

const redisConfig = {
  host: redisHost,
  port: redisPort,
};

if (redisPassword) {
  redisConfig.password = redisPassword;
}

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('Connected to Redis successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Prometheus Metrics Setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Custom Metrics
const voteCounter = new client.Counter({
  name: 'voting_app_votes_total',
  help: 'Total number of votes submitted',
  labelNames: ['option'],
});

const httpRequestsCounter = new client.Counter({
  name: 'voting_app_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = new client.Histogram({
  name: 'voting_app_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5],
});

// Middleware to track HTTP metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const status = res.statusCode;
    
    httpRequestsCounter.inc({ method: req.method, route, status });
    httpRequestDuration.observe({ method: req.method, route, status }, duration);
  });
  next();
});

// Vote Submission API
app.post('/api/vote', async (req, res) => {
  const { vote, voterId } = req.body;

  if (!vote || !['A', 'B'].includes(vote)) {
    return res.status(400).json({ error: 'Invalid vote. Must be "A" or "B".' });
  }

  const voter = voterId || `voter-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const payload = JSON.stringify({
      vote,
      voter_id: voter,
      timestamp: new Date().toISOString()
    });

    // Push vote to the 'votes' queue
    await redis.lpush('votes', payload);

    // Track vote metric
    voteCounter.inc({ option: vote });

    console.log(`Vote registered: Option ${vote} from Voter ${voter}`);
    return res.status(200).json({ 
      success: true, 
      message: 'Vote submitted successfully!', 
      voterId: voter 
    });
  } catch (error) {
    console.error('Failed to save vote in queue:', error);
    return res.status(500).json({ error: 'Database queue is temporarily unavailable.' });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const redisStatus = redis.status;
    if (redisStatus === 'ready') {
      return res.status(200).json({ status: 'healthy', redis: 'connected' });
    } else {
      return res.status(503).json({ status: 'unhealthy', redis: redisStatus });
    }
  } catch (error) {
    return res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

app.listen(port, () => {
  console.log(`Voting API listening at http://localhost:${port}`);
});
