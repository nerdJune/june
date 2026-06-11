// App.jsx
import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser'; // 1. 라이브러리 임포트
import './App.css';

function App() {
  // 1. 각 구역을 가리킬 레프(Ref) 생성
  const imgRef1 = useRef(null);
  const imgRef2 = useRef(null);
  const imgRef3 = useRef(null);
  const contactRef = useRef(null);

  // 2. 해당 구역으로 부드럽게 스크롤하는 함수
  const scrollToSection = (elementRef) => {
    elementRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  // 이메일 폼 상태 관리
  const [formData, setFormData] = useState({
    email: '',
    message: ''
  });

  // 입력값 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // 2. 이메일 발송 핸들러 수정
  const handleSubmit = (e) => {
    e.preventDefault();

    // EmailJS에 전달할 파라미터 (템플릿의 {{from_email}}, {{message}}와 매칭됩니다)
    const templateParams = {
      from_email: formData.email,
      message: formData.message,
    };

    // 실제 이메일 발송 요청
    emailjs.send(
      // '',   // 🔴 1단계에서 복사한 Service ID를 넣으세요
      // '',  // 🔴 1단계에서 복사한 Template ID를 넣으세요
      // templateParams,
      // ''    // 🔴 1단계에서 복사한 Public Key를 넣으세요
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      templateParams,
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    )
    .then((response) => {
       console.log('SUCCESS!', response.status, response.text);
       alert('문의 메일이 성공적으로 전송되었습니다!');
       setFormData({ email: '', message: '' }); // 폼 초기화
    })
    .catch((err) => {
       console.error('FAILED...', err);
       alert('메일 전송에 실패했습니다. 다시 시도해주세요.');
    });
  };

  return (
    <div className="page-container">
      
      {/* 3. 상단 고정 네비게이션 바 추가 */}
      <nav className="navbar">
        <ul className="nav-links">
          <li><button onClick={() => scrollToSection(imgRef1)}>이미지 1</button></li>
          <li><button onClick={() => scrollToSection(imgRef2)}>이미지 2</button></li>
          <li><button onClick={() => scrollToSection(imgRef3)}>이미지 3</button></li>
          <li><button onClick={() => scrollToSection(contactRef)}>문의하기</button></li>
        </ul>
      </nav>

      {/* 4. 이미지 구역 (각 블록에 ref 연결) */}
      <section className="image-section">
        <div ref={imgRef1} className="image-container-block">
          <div className="image-wrapper">
            <img src="https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80"/>
          </div>
        </div>

        <div ref={imgRef2} className="image-container-block">
          <div className="image-wrapper">
            <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80"/>
          </div>
        </div>

        <div ref={imgRef3} className="image-container-block">
          <div className="image-wrapper">
            <img src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80"/>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* 5. 하단 문의사항 구역 (ref 연결) */}
      <footer ref={contactRef} className="contact-section">
        <h2>Contact Us</h2>
        <p className="contact-sub">프로젝트에 대해 궁금한 점이 있으시다면 언제든 문의해 주세요.</p>
        
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">회신받을 이메일</label>
            <input 
              type="email" 
              id="email"
              name="email" 
              placeholder="example@domain.com" 
              value={formData.email}
              onChange={handleChange}
              required 
            />
          </div>

          <div className="form-group">
            <label htmlFor="message">문의 내용</label>
            <textarea 
              id="message"
              name="message" 
              placeholder="문의하실 내용을 상세히 적어주세요." 
              rows="6" 
              value={formData.message}
              onChange={handleChange}
              required 
            />
          </div>

          <button type="submit" className="submit-btn">문의 보내기</button>
        </form>
      </footer>

    </div>
  );
}

export default App;