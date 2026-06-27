import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyChYNS0363dMysBjOshDrVXU4lFzqGFxo4",
  authDomain: "qutex-massaallah.firebaseapp.com",
  projectId: "qutex-massaallah",
  storageBucket: "qutex-massaallah.firebasestorage.app",
  messagingSenderId: "317798520655",
  appId: "1:317798520655:web:ae2755290ba5e29af7d73a",
  measurementId: "G-ELZ95LY0HY",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
