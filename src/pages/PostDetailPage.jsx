// src/pages/PostDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// 🟢 본문 스타일 유지를 위해 Quill 라이브러리와 CSS를 가져옵니다.
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.bubble.css'; // 읽기 전용에 최적화된 테마

function PostDetailPage() {
  const { id } = useParams(); // URL에서 게시글의 ID를 추출합니다. (/post/:id)
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPostDetail = async () => {
      try {
        const docRef = doc(db, 'posts', id);
        const docSnap = await getDoc(docRef);

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

    fetchPostDetail();
  }, [id, navigate]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>로그 중...</div>;
  if (!post) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      {/* 뒤로가기 버튼 */}
      <button 
        onClick={() => navigate('/main')} 
        style={{ padding: '8px 16px', background: '#eee', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}
      >
        ⬅️ 목록으로 돌아가기
      </button>

      {/* 게시글 헤더 구역 */}
      <div style={{ borderBottom: '2px solid #333', paddingBottom: '15px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', margin: '0 0 10px 0', color: '#222' }}>{post.title}</h1>
        <div style={{ display: 'flex', gap: '15px', fontSize: '14px', color: '#666' }}>
          <span>✍️ 작성자: {post.author || '익명'}</span>
          <span>📅 작성일: {post.createdAt?.toDate().toLocaleString() || '알 수 없음'}</span>
        </div>
      </div>

      {/* 🟢 게시글 본문 구역 (에디터 스타일 그대로 렌더링하는 핵심 영역) */}
      <div style={{ minHeight: '300px', lineHeight: '1.6' }}>
        <ReactQuill
          value={post.content}
          readOnly={true}      // 👈 편집 불가능하게 고정
          theme="bubble"       // 👈 툴바 없이 깔끔하게 본문만 보여주는 테마
          style={{ fontSize: '16px' }}
        />
      </div>
    </div>
  );
}

export default PostDetailPage;