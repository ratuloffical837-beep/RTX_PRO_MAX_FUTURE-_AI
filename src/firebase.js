import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAPYgNgnpA5p8zJ4fJdHz0uHRtOa-NCZOI",
  authDomain: "rtx-pro-max.firebaseapp.com",
  projectId: "rtx-pro-max",
  storageBucket: "rtx-pro-max.firebasestorage.app",
  messagingSenderId: "820830677918",
  appId: "1:820830677918:web:d0a17302196d0bf58a048f"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
