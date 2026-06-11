// src/pages/AdminPage.jsx
import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import '../App.css';

function AdminPage() {
  const [user, setUser] = useState(null); // 로그인한 유저 정보
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 대시보드에서 수정할 이미지 URL 상태창
  const [urls, setUrls] = useState({ img1: '', img2: '', img3: '' });

  // 1. 로그인 상태 상시 감시
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // 로그인 성공 시, Firestore의 'admins' 컬렉션에서 실제 관리자가 맞는지 권한 검증
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        if (adminDoc.exists() && adminDoc.data().isAdmin === true) {
          setUser(currentUser);
          fetchCurrentUrls(); // 현재 DB에 저장된 이미지 주소 불러오기
        } else {
          alert('관리자 권한이 없습니다.');
          signOut(auth);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 기존 DB에 저장되어 있는 이미지 주소 긁어오기
  const fetchCurrentUrls = async () => {
    const docSnap = await getDoc(doc(db, 'settings', 'homepage'));
    if (docSnap.exists()) setUrls(docSnap.data());
  };

  // 2. 로그인 처리 함수
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('관리자 로그인 성공!');
    } catch (error) {
      console.error(error);
      alert('로그인 실패: 이메일 또는 비밀번호를 확인하세요.');
    }
  };

  // 3. 로그아웃 처리 함수
  const handleLogout = () => {
    signOut(auth).then(() => alert('로그아웃 되었습니다.'));
  };

  // 4. DB의 이미지 URL 주소 업데이트 함수
  const handleUrlUpdate = async (e) => {
    e.preventDefault();
    try {
      const homepageDocRef = doc(db, 'settings', 'homepage');
      await updateDoc(homepageDocRef, urls);
      alert('이미지 주소가 성공적으로 변경되었습니다!');
    } catch (error) {
      console.error(error);
      alert('업데이트 실패');
    }
  };

  // 🔓 [조건부 렌더링 1] 로그인 안 되었을 때: 로그인 폼 표시
  if (!user) {
    return (
      <div style={{ 
        maxWidth: '360px', 
        margin: '120px auto', 
        padding: '30px', 
        textAlign: 'center',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        backgroundColor: '#ffffff'
      }}>
        <h2 style={{ marginBottom: '25px', color: '#333' }}>관리자 로그인</h2>
        
        {/* 세로 정렬(column)로 변경하고 간격을 넓혔습니다 */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* 아이디(이메일) 입력 구역 */}
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '5px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#555' }}>아이디 (이메일)</label>
            <input 
              type="email" 
              placeholder="admin@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ padding: '12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '15px' }} 
            />
          </div>

          {/* 비밀번호 입력 구역 */}
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '5px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#555' }}>비밀번호</label>
            <input 
              type="password" 
              placeholder="비밀번호를 입력하세요" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ padding: '12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '15px' }} 
            />
          </div>

          {/* 로그인 버튼 */}
          <button 
            type="submit" 
            style={{ 
              padding: '12px', 
              backgroundColor: '#0070f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer', 
              marginTop: '10px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0051cb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#0070f3'}
          >
            로그인
          </button>
          
        </form>
      </div>
    );
  }

  // 🔐 [조건부 렌더링 2] 로그인 성공 시: 관리자 대시보드 표시
  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>⚙️ 관리자 대시보드</h2>
        <button onClick={handleLogout} style={{padding:'5px 10px', background:'#eee', border:'1px solid #ccc', cursor:'pointer'}}>로그아웃</button>
      </div>
      <p style={{color: '#666'}}>접속 계정: {user.email}</p>
      
      <hr style={{margin: '20px 0'}} />

      <h3>🖼️ 메인 화면 이미지 주소 수정 (텍스트 URL 방식)</h3>
      <form onSubmit={handleUrlUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{fontWeight:'bold'}}>이미지 1 URL</label>
          <input type="text" value={urls.img1} onChange={(e) => setUrls({...urls, img1: e.target.value})} style={{width:'100%', padding:'8px', marginTop:'5px'}} />
        </div>
        <div>
          <label style={{fontWeight:'bold'}}>이미지 2 URL</label>
          <input type="text" value={urls.img2} onChange={(e) => setUrls({...urls, img2: e.target.value})} style={{width:'100%', padding:'8px', marginTop:'5px'}} />
        </div>
        <div>
          <label style={{fontWeight:'bold'}}>이미지 3 URL</label>
          <input type="text" value={urls.img3} onChange={(e) => setUrls({...urls, img3: e.target.value})} style={{width:'100%', padding:'8px', marginTop:'5px'}} />
        </div>
        <button type="submit" style={{padding:'12px', backgroundColor:'#00c853', color:'white', border:'none', fontWeight:'bold', cursor:'pointer', marginTop:'10px'}}>
          설정 저장 및 실시간 반영
        </button>
      </form>
    </div>
  );
}

export default AdminPage;