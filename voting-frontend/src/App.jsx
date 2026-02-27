import { useState, useEffect } from 'react'
import axios from 'axios'
import { ethers } from 'ethers'
import './App.css'

// Contract address - Update this after deployment
const CONTRACT_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3'

// Minimal ABI for the ElectionSystem contract
const CONTRACT_ABI = [
  "function candidatesCount() view returns (uint256)",
  "function candidates(uint256) view returns (uint id, string name, string party, string constituency, uint boothId, uint voteCount)",
  "function vote(uint _candidateId) nonpayable",
  "function hasVoted(address) view returns (bool)"
]

function App() {
  const [voterId, setVoterId] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState(1) 
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('') // 'success' or 'error'
  const [voterData, setVoterData] = useState(null)
  
  // Blockchain state
  const [candidates, setCandidates] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [isVoting, setIsVoting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  // Connect to blockchain
  const connectWallet = async () => {
    setIsConnecting(true)
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        setWalletAddress(address)
        
        // Check if this address has voted
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
        const voted = await contract.hasVoted(address)
        setHasVoted(voted)
      } else {
        setMessage('Please install MetaMask to connect to the blockchain!')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      setMessage('Error connecting to wallet. Make sure MetaMask is installed.')
      setMessageType('error')
    }
    setIsConnecting(false)
  }

  // Fetch candidates from smart contract
  const fetchCandidates = async () => {
    try {
      const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const count = await contract.candidatesCount()
      const candidateList = []
      for (let i = 1n; i <= count; i++) {
        const c = await contract.candidates(i)
        candidateList.push({
          id: Number(i) - 1,
          name: c.name,
          party: c.party,
          constituency: c.constituency,
          voteCount: c.voteCount.toString()
        })
      }
      setCandidates(candidateList)
    } catch (error) {
      console.error('Error fetching candidates:', error)
      setMessage('Could not fetch candidates. Make sure the contract is deployed and Hardhat is running.')
      setMessageType('error')
    }
  }

  // Load candidates when component mounts
  useEffect(() => {
    fetchCandidates()
  }, [])

  // Refresh vote counts
  const refreshVotes = async () => {
    await fetchCandidates()
  }

  const requestOtp = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/request-otp', { voterId })
      if (response.data.success) {
        setMessage('OTP sent to your registered number.')
        setMessageType('success')
        setStep(2)
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error requesting OTP')
      setMessageType('error')
    }
  }

  const verifyOtp = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/verify-otp', { voterId, otp })
      if (response.data.success) {
        setMessage('Authentication successful.')
        setMessageType('success')
        setVoterData(response.data.voter)
        setStep(3)
        // Auto-connect wallet after authentication
        setTimeout(connectWallet, 500)
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Invalid OTP')
      setMessageType('error')
    }
  }

  // Cast vote on blockchain
  const castVote = async () => {
    if (selectedCandidate === null) {
      setMessage('Please select a candidate first!')
      setMessageType('error')
      return
    }

    setIsVoting(true)
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      
      const tx = await contract.vote(selectedCandidate + 1)
      setMessage('Transaction submitted! Waiting for confirmation...')
      setMessageType('success')
      
      await tx.wait()
      
      setMessage('Vote cast successfully! Your vote has been recorded on the blockchain.')
      setMessageType('success')
      setHasVoted(true)
      
      // Refresh vote counts
      await refreshVotes()
      
      // Clear selection
      setSelectedCandidate(null)
    } catch (error) {
      console.error('Error casting vote:', error)
      if (error.reason) {
        setMessage(`Error: ${error.reason}`)
      } else if (error.message.includes('user rejected')) {
        setMessage('Transaction rejected by user.')
      } else {
        setMessage('Error casting vote. You may have already voted or the transaction failed.')
      }
      setMessageType('error')
    }
    setIsVoting(false)
  }

  const renderMessage = () => {
    if (!message) return null
    return (
      <div className={`message ${messageType}`}>
        {message}
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🗳️ TrustVote - Decentralized Voting System</h1>
        {walletAddress && (
          <div className="wallet-info">
            <span>Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            {hasVoted && <span className="voted-badge">✓ Already Voted</span>}
          </div>
        )}
      </header>

      {renderMessage()}

      {step === 1 && (
        <div className="step-container">
          <div className="card">
            <h2>Step 1: Voter Authentication</h2>
            <p>Enter your Voter ID to begin the authentication process.</p>
            <div className="input-group">
              <input 
                type="text" 
                placeholder="Enter Voter ID (e.g., VOTER123)" 
                value={voterId} 
                onChange={(e) => setVoterId(e.target.value)}
              />
              <button onClick={requestOtp} className="btn-primary">Get OTP</button>
            </div>
            <p className="hint">Hint: Use VOTER123 or VOTER456</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-container">
          <div className="card">
            <h2>Step 2: OTP Verification</h2>
            <p>Enter the 6-digit OTP sent to your registered phone.</p>
            <div className="input-group">
              <input 
                type="text" 
                placeholder="Enter 6-digit OTP" 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
              <button onClick={verifyOtp} className="btn-primary">Verify and Login</button>
            </div>
            <p className="hint">Check the backend console for the OTP</p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-container">
          <div className="welcome-card">
            <h2>Welcome, {voterData?.name} 👋</h2>
            <p>Your Constituency: <strong>{voterData?.constituency}</strong></p>
          </div>

          {/* Digital Ballot */}
          <div className="card">
            <div className="card-header">
              <h3>🗳️ Digital Ballot</h3>
              <button onClick={refreshVotes} className="btn-secondary btn-small">🔄 Refresh</button>
            </div>
            
            {!walletAddress && (
              <div className="connect-wallet">
                <p>Connect your wallet to cast a vote:</p>
                <button onClick={connectWallet} className="btn-primary" disabled={isConnecting}>
                  {isConnecting ? 'Connecting...' : 'Connect Wallet (MetaMask)'}
                </button>
              </div>
            )}

            {walletAddress && hasVoted && (
              <div className="already-voted">
                <p>✅ You have already cast your vote on the blockchain!</p>
              </div>
            )}

            {walletAddress && !hasVoted && candidates.length > 0 && (
              <div className="candidates-list">
                {candidates.map((candidate) => (
                  <div 
                    key={candidate.id}
                    className={`candidate-card ${selectedCandidate === candidate.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCandidate(candidate.id)}
                  >
                    <div className="candidate-info">
                      <span className="candidate-name">{candidate.name}</span>
                    </div>
                    <div className="vote-count">
                      <span className="count">{candidate.voteCount}</span>
                      <span className="label">votes</span>
                    </div>
                  </div>
                ))}
                
                {selectedCandidate !== null && (
                  <div className="vote-action">
                    <p>You selected: <strong>{candidates[selectedCandidate]?.name}</strong></p>
                    <button 
                      onClick={castVote} 
                      className="btn-vote"
                      disabled={isVoting}
                    >
                      {isVoting ? 'Confirming...' : '🗳️ Cast Vote'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {candidates.length === 0 && (
              <p className="no-candidates">No candidates available. Please add candidates first.</p>
            )}
          </div>

          {/* Live Results */}
          <div className="card">
            <div className="card-header">
              <h3>📊 Live Election Results</h3>
              <button onClick={refreshVotes} className="btn-secondary btn-small">🔄 Refresh</button>
            </div>
            <div className="results-chart">
              {candidates.map((candidate) => {
                const maxVotes = Math.max(...candidates.map(c => parseInt(c.voteCount)), 1)
                const percentage = (parseInt(candidate.voteCount) / maxVotes) * 100
                return (
                  <div key={candidate.id} className="result-bar-container">
                    <div className="result-label">
                      <span>{candidate.name}</span>
                      <span>{candidate.voteCount} votes</span>
                    </div>
                    <div className="result-bar">
                      <div 
                        className="result-fill" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h3>📥 Download Documents</h3>
            <div className="action-buttons">
              <button onClick={() => {
                axios.get(`http://localhost:5000/api/download-receipt/${voterId}`, {
                  responseType: 'blob'
                }).then(response => {
                  const url = window.URL.createObjectURL(new Blob([response.data]))
                  const link = document.createElement('a')
                  link.href = url
                  link.setAttribute('download', `Voter_Receipt_${voterId}.pdf`)
                  document.body.appendChild(link)
                  link.click()
                  link.parentNode.removeChild(link)
                  setMessage('Voter receipt downloaded!')
                  setMessageType('success')
                }).catch(() => {
                  setMessage('Error downloading receipt')
                  setMessageType('error')
                })
              }} className="btn-download">
                📄 Download Voter Receipt
              </button>
              
              <button onClick={() => {
                axios.get('http://localhost:5000/api/download-results', {
                  responseType: 'blob'
                }).then(response => {
                  const url = window.URL.createObjectURL(new Blob([response.data]))
                  const link = document.createElement('a')
                  link.href = url
                  link.setAttribute('download', 'Election_Results_Report.pdf')
                  document.body.appendChild(link)
                  link.click()
                  link.parentNode.removeChild(link)
                  setMessage('Election results downloaded!')
                  setMessageType('success')
                }).catch(() => {
                  setMessage('Error downloading results')
                  setMessageType('error')
                })
              }} className="btn-download btn-green">
                📊 Download Results PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
