// voting-frontend/src/PhoneLogin.jsx
import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

export default function PhoneLogin({ onLoginSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Initialize reCAPTCHA when the component mounts
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: (response) => {
          // reCAPTCHA solved, allow OTP
        },
      });
    }
  }, []);

  const requestOTP = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Phone number must include country code (e.g., +91 for India)
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const confirmationResult = await signInWithPhoneNumber(auth, formattedNumber, window.recaptchaVerifier);
      setVerificationId(confirmationResult);
      alert('OTP Sent successfully!');
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await verificationId.confirm(otp);
      const user = result.user;
      
      // Get the secure token to send to your backend
      const idToken = await user.getIdToken();
      
      onLoginSuccess(user, idToken);
    } catch (err) {
      setError('Invalid OTP. Please try again.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h2>TrustVote Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {!verificationId ? (
        <form onSubmit={requestOTP}>
          <div id="recaptcha-container" style={{ marginBottom: '10px' }}></div>
          <input
            type="tel"
            placeholder="Phone Number (e.g., 9876543210)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            style={{ padding: '10px', width: '100%', marginBottom: '10px' }}
          />
          <button type="submit" style={{ padding: '10px 20px' }}>Send OTP</button>
        </form>
      ) : (
        <form onSubmit={verifyOTP}>
          <input
            type="text"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            style={{ padding: '10px', width: '100%', marginBottom: '10px' }}
          />
          <button type="submit" style={{ padding: '10px 20px' }}>Verify & Login</button>
        </form>
      )}
    </div>
  );
}