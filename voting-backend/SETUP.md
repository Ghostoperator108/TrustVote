# Voting Backend - Setup Guide

This is the backend server for the TrustVote decentralized voting system. It handles voter authentication via OTP, verification, and report generation.

## Features

- **Voter Authentication**: Verify voters using their ID
- **OTP Generation & Delivery**: Send one-time passwords via SMS
- **Receipt Generation**: Download voter authentication receipts as PDFs
- **Results Reporting**: Generate election results reports

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   - Copy `.env.example` to `.env`
   - Update the `.env` file with your Twilio credentials

## SMS Integration (Twilio)

### Prerequisites
- A Twilio account (sign up at https://www.twilio.com)
- A Twilio phone number
- Account SID and Auth Token

### Getting Your Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com)
2. Copy your **Account SID** 
3. Copy your **Auth Token**
4. Go to Phone Numbers section and copy your **Twilio Phone Number**

### Configuration

Update your `.env` file with these values:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
PORT=5000
```

### Running the Server

```bash
npm start
```

Or use node directly:

```bash
node index.js
```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Request OTP
- **POST** `/api/request-otp`
- **Body**: `{ "voterId": "VOTER123" }`
- **Response**: OTP sent via SMS

### 2. Verify OTP
- **POST** `/api/verify-otp`
- **Body**: `{ "voterId": "VOTER123", "otp": "123456" }`
- **Response**: Verification status and voter details

### 3. Download Receipt
- **GET** `/api/download-receipt/:voterId`
- **Response**: PDF file with voter authentication receipt

### 4. Download Results
- **GET** `/api/download-results`
- **Response**: PDF file with election results

## SMS Delivery Modes

### Production Mode (with Twilio)
When Twilio credentials are configured, the system will send actual SMS messages to voters' phones.

### Mock Mode (without Twilio)
If Twilio credentials are not provided, the system logs OTPs to console instead. Useful for testing.

### Fallback Mode
If Twilio delivery fails, the system automatically falls back to mock mode and logs the error.

## Voter Database

The mock voter database contains:
- VOTER123: Rahul Sharma, +1-555-0101
- VOTER456: Priya Patel, +1-555-0202

In production, this would connect to a verified government voter registry.

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit `.env` files to version control
- Keep your Twilio credentials secret
- OTPs expire after 5 minutes
- Use HTTPS in production
- Implement rate limiting for OTP requests
- Add authentication for all endpoints

## Troubleshooting

### SMS not sending?
1. Check if `.env` file is properly configured
2. Verify Twilio Account SID and Auth Token
3. Ensure phone number format is correct (+country_code format)
4. Check Twilio account balance and active phone number

### Port already in use?
Change the PORT in `.env` file to another available port (e.g., 5001)

### Module not found errors?
Run `npm install` again to ensure all dependencies are installed
