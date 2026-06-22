import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.bubble.css';
import styles from './PostDetailPage.module.css';

function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'posts', id));
        if (docSnap.exists()) {
          setPost(docSnap.data());
        } else {
          alert('존재하지 않거나 삭제된 게시글입니다.');
          navigate('/main');
        }
      } catch (error) {
        console.error('글 로드 실패:', error);
        alert('데이터를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id, navigate]);

  // 게시글 본문 내 이미지 가로 넘침 방지
  const contentRef = useRef(null);
  useEffect(() => {
    if (!contentRef.current) return;
    const imgs = contentRef.current.querySelectorAll('img');
    imgs.forEach((img) => {
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.setProperty('max-width', '100%', 'important');
      img.style.setProperty('height', 'auto', 'important');
      const parent = img.parentElement;
      if (parent) {
        parent.style.setProperty('max-width', '100%', 'important');
        parent.style.setProperty('overflow', 'hidden', 'important');
      }
    });
  }, [post]);

  if (loading) return <p className={styles.loading}>불러오는 중...</p>;
  if (!post) return null;

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => navigate('/', { state: { scrollTo: 'board' } })}>
        ← 목록으로 돌아가기
      </button>

      <div className={styles.postHeader}>
        <h1 className={styles.postTitle}>{post.title}</h1>
        <div className={styles.postMeta}>
          <span>작성자: {post.author || '익명'}</span>
          <span>작성일: {post.createdAt?.toDate().toLocaleString() || '알 수 없음'}</span>
        </div>
      </div>

      <div ref={contentRef} className={styles.postContent}>
        <ReactQuill
          value={post.content}
          readOnly={true}
          theme="bubble"
        />
      </div>
    </div>
  );
}

export default PostDetailPage;
