// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBKj9rYLdThinia3HxP1ouS0rbjbkc5X9E",
  authDomain: "trustvote-cf6af.firebaseapp.com",
  projectId: "trustvote-cf6af",
  storageBucket: "trustvote-cf6af.firebasestorage.app",
  messagingSenderId: "106450973583",
  appId: "1:106450973583:web:943dae56b2a03306ab51fa",
  measurementId: "G-5BBD4902EF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);