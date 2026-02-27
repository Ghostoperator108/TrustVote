const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

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

// --- ROUTES ---

// 1. Route to check Voter ID and generate OTP
app.post('/api/request-otp', (req, res) => {
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

    // For this PoC, we will just log the OTP to the console instead of setting up a real SMS gateway like Twilio.
    console.log(`\n[SMS MOCK] Sending OTP ${otp} to phone number ${votersDB[voterId].phone} for Voter ${voterId}`);

    res.json({ success: true, message: "OTP sent successfully." });
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

// 3. Route to download voter receipt PDF
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

// 4. Route to download election results PDF
app.get('/api/download-results', (req, res) => {
    const doc = new PDFDocument();
    const filename = `Election_Results_${new Date().getTime()}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Mock election results (same as frontend)
    const mockResults = [
        { id: 1, name: "Alice Sharma", party: "Tech Party", votes: 150 },
        { id: 2, name: "Bob Singh", party: "Devs United", votes: 120 }
    ];

    // Add content to PDF
    doc.fontSize(18).text('Official Election Results Report', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'left' });
    doc.text(`System: Decentralized Voting System`, { align: 'left' });
    doc.moveDown();

    // Add table header
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Candidate Results:', { underline: true });
    doc.moveDown(0.5);

    // Add results
    doc.fontSize(10).font('Helvetica');
    mockResults.forEach(candidate => {
        doc.text(`${candidate.id}. ${candidate.name} (${candidate.party}): ${candidate.votes} votes`, { width: 500 });
    });

    doc.moveDown();
    doc.fontSize(9).text('This report is generated from the decentralized voting blockchain.', { align: 'center', italic: true });
    
    doc.end();
});

// Start the server
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});