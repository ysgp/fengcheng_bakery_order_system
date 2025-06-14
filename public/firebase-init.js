// public/firebase-init.js

// 從 Firebase SDKs 導入所需的函數
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // 導入 Firestore 服務

// 您的網頁應用程式的 Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyArIrydPZp7RcBHXQ_h7oSaHrZUt0HHrIg",
  authDomain: "fengcheng-bakery-order-system.firebaseapp.com",
  projectId: "fengcheng-bakery-order-system",
  storageBucket: "fengcheng-bakery-order-system.firebasestorage.app",
  messagingSenderId: "475272532980",
  appId: "1:475272532980:web:a73a1ef2cbfc77b1415fa1",
  measurementId: "G-CV4HHSEDF3"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 初始化 Firestore
const db = getFirestore(app);

// 匯出 db 實例，以便其他模組可以使用它
export { db, analytics }; // 如果其他地方需要 analytics 也可以匯出