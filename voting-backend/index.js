const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Twilio SMS Configuration
const twilio = require('twilio');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Only initialize Twilio if we have valid credentials (not placeholder values)
let client;
const isTwilioConfigured = accountSid && authToken && twilioPhoneNumber && 
                          accountSid.startsWith('AC') && 
                          !accountSid.includes('your_');

if (isTwilioConfigured) {
    try {
        client = twilio(accountSid, authToken);
        console.log('✓ Twilio SMS service initialized successfully');
    } catch (error) {
        console.warn('⚠ Twilio initialization failed:', error.message);
        console.warn('ℹ Backend will run in mock mode (SMS logs to console)');
        client = null;
    }
} else {
    console.log('ℹ Twilio credentials not configured. Running in mock SMS mode.');
    console.log('ℹ To enable real SMS, configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env');
}

// Middleware
app.use(cors());
app.use(express.json()); // Allows us to parse JSON data from frontend requests

// --- MOCK VOTER DATABASE ---
// In a real system, this would be linked to a verified government database.
const votersDB = {
    "VOTER123": { name: "Rahul Sharma", constituency: "North District", hasVoted: false, phone: "555-0101" },
    "VOTER456": { name: "Priya Patel", constituency: "South District", hasVoted: false, phone: "555-0202" }
};

// Temporary storage for our generated OTPs
const otpStorage = {};

// --- MOCK CANDIDATES DATABASE ---
// In a real system, this would come from the election database
const candidatesDB = {
    1: { id: 1, name: "Alice Sharma", party: "Tech Party", constituency: "North District", voteCount: 0 },
    2: { id: 2, name: "Bob Singh", party: "Devs United", constituency: "North District", voteCount: 0 },
    3: { id: 3, name: "Carol Patel", party: "Innovation League", constituency: "South District", voteCount: 0 },
    4: { id: 4, name: "David Kumar", party: "Tech Party", constituency: "South District", voteCount: 0 }
};

// Vote storage - stores encrypted votes (mapped by voter ID)
// Format: { voterId: { candidateId: 3, timestamp: ..., encrypted: true, hash: ... } }
const votesDB = {};

// Encryption key (in production, use a secure key management system like AWS KMS)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-insecure-key-change-in-production-32!!';

// --- VOTE ENCRYPTION UTILITIES ---
/**
 * Encrypt a vote using simple encryption (for demo purposes)
 * In production, use industry-standard encryption like AES-256
 */
