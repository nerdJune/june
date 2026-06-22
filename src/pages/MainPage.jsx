import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './MainPage.module.css';

function MainPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const imgRef1 = useRef(null);
  const imgRef2 = useRef(null);
  const imgRef3 = useRef(null);
  const boardRef = useRef(null);
  const contactRef = useRef(null);

  const [images, setImages] = useState({ img1: '', img2: '', img3: '' });
  const [posts, setPosts] = useState([]);
  const [formData, setFormData] = useState({ email: '', message: '' });

  useEffect(() => {
    const unsubscribeImages = onSnapshot(doc(db, 'settings', 'homepage'), (docSnap) => {
      if (docSnap.exists()) setImages(docSnap.data());
    });

    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const postsArray = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts(postsArray);
    }, (error) => {
      console.error('게시글 로드 오류:', error);
    });

    if (location.state?.scrollTo === 'board') {
      setTimeout(() => {
        boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      navigate(location.pathname, { replace: true, state: {} });
    }

    return () => {
      unsubscribeImages();
      unsubscribePosts();
    };
  }, [location, navigate]);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      .catch(() => alert('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.'));
  };

  return (
    <div className={styles.pageContainer}>
      <nav className={styles.navbar}>
        <ul className={styles.navLinks}>
          <li><button onClick={() => scrollTo(imgRef1)}>이미지 1</button></li>
          <li><button onClick={() => scrollTo(imgRef2)}>이미지 2</button></li>
          <li><button onClick={() => scrollTo(imgRef3)}>이미지 3</button></li>
          <li><button onClick={() => scrollTo(boardRef)}>게시판</button></li>
          <li><button onClick={() => scrollTo(contactRef)}>문의하기</button></li>
        </ul>
      </nav>

      <section className={styles.imageSection}>
        <div ref={imgRef1} className={styles.imageBlock}>
          <div className={styles.imageWrapper}>
            {images.img1 && <img src={images.img1} alt="배너 이미지 1" />}
          </div>
        </div>
        <div ref={imgRef2} className={styles.imageBlock}>
          <div className={styles.imageWrapper}>
            {images.img2 && <img src={images.img2} alt="배너 이미지 2" />}
          </div>
        </div>
        <div ref={imgRef3} className={styles.imageBlock}>
          <div className={styles.imageWrapper}>
            {images.img3 && <img src={images.img3} alt="배너 이미지 3" />}
          </div>
        </div>
      </section>

      <hr className={styles.divider} />

      <section ref={boardRef} className={styles.boardSection}>
        <h2>공지 및 활동 게시판</h2>
        <p className={styles.boardDescription}>
          확인하고 싶으신 게시글의 제목을 클릭하시면 상세 내용을 볼 수 있습니다.
        </p>

        {posts.length === 0 ? (
          <p className={styles.boardEmpty}>아직 등록된 게시글이 없습니다.</p>
        ) : (
          <table className={styles.boardTable}>
            <thead>
              <tr>
                <th>번호</th>
                <th>글 제목</th>
                <th>작성일</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => (
                <tr key={post.id} className={styles.boardRow}>
                  <td className={styles.boardNumCell}>{posts.length - index}</td>
                  <td>
                    <span
                      className={styles.boardTitleLink}
                      onClick={() => navigate(`/post/${post.id}`)}
                    >
                      {post.title}
                    </span>
                  </td>
                  <td className={styles.boardDateCell}>
                    {post.createdAt?.toDate().toLocaleDateString() || '방금 전'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <hr className={styles.divider} />

      <footer ref={contactRef} className={styles.contactSection}>
        <h2>Contact Us</h2>
        <form className={styles.contactForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>회신받을 이메일</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>문의 내용</label>
            <textarea
              name="message"
              rows="6"
              value={formData.message}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className={styles.submitBtn}>문의 보내기</button>
        </form>
      </footer>
    </div>
  );
}

export default MainPage;
