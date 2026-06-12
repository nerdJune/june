// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './pages/MainPage';
// 🟢 대문자 AdminPages 대신 소문자 admin 경로로 깔끔하게 연결!
import AdminPage from './admin/AdminPage'; 
import PostDetailPage from './pages/PostDetailPage'; // 🟢 방금 만든 상세페이지

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/admin" element={<AdminPage />} />
        
        {/* 🟢 2. 제목 클릭 시 이동할 '상세 보기' 경로를 자식으로 새로 등록 */}
        <Route path="/post/:id" element={<PostDetailPage />} />
        
        {/* 🟢 위 주소 외에 다른 모든 주소(path="*")는 무조건 메인(/)으로 이동시킵니다 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;