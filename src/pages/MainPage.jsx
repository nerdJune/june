// src/pages/MainPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore'; // 🟢 collection, query, orderBy 추가
import { db } from '../firebase';
import '../App.css';

function MainPage() {
  // 각 구역을 가리킬 레프(Ref) 설정
  const imgRef1 = useRef(null);
  const imgRef2 = useRef(null);
  const imgRef3 = useRef(null);
  const boardRef = useRef(null);   // 🟢 게시판 구역 레프 추가
  const contactRef = useRef(null);

  // 상태 관리
  const [images, setImages] = useState({ img1: '', img2: '', img3: '' });
  const [posts, setPosts] = useState([]); // 🟢 게시글 목록을 저장할 상태 추가

  useEffect(() => {
    // 1. 기존 이미지 URL 실시간 감시
    const homepageDocRef = doc(db, 'settings', 'homepage');
    const unsubscribeImages = onSnapshot(homepageDocRef, (docSnap) => {
      if (docSnap.exists()) setImages(docSnap.data());
    });

    // 2. 🟢 게시판 글 목록 실시간 감시 (posts 컬렉션 자동 감지)
    // 최신 글이 맨 위로 오도록 생성일자(createdAt) 기준 내림차순(desc) 정렬 규칙을 만듭니다.
    const postsCollectionRef = collection(db, 'posts');
    const q = query(postsCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribePosts = onSnapshot(q, (querySnapshot) => {
      const postsArray = [];
      querySnapshot.forEach((doc) => {
        postsArray.push({ id: doc.id, ...doc.data() });
      });
      setPosts(postsArray); // 가져온 글 목록을 상태에 저장
    }, (error) => {
      console.error("게시글을 불러오는 중 오류 발생:", error);
    });

    // 컴포넌트 해제 시 모든 감시 카메라 종료
    return () => {
      unsubscribeImages();
      unsubscribePosts();
    };
  }, []);

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
      {/* 상단 네비게이션 바 (게시판 버튼 추가) */}
      <nav className="navbar">
        <ul className="nav-links">
          <li><button onClick={() => scrollToSection(imgRef1)}>이미지 1</button></li>
          <li><button onClick={() => scrollToSection(imgRef2)}>이미지 2</button></li>
          <li><button onClick={() => scrollToSection(imgRef3)}>이미지 3</button></li>
          <li><button onClick={() => scrollToSection(boardRef)}>게시판</button></li> {/* 🟢 추가 */}
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

      {/* 🟢 3. 자유 게시판 구역 추가 */}
      <section ref={boardRef} className="board-section" style={{ padding: '60px 20px', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '2rem', color: '#333' }}>공지 및 활동 게시판</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '40px' }}>관리자가 등록한 최신 소식과 프로젝트 포트폴리오를 확인하세요.</p>
        
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', margin: '40px 0' }}>아직 등록된 게시글이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {posts.map((post) => (
              <div key={post.id} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '25px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', color: '#111' }}>{post.title}</h3>
                <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '15px' }}>
                  작성일시: {post.createdAt?.toDate().toLocaleString() || '방금 전'}
                </p>
                <p style={{ fontSize: '1rem', lineHeight: '1.6', color: '#444', whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
                  {post.content}
                </p>
                
                {/* 게시글에 첨부된 이미지들이 있다면 가로로 나열하여 보여줍니다 */}
                {post.imageUrls && post.imageUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
                    {post.imageUrls.map((url, index) => (
                      <img 
                        key={index} 
                        src={url} 
                        alt={`첨부이미지-${index}`} 
                        style={{ width: '200px', height: '150px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }} 
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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