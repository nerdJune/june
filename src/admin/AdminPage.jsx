// src/admin/AdminPage.jsx
import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, deleteDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase'; // storage 추가 확인

function AdminPage() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 메인화면 배너 이미지용 URL 상태
  const [urls, setUrls] = useState({ img1: '', img2: '', img3: '' });

  // --- 💡 게시판 관련 상태들 ---
  const [posts, setPosts] = useState([]); // 전체 글 목록
  const [title, setTitle] = useState(''); // 글쓰기/수정용 제목
  const [content, setContent] = useState(''); // 글쓰기/수정용 내용
  const [imageFiles, setImageFiles] = useState([]); // 선택한 이미지 파일들
  const [uploading, setUploading] = useState(false); // 업로드 로딩 상태
  
  const [editingPostId, setEditingPostId] = useState(null); // 현재 수정 중인 글의 ID (null이면 새글 작성 모드)
  const [selectedPostIds, setSelectedPostIds] = useState([]); // 체크박스로 선택된 글 ID 배열

  // 1. 로그인 상태 감시 및 데이터 실시간 로드
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        if (adminDoc.exists() && adminDoc.data().isAdmin === true) {
          setUser(currentUser);
          fetchCurrentUrls();

          // 🟢 게시글 목록 실시간 감시 (최신순)
          const unsubscribePosts = onSnapshot(collection(db, 'posts'), (snapshot) => {
            const postsArr = [];
            snapshot.forEach((doc) => {
              postsArr.push({ id: doc.id, ...doc.data() });
            });
            // 시간순 정렬 (createdAt이 없는 방금 쓴 글 예외처리 포함)
            postsArr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPosts(postsArr);
          });

          return () => unsubscribePosts();
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

  // 메인 배너 URL 가져오기
  const fetchCurrentUrls = async () => {
    const docSnap = await getDoc(doc(db, 'settings', 'homepage'));
    if (docSnap.exists()) setUrls(docSnap.data());
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('관리자 로그인 성공!');
    } catch (error) {
      alert('로그인 실패: 정보를 확인하세요.');
    }
  };

  const handleLogout = () => {
    signOut(auth).then(() => alert('로그아웃 되었습니다.'));
  };

  // 메인 배너 이미지 주소 저장
  const handleUrlUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'settings', 'homepage'), urls);
      alert('배너 이미지 주소가 반영되었습니다!');
    } catch (error) {
      alert('업데이트 실패');
    }
  };


  // --- 💡 2단계: 게시글 작성 및 다중 이미지 업로드 핵심 로직 ---
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) return alert('제목과 내용을 입력해주세요.');

    setUploading(true);
    try {
      let uploadedImageUrls = [];

      // 1. 이미지 파일이 있다면 Storage에 순차적으로 업로드하고 URL 추출
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const storageRef = ref(storage, `board/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);
          uploadedImageUrls.push(downloadUrl);
        }
      }

      if (editingPostId) {
        // 🔄 [수정 모드] 기존 문서 업데이트
        const postRef = doc(db, 'posts', editingPostId);
        // 이미지를 새로 첨부했을 때만 기존 이미지 주소를 덮어쓰거나 유지하도록 분기 처리 가능
        const updateData = {
          title,
          content,
        };
        if (uploadedImageUrls.length > 0) {
          updateData.imageUrls = uploadedImageUrls; // 새 이미지로 교체
        }

        await updateDoc(postRef, updateData);
        alert('글이 성공적으로 수정되었습니다!');
        setEditingPostId(null); // 수정 모드 탈출
      } else {
        // ➕ [새 글 작성 모드] Firestore에 새 문서 생성 (컬렉션 자동생성)
        await addDoc(collection(db, 'posts'), {
          title,
          content,
          imageUrls: uploadedImageUrls,
          createdAt: new Date(),
          author: user.email
        });
        alert('새 글이 등록되었습니다!');
      }

      // 폼 초기화
      setTitle('');
      setContent('');
      setImageFiles([]);
      document.getElementById('file-input').value = ''; // 파일 선택창 리셋
    } catch (error) {
      console.error(error);
      alert('글 등록/수정 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // --- 💡 체크박스 일괄 선택/해제 로직 ---
  const handleSelectPost = (postId) => {
    if (selectedPostIds.includes(postId)) {
      setSelectedPostIds(selectedPostIds.filter(id => id !== postId));
    } else {
      setSelectedPostIds([...selectedPostIds, postId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedPostIds.length === posts.length) {
      setSelectedPostIds([]); // 전체 해제
    } else {
      setSelectedPostIds(posts.map(post => post.id)); // 전체 선택
    }
  };

  // --- 💡 1~N건 일괄 삭제 로직 (Firebase Batch 사용) ---
  const handleDeleteSelected = async () => {
    if (selectedPostIds.length === 0) return alert('삭제할 게시글을 선택해주세요.');
    if (!window.confirm(`선택한 ${selectedPostIds.length}개의 글을 정말 삭제하시겠습니까?`)) return;

    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach((id) => {
        const postRef = doc(db, 'posts', id);
        batch.delete(postRef);
      });
      await batch.commit(); // 한 번에 실행 (원자성 확보)
      
      alert('선택한 게시글이 삭제되었습니다.');
      setSelectedPostIds([]); // 선택 배열 비우기
    } catch (error) {
      console.error(error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // --- 💡 수정 버튼 클릭 시 입력 창에 데이터 세팅 ---
  const startEdit = (post) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    window.scrollTo({ top: 300, behavior: 'smooth' }); // 입력 창이 있는 위쪽으로 부드럽게 스크롤
  };


  // 🔓 [렌더링] 로그인 전
  if (!user) {
    return (
      <div style={{ maxWidth: '360px', margin: '120px auto', padding: '30px', textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#ffffff' }}>
        <h2 style={{ marginBottom: '25px', color: '#333' }}>관리자 로그인</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '5px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#555' }}>아이디 (이메일)</label>
            <input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '5px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#555' }}>비밀번호</label>
            <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>
          <button type="submit" style={{ padding: '12px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>로그인</button>
        </form>
      </div>
    );
  }

  // 🔐 [렌더링] 로그인 후 (대시보드) - 배너 수정 섹션을 최상단으로 배치
  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* 🔝 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>⚙️ 최고 관리자 대시보드</h2>
        <button onClick={handleLogout} style={{ padding: '7px 14px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>로그아웃</button>
      </div>
      <p style={{ color: '#666', marginBottom: '30px' }}>계정: {user.email}</p>

      {/* 🔥 [변경] SECTION 1: 메인화면 배너 이미지 주소 수정 폼 (최상단 배치) */}
      <section style={{ background: '#edf2f7', padding: '25px', borderRadius: '8px', border: '1px solid #cbd5e0', marginBottom: '40px' }}>
        <h3 style={{ marginTop: 0, color: '#2d3748', marginBottom: '15px' }}>🖼️ 메인 배너 이미지 주소 수정</h3>
        <p style={{ fontSize: '14px', color: '#4a5568', marginBottom: '15px' }}>현재 홈페이지 메인에 노출되는 배너 이미지 3장의 텍스트 URL 주소입니다.</p>
        
        <form onSubmit={handleUrlUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>이미지 1 URL</label>
            <input type="text" value={urls.img1} onChange={(e) => setUrls({...urls, img1: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} placeholder="https://example.com/image1.jpg" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>이미지 2 URL</label>
            <input type="text" value={urls.img2} onChange={(e) => setUrls({...urls, img2: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} placeholder="https://example.com/image2.jpg" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ width: '100px', fontWeight: 'bold', fontSize: '14px' }}>이미지 3 URL</label>
            <input type="text" value={urls.img3} onChange={(e) => setUrls({...urls, img3: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} placeholder="https://example.com/image3.jpg" />
          </div>
          <button type="submit" style={{ padding: '12px', backgroundColor: '#00c853', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>
            메인 배너 설정 저장 및 즉시 반영
          </button>
        </form>
      </section>

      <hr style={{ margin: '40px 0', border: '0', borderTop: '1px solid #ddd' }} />

      {/* SECTION 2: 게시판 글쓰기 및 수정 폼 */}
      <section style={{ background: '#f9f9f9', padding: '25px', borderRadius: '8px', border: '1px solid #e2e2e2', marginBottom: '40px' }}>
        <h3 style={{ marginTop: 0, color: '#333' }}>
          {editingPostId ? '✏️ 게시글 수정하기 (수정 모드)' : '📝 새 게시글 등록하기'}
        </h3>
        <form onSubmit={handlePostSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>제목</label>
            <input type="text" placeholder="글 제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>내용</label>
            <textarea placeholder="글 내용을 입력하세요" rows="6" value={content} onChange={(e) => setContent(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', lineHeight: '1.5' }} />
          </div>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              이미지 첨부 {editingPostId && <span style={{color:'orange', fontSize:'12px'}}>(수정 시 미첨부하면 기존 이미지 유지)</span>}
            </label>
            <input id="file-input" type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files))} style={{ padding: '5px 0' }} />
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#888' }}>* 여러 장 선택 가능 (Ctrl 또는 Shift 키 활용)</p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={uploading} style={{ flex: 1, padding: '12px', backgroundColor: editingPostId ? '#e65100' : '#0070f3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? '서버에 저장 중...' : editingPostId ? '수정 완료 및 반영' : '새 게시글 저장하기'}
            </button>
            {editingPostId && (
              <button type="button" onClick={() => { setEditingPostId(null); setTitle(''); setContent(''); }} style={{ padding: '12px', backgroundColor: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                수정 취소
              </button>
            )}
          </div>
        </form>
      </section>

      {/* SECTION 3: 게시판 목록 및 대량 삭제 테이블 */}
      <section style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>📋 등록된 게시글 목록 ({posts.length}개)</h3>
          <button 
            onClick={handleDeleteSelected}
            disabled={selectedPostIds.length === 0}
            style={{ padding: '8px 15px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: selectedPostIds.length === 0 ? 'not-allowed' : 'pointer', opacity: selectedPostIds.length === 0 ? 0.5 : 1 }}
          >
            선택 삭제 ({selectedPostIds.length})
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#eeeeee', borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '12px', width: '40px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  onChange={handleSelectAll} 
                  checked={posts.length > 0 && selectedPostIds.length === posts.length} 
                />
              </th>
              <th style={{ padding: '12px' }}>글 제목 (클릭 시 수정)</th>
              <th style={{ padding: '12px', width: '180px' }}>등록 일시</th>
              <th style={{ padding: '12px', width: '80px', textAlign: 'center' }}>이미지</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>등록된 글이 없습니다. 위의 폼에서 첫 글을 작성해 보세요!</td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: editingPostId === post.id ? '#fff3e0' : 'transparent' }}>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedPostIds.includes(post.id)} 
                      onChange={() => handleSelectPost(post.id)} 
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span 
                      onClick={() => startEdit(post)} 
                      style={{ color: '#0070f3', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
                    >
                      {post.title}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                    {post.createdAt?.toDate().toLocaleString() || '방금 전'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                    {post.imageUrls ? `${post.imageUrls.length}장` : '0장'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

    </div>
  );
}

export default AdminPage;