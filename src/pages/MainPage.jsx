// src/pages/MainPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import '../App.css';

function MainPage() {
  const imgRef1 = useRef(null);
  const imgRef2 = useRef(null);
  const imgRef3 = useRef(null);
  const contactRef = useRef(null);

  const [images, setImages] = useState({ img1: '', img2: '', img3: '' });

  useEffect(() => {
    const homepageDocRef = doc(db, 'settings', 'homepage');
    const unsubscribe = onSnapshot(homepageDocRef, (docSnap) => {
      if (docSnap.exists()) setImages(docSnap.data());
    });
    return () => unsubscribe();
  }, []);

  const scrollToSection = (elementRef) => {
    elementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      <nav className="navbar">
        <ul className="nav-links">
          <li><button onClick={() => scrollToSection(imgRef1)}>이미지 1</button></li>
          <li><button onClick={() => scrollToSection(imgRef2)}>이미지 2</button></li>
          <li><button onClick={() => scrollToSection(imgRef3)}>이미지 3</button></li>
          <li><button onClick={() => scrollToSection(contactRef)}>문의하기</button></li>
        </ul>
      </nav>

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