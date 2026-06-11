// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
// 🟢 대문자 AdminPages 대신 소문자 admin 경로로 깔끔하게 연결!
import AdminPage from './admin/AdminPage'; 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/admin" element={<AdminPage />} />

        {/* 🟢 위 주소 외에 다른 모든 주소(path="*")는 무조건 메인(/)으로 이동시킵니다 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;