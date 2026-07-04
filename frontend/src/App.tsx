import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Rocket, Anchor, Vote, BarChart3, Shield, RefreshCw, Moon, CheckCircle2, AlertCircle } from 'lucide-react';
import './App.css';

interface VoteResults {
  A: number;
  B: number;
}

const API_BASE = '/api'; // Routed via Nginx reverse proxy

function App() {
  const [voterId, setVoterId] = useState<string>('');
  const [userVote, setUserVote] = useState<'A' | 'B' | null>(null);
  const [results, setResults] = useState<VoteResults>({ A: 0, B: 0 });
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Initialize Voter ID and previous vote
  useEffect(() => {
    let id = localStorage.getItem('voter_id');
    if (!id) {
      id = `voter-${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('voter_id', id);
    }
    setVoterId(id);

    const prevVote = localStorage.getItem('user_vote');
    if (prevVote === 'A' || prevVote === 'B') {
      setUserVote(prevVote as 'A' | 'B');
    }

    fetchResults();

    // Poll results every 3 seconds
    const interval = setInterval(fetchResultsSilent, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchResults = async () => {
    setSyncing(true);
    try {
      const response = await axios.get(`${API_BASE}/results`);
      if (response.data && response.data.success) {
        setResults(response.data.votes || { A: 0, B: 0 });
        setTotalVotes(response.data.total || 0);
        setConnected(true);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      setConnected(false);
    } finally {
      setSyncing(false);
    }
  };

  const fetchResultsSilent = async () => {
    try {
      const response = await axios.get(`${API_BASE}/results`);
      if (response.data && response.data.success) {
        setResults(response.data.votes || { A: 0, B: 0 });
        setTotalVotes(response.data.total || 0);
        setConnected(true);
      }
    } catch (error) {
      console.error('Silent fetch failed:', error);
      setConnected(false);
    }
  };

  const handleVote = async (option: 'A' | 'B') => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await axios.post(`${API_BASE}/vote`, {
        vote: option,
        voterId: voterId,
      });

      if (response.data && response.data.success) {
        setUserVote(option);
        localStorage.setItem('user_vote', option);
        setMessage({ text: `Success! You voted for Option ${option === 'A' ? 'Deep Space' : 'Deep Ocean'}!`, type: 'success' });
        // Immediately trigger results update
        fetchResults();
      }
    } catch (error: any) {
      console.error('Voting error:', error);
      setMessage({ 
        text: error.response?.data?.error || 'Failed to submit vote. Please try again.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate percentages
  const pctA = totalVotes > 0 ? Math.round((results.A / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? Math.round((results.B / totalVotes) * 100) : 50;

  return (
    <div className="app-container">
      {/* Background glowing blobs */}
      <div className="glow-blob blob-1"></div>
      <div className="glow-blob blob-2"></div>

      <header className="app-header">
        <div className="header-brand">
          <div className="logo-wrapper">
            <Vote className="logo-icon" />
          </div>
          <div>
            <h1>Democracy<span>Scale</span></h1>
            <p className="subtitle">Real-time cloud voting infrastructure</p>
          </div>
        </div>
        <div className="connection-status">
          <span className={`status-dot ${connected ? 'status-online' : 'status-offline'}`}></span>
          <span className="status-text">{connected ? 'Synced with AWS EC2' : 'Connection Interrupted'}</span>
          <button onClick={fetchResults} className={`refresh-btn ${syncing ? 'spinning' : ''}`} disabled={syncing}>
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* Core Question Card */}
        <section className="hero-section">
          <h2>Which frontier should humanity prioritize?</h2>
          <p className="hero-description">
            Cast your vote to shape the trajectory of science, innovation, and exploration. Powered by multi-container AWS infrastructure.
          </p>
        </section>

        {/* Messaging Area */}
        {message && (
          <div className={`message-banner ${message.type === 'success' ? 'msg-success' : 'msg-error'}`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Voting Options */}
        <div className="voting-grid">
          {/* Option A Card */}
          <div 
            onClick={() => !loading && handleVote('A')} 
            className={`voting-card card-option-a glow-option-a ${userVote === 'A' ? 'selected' : ''} ${loading ? 'card-disabled' : ''}`}
          >
            <div className="card-badge">Option A</div>
            <div className="card-icon-container">
              <Rocket size={42} className="card-icon icon-space" />
            </div>
            <h3>Deep Space Exploration</h3>
            <p>Colonize Mars, mine asteroids, and establish astronomical outposts to ensure our long-term multiplanetary survival.</p>
            <div className="card-footer">
              <span className="vote-action-btn">
                {userVote === 'A' ? 'You Voted' : 'Submit Vote'}
              </span>
            </div>
          </div>

          {/* Option B Card */}
          <div 
            onClick={() => !loading && handleVote('B')} 
            className={`voting-card card-option-b glow-option-b ${userVote === 'B' ? 'selected' : ''} ${loading ? 'card-disabled' : ''}`}
          >
            <div className="card-badge">Option B</div>
            <div className="card-icon-container">
              <Anchor size={42} className="card-icon icon-ocean" />
            </div>
            <h3>Deep Ocean Exploration</h3>
            <p>Unlock the secrets of Earth's abyss, harness marine resources, discover extremophiles, and protect ocean biomes.</p>
            <div className="card-footer">
              <span className="vote-action-btn">
                {userVote === 'B' ? 'You Voted' : 'Submit Vote'}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Dashboard Section */}
        <section className="results-section glass-panel">
          <div className="section-header">
            <div className="title-area">
              <BarChart3 className="section-icon" />
              <h3>Real-Time Analytics</h3>
            </div>
            <span className="live-pill">LIVE</span>
          </div>

          <div className="metric-row">
            <div className="metric-card">
              <span className="metric-label">Total Votes Processed</span>
              <span className="metric-val">{totalVotes}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Redis Cache Buffer</span>
              <span className="metric-val text-green">Active</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">PostgreSQL Database</span>
              <span className="metric-val text-indigo">Synced</span>
            </div>
          </div>

          {/* Graphical representation */}
          <div className="results-chart-container">
            <div className="chart-bar-wrapper">
              <div className="chart-labels">
                <span className="label-title"><Rocket size={14} style={{ marginRight: 6 }} /> Deep Space</span>
                <span className="label-val">{results.A} votes ({pctA}%)</span>
              </div>
              <div className="chart-track">
                <div 
                  className="chart-fill fill-option-a" 
                  style={{ width: `${pctA}%` }}
                ></div>
              </div>
            </div>

            <div className="chart-bar-wrapper">
              <div className="chart-labels">
                <span className="label-title"><Anchor size={14} style={{ marginRight: 6 }} /> Deep Ocean</span>
                <span className="label-val">{results.B} votes ({pctB}%)</span>
              </div>
              <div className="chart-track">
                <div 
                  className="chart-fill fill-option-b" 
                  style={{ width: `${pctB}%` }}
                ></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-security">
            <Shield size={14} />
            <span>Secure Voter Fingerprint: <code>{voterId.substring(0, 16)}...</code></span>
          </div>
          <p>© 2026 DevOps Voting Infrastructure Project. AWS EC2 Orchestrated.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
