// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // DB 가져오기
import { getStorage } from "firebase/storage";     // 스토리지 가져오기
import { getAuth } from "firebase/auth";           // 인증(로그인) 가져오기

// .env에 저장한 환경변수들을 안전하게 불러옵니다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 1. Firebase 초기화
const app = initializeApp(firebaseConfig);

// 2. 다른 파일에서 꺼내 쓸 수 있도록 기능들 내보내기(export)
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);