function encryptVote(candidateId, voterId) {
    const voteData = JSON.stringify({ candidateId, voterId, timestamp: Date.now() });
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(voteData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

/**
 * Decrypt a vote
 */
function decryptVote(encryptedVote) {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedVote, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

/**
 * Create a hash of the vote for verification
 */
function hashVote(candidateId, voterId) {
    return crypto.createHash('sha256')
        .update(`${candidateId}-${voterId}-${Date.now()}`)
        .digest('hex');
}

// --- ROUTES ---

// 1. Route to check Voter ID and generate OTP
app.post('/api/request-otp', async (req, res) => {
    const { voterId } = req.body;

    // Check if voter exists in our database
    if (!votersDB[voterId]) {
        return res.status(404).json({ success: false, message: "Voter ID not found." });
    }

    // Generate a simple 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store it temporarily (Valid for 5 minutes)
    otpStorage[voterId] = {
        otp: otp,
        expiresAt: Date.now() + 5 * 60 * 1000 
    };

    const voter = votersDB[voterId];
    const phoneNumber = voter.phone;

    // Send OTP via Twilio SMS
    if (isTwilioConfigured && client) {
        try {
            // Format phone number if it's in the format "555-0101", add country code
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/-/g, '')}`;
            
            await client.messages.create({
                body: `Your TrustVote verification code is: ${otp}. This code will expire in 5 minutes.`,
                from: twilioPhoneNumber,
                to: formattedPhone
            });
            
            console.log(`[SMS SENT] OTP ${otp} sent successfully to ${phoneNumber} for Voter ${voterId}`);
            res.json({ success: true, message: "OTP sent successfully via SMS." });
        } catch (error) {
            console.error(`[SMS ERROR] Failed to send OTP to ${phoneNumber}:`, error.message);
            // Fall back to mock SMS if Twilio fails
            console.log(`[SMS MOCK FALLBACK] Sending OTP ${otp} to phone number ${phoneNumber} for Voter ${voterId}`);
            res.json({ success: true, message: "OTP prepared (SMS service unavailable, using mock mode)." });
        }
    } else {
        // Use mock SMS if Twilio credentials are not configured
        console.log(`\n[SMS MOCK] Sending OTP ${otp} to phone number ${phoneNumber} for Voter ${voterId}`);
        res.json({ success: true, message: "OTP sent successfully (mock mode)." });
    }
});

// 2. Route to verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { voterId, otp } = req.body;

    // Check if voter exists
    if (!votersDB[voterId]) {
        return res.status(404).json({ success: false, message: "Voter ID not found." });
    }

    // Check if OTP exists for this voter
    if (!otpStorage[voterId]) {
        return res.status(400).json({ success: false, message: "OTP not requested or has expired." });
    }

    // Check if OTP has expired
    if (Date.now() > otpStorage[voterId].expiresAt) {
        delete otpStorage[voterId];
        return res.status(400).json({ success: false, message: "OTP has expired." });
    }

    // Verify OTP
    if (otpStorage[voterId].otp !== otp) {
        return res.status(400).json({ success: false, message: "OTP is invalid." });
    }

    // OTP is valid, remove it from storage
    delete otpStorage[voterId];

    res.json({ 
        success: true, 
        message: "OTP verified successfully.",
        voter: votersDB[voterId]
    });
});

// 3. Route to get all candidates
app.get('/api/candidates', (req, res) => {
    try {
        const candidates = Object.values(candidatesDB).map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            party: candidate.party,
            constituency: candidate.constituency
        }));
        res.json({ success: true, candidates });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ success: false, message: 'Error fetching candidates' });
    }
});

// 4. Route to cast a vote (encrypted and stored)
app.post('/api/cast-vote', (req, res) => {
    const { voterId, walletAddress, candidateId } = req.body;

    try {
        // Validate input
        if (!voterId || !walletAddress || !candidateId) {
            return res.status(400).json({ success: false, message: "Missing required fields: voterId, walletAddress, candidateId" });
        }

        // Check if voter exists
        if (!votersDB[voterId]) {
            return res.status(404).json({ success: false, message: "Voter not found" });
        }

        // Check if candidate exists
        if (!candidatesDB[candidateId]) {
            return res.status(400).json({ success: false, message: "Invalid candidate ID" });
        }

        // Check if voter has already voted
        if (votesDB[voterId]) {
            return res.status(400).json({ success: false, message: "This voter has already cast their vote" });
        }

        // Encrypt the vote
        const encryptedVote = encryptVote(candidateId, voterId);
        const voteHash = hashVote(candidateId, voterId);

        // Store the vote
        votesDB[voterId] = {
            candidateId: candidateId,
            walletAddress: walletAddress,
            timestamp: Date.now(),
            encrypted: encryptedVote,
            hash: voteHash,
            status: 'pending' // pending -> confirmed on blockchain
        };

        // Update candidate vote count
        candidatesDB[candidateId].voteCount++;

        // Mark voter as having voted
        votersDB[voterId].hasVoted = true;

        console.log(`[VOTE CAST] Vote recorded for Voter ${voterId} - Candidate ${candidateId} (${candidatesDB[candidateId].name})`);
        console.log(`[ENCRYPTED] Vote hash: ${voteHash}`);

        res.json({ 
            success: true, 
            message: "Vote cast successfully and stored securely", 
            voteHash: voteHash,
            candidateName: candidatesDB[candidateId].name
        });
    } catch (error) {
        console.error('Error casting vote:', error);
        res.status(500).json({ success: false, message: 'Error casting vote', error: error.message });
    }
});

// 5. Route to get election results
app.get('/api/get-results', (req, res) => {
    try {
        const results = Object.values(candidatesDB).map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            party: candidate.party,
            constituency: candidate.constituency,
            voteCount: candidate.voteCount
        })).sort((a, b) => b.voteCount - a.voteCount);

        const totalVotes = Object.keys(votesDB).length;

        res.json({ 
            success: true, 
            results: results,
            totalVotes: totalVotes,
            totalCandidate: Object.keys(candidatesDB).length
        });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ success: false, message: 'Error fetching results' });
    }
});

// 6. Route to verify vote on blockchain (for monitoring)
app.post('/api/verify-vote', (req, res) => {
    const { voterId } = req.body;

    try {
        if (!votesDB[voterId]) {
            return res.status(404).json({ success: false, message: "Vote not found for this voter" });
        }

        const vote = votesDB[voterId];
        res.json({ 
            success: true, 
            voteHash: vote.hash,
            timestamp: vote.timestamp,
            status: vote.status,
            walletAddress: vote.walletAddress
        });
    } catch (error) {
        console.error('Error verifying vote:', error);
        res.status(500).json({ success: false, message: 'Error verifying vote' });
    }
});

// 7. Route to download voter receipt PDF
app.get('/api/download-receipt/:voterId', (req, res) => {
    const { voterId } = req.params;

    // Check if voter exists
    if (!votersDB[voterId]) {
        return res.status(404).json({ success: false, message: "Voter ID not found." });
    }

    const voter = votersDB[voterId];
    
    // Create a PDF document
    const doc = new PDFDocument();
    const filename = `Voter_Receipt_${voterId}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('Voter Authentication Receipt', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Voter ID: ${voterId}`, { width: 500 });
    doc.text(`Name: ${voter.name}`, { width: 500 });
    doc.text(`Constituency: ${voter.constituency}`, { width: 500 });
    doc.text(`Phone: ${voter.phone}`, { width: 500 });
    doc.moveDown();
    
    doc.text(`Authentication Date: ${new Date().toLocaleString()}`, { width: 500 });
    doc.text(`Status: Successfully Verified`, { width: 500 });
    
    doc.moveDown();
    doc.fontSize(10).text('This receipt confirms your successful authentication to the Decentralized Voting System.', { align: 'center' });
    
    doc.end();
});

// 8. Route to download election results PDF
app.get('/api/download-results', (req, res) => {
    const doc = new PDFDocument();
    const filename = `Election_Results_${new Date().getTime()}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Get actual election results from candidatesDB
    const results = Object.values(candidatesDB)
        .sort((a, b) => b.voteCount - a.voteCount)
        .map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            party: candidate.party,
            votes: candidate.voteCount
        }));

    const totalVotes = Object.keys(votesDB).length;

    // Add content to PDF
    doc.fontSize(18).text('Official Election Results Report', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'left' });
    doc.text(`System: Decentralized Voting System`, { align: 'left' });
    doc.text(`Total Votes Cast: ${totalVotes}`, { align: 'left' });
    doc.moveDown();

    // Add table header
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Candidate Results:', { underline: true });
    doc.moveDown(0.5);

    // Add results
    doc.fontSize(10).font('Helvetica');
    results.forEach(candidate => {
        const percentage = totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(2) : 0;
        doc.text(`${candidate.id}. ${candidate.name} (${candidate.party}): ${candidate.votes} votes (${percentage}%)`, { width: 500 });
    });

    doc.moveDown();
    doc.fontSize(9).text('This report is generated from the decentralized voting blockchain.', { align: 'center', italic: true });
    
    doc.end();
});

// Start the server
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});