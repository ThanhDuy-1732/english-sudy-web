// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBLCrPTRLHkbF9eyBi9x_geRb5skTcLRuQ",
  authDomain: "study-project-f9e9d.firebaseapp.com",
  projectId: "study-project-f9e9d",
  storageBucket: "study-project-f9e9d.firebasestorage.app",
  messagingSenderId: "723601123065",
  appId: "1:723601123065:web:35aff05c99ca6e09f82428",
  measurementId: "G-TE40VVSYFT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);