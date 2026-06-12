// src/pages/MainPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // 🟢 페이지 이동을 위해 추가
import emailjs from '@emailjs/browser';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore'; 
import { db } from '../firebase';
import '../App.css';

function MainPage() {
  const navigate = useNavigate(); // 🟢 라우터 이동 함수 초기화
  const location = useLocation(); // 🟢 현재 페이지의 상태(state)를 읽어오기 위해 선언

  // 각 구역을 가리킬 레프(Ref) 설정
  const imgRef1 = useRef(null);
  const imgRef2 = useRef(null);
  const imgRef3 = useRef(null);
  const boardRef = useRef(null);   
  const contactRef = useRef(null);

  // 상태 관리
  const [images, setImages] = useState({ img1: '', img2: '', img3: '' });
  const [posts, setPosts] = useState([]); 

  // 🟢 이미지 감시 + 게시판 감시 + 목록 돌아오기 스크롤 통합 핸들러
  useEffect(() => {
    // 1. 기존 이미지 URL 실시간 감시
    const homepageDocRef = doc(db, 'settings', 'homepage');
    const unsubscribeImages = onSnapshot(homepageDocRef, (docSnap) => {
      if (docSnap.exists()) setImages(docSnap.data());
    });

    // 2. 게시판 글 목록 실시간 감시 (최신순 정렬)
    const postsCollectionRef = collection(db, 'posts');
    const q = query(postsCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribePosts = onSnapshot(q, (querySnapshot) => {
      const postsArray = [];
      querySnapshot.forEach((doc) => {
        postsArray.push({ id: doc.id, ...doc.data() });
      });
      setPosts(postsArray); 
    }, (error) => {
      console.error("게시글을 불러오는 중 오류 발생:", error);
    });

    // 3. 🟢 [추가] 상세 페이지에서 '게시판 구역으로 가라'는 스크롤 신호를 보냈는지 감시
    if (location.state?.scrollTo === 'board') {
      // 컴포넌트 렌더링과 데이터 배치가 완료되는 찰나의 시간을 벌기 위해 100ms 지연 후 이동
      setTimeout(() => {
        boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      // 무한 스크롤 오작동을 방지하기 위해 사용한 신호(state)는 깨끗하게 비워줍니다.
      navigate(location.pathname, { replace: true, state: {} });
    }

    // 컴포넌트가 화면에서 사라질 때(Unmount) 리스너들을 깔끔하게 청소합니다.
    return () => {
      unsubscribeImages();
      unsubscribePosts();
    };
  }, [location, navigate]); // 🟢 location과 navigate를 의존성 배열에 등록하여 신호를 놓치지 않게 합니다.

  // 부드러운 스크롤 함수
  const scrollToSection = (elementRef) => {
    elementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 이메일 폼 상태 및 핸들러
  const [formData, setFormData] = useState({ email: '', message: '' });
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      { from_email: formData.email, message: formData.message },
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    )
    .then(() => {
       alert('문의 메일이 전송되었습니다!');
       setFormData({ email: '', message: '' });
    })
    .catch((err) => alert('메일 전송 실패'));
  };

  return (
    <div className="page-container">
      {/* 상단 네비게이션 바 */}
      <nav className="navbar">
        <ul className="nav-links">
          <li><button onClick={() => scrollToSection(imgRef1)}>이미지 1</button></li>
          <li><button onClick={() => scrollToSection(imgRef2)}>이미지 2</button></li>
          <li><button onClick={() => scrollToSection(imgRef3)}>이미지 3</button></li>
          <li><button onClick={() => scrollToSection(boardRef)}>게시판</button></li> 
          <li><button onClick={() => scrollToSection(contactRef)}>문의하기</button></li>
        </ul>
      </nav>

      {/* 이미지 구역 */}
      <section className="image-section">
        <div ref={imgRef1} className="image-container-block">
          <div className="image-wrapper">{images.img1 && <img src={images.img1} alt="1" />}</div>
        </div>
        <div ref={imgRef2} className="image-container-block">
          <div className="image-wrapper">{images.img2 && <img src={images.img2} alt="2" />}</div>
        </div>
        <div ref={imgRef3} className="image-container-block">
          <div className="image-wrapper">{images.img3 && <img src={images.img3} alt="3" />}</div>
        </div>
      </section>

      <hr className="divider" />

      {/* 🟢 3. 자유 게시판 구역 개편 (깔끔한 테이블 목록 형상화) */}
      <section ref={boardRef} className="board-section" style={{ padding: '60px 20px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '2rem', color: '#333' }}>공지 및 활동 게시판</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '40px' }}>확인하고 싶으신 게시글의 제목을 클릭하시면 상세 내용을 볼 수 있습니다.</p>
        
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', margin: '40px 0' }}>아직 등록된 게시글이 없습니다.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e2e8f0', color: '#4a5568', fontWeight: 'bold' }}>
                <th style={{ padding: '15px 20px', width: '80px', textAlign: 'center' }}>번호</th>
                <th style={{ padding: '15px 20px' }}>글 제목</th>
                <th style={{ padding: '15px 20px', width: '180px', textAlign: 'center' }}>작성일</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => (
                <tr key={post.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background-color 0.2s' }} className="board-row">
                  {/* 최신 글이 맨 위이므로 역순 번호 매기기 */}
                  <td style={{ padding: '15px 20px', textAlign: 'center', color: '#718096', fontSize: '14px' }}>
                    {posts.length - index}
                  </td>
                  {/* 제목 구역: 클릭 시 상세 페이지로 라우팅 */}
                  <td style={{ padding: '15px 20px' }}>
                    <span 
                      onClick={() => navigate(`/post/${post.id}`)} // 🟢 클릭 시 해당 글의 ID를 파라미터로 넘김
                      style={{ color: '#2b6cb0', cursor: 'pointer', fontWeight: '600', fontSize: '15px', textDecoration: 'none' }}
                      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                    >
                      {post.title}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center', color: '#718096', fontSize: '14px' }}>
                    {post.createdAt?.toDate().toLocaleDateString() || '방금 전'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <hr className="divider" />

      {/* 하단 문의사항 구역 */}
      <footer ref={contactRef} className="contact-section">
        <h2>Contact Us</h2>
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>회신받을 이메일</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>문의 내용</label>
            <textarea name="message" rows="6" value={formData.message} onChange={handleChange} required />
          </div>
          <button type="submit" className="submit-btn">문의 보내기</button>
        </form>
      </footer>
    </div>
  );
}

export default MainPage;