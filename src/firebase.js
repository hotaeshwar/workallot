// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCI7ARFWc43pfx9oI-XDHdQKC9iCCI-FhA",
  authDomain: "workallocate.firebaseapp.com",
  projectId: "workallocate",
  storageBucket: "workallocate.firebasestorage.app",
  messagingSenderId: "350109527846",
  appId: "1:350109527846:web:e4e27a2369852e6df5dbe7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with offline persistence
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
