// src/admin/AdminPage.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase'; 

// 🟢 React Quill 컴포넌트와 스타일을 가져옵니다.
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// ⚠️ [🚨 중요 - 에러 해결의 핵심!] moduleClass is not a constructor 방지
// 컴포넌트가 리렌더링될 때마다 중복 등록되어 에디터가 터지는 것을 막기 위해 컴포넌트 "바깥"에 딱 한 번만 선언합니다.
const Quill = ReactQuill.Quill;
// 1️⃣ [기존 유지] 글자 크기 커스텀 설정
const Size = Quill.import('attributors/style/size');
Size.whitelist = ['12px', '14px', '16px', '18px', '24px', '32px']; 
Quill.register(Size, true);

// 2️⃣ 🌟 [🚨 핵심 추가] blob: 주소가 리렌더링 시 파괴되는 현상 방지 우회 설정
// Quill이 'blob:'으로 시작하는 URL도 안전한 이미지 주소로 인식하도록 프로토콜을 허용해 줍니다.
const ImageBlot = Quill.import('formats/image');
class CustomImageBlot extends ImageBlot {
  static sanitize(url) {
    // blob: 주소이거나 일반 http/https 주소인 경우 검사 없이 그대로 통과시킵니다.
    if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return super.sanitize(url); // 그 외의 경우는 기본 보안 규칙 적용
  }
}
Quill.register(CustomImageBlot, true);

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
  const [imageFiles, setImageFiles] = useState([]); // 외부 파일 선택창으로 고른 진짜 파일 객체들
  const [uploading, setUploading] = useState(false); // 업로드 로딩 상태
  
  const [editingPostId, setEditingPostId] = useState(null); // 현재 수정 중인 글의 ID
  const [selectedPostIds, setSelectedPostIds] = useState([]); // 체크박스로 선택된 글 ID 배열

  // 🟢 Quill 에디터 직접 제어용 레퍼런스
  const quillRef = useRef(null);

  // 🟢 외부 '이미지 첨부' 인풋 핸들러 (리액트 리렌더링 타이밍 충돌을 피하는 정석 버전)
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 1. 최종 저장을 위해 파일 객체들은 기존처럼 state에 누적
    setImageFiles((prev) => [...prev, ...files]);

    // 2. Quill 에디터 인스턴스 가져오기
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 에디터의 현재 커서 위치 찾기 (없으면 맨 마지막 글 뒤로 지정)
    let range = quill.getSelection(true);
    let currentIndex = range ? range.index : quill.getLength();

    files.forEach((file) => {
      // 브라우저 메모리에 가상 임시 주소 생성
      const blobUrl = URL.createObjectURL(file);
      
      // 🟢 에디터 본문에 이미지 블록 인터페이스로 순수하게 임베드 찔러넣기
      quill.insertEmbed(currentIndex, 'image', blobUrl);

      // 🟢 Quill API를 통해 속성(alt, style)을 안전하게 주입 (DOM 직접 수정/지연로직 제거)
      quill.formatText(currentIndex, 1, {
        alt: `attached_${file.name}`,
        style: 'max-width: 100%;'
      });
      
      // 다중 이미지 삽입 시 다음 이미지의 위치를 보정
      currentIndex += 1;
    });

    // 모든 이미지 삽입이 완료되면 커서를 최종 위치 뒤로 이동
    quill.setSelection(currentIndex);
    
    // 다음 첨부를 위해 인풋창 값 초기화
    e.target.value = '';
  };

  // 🟢 Quill 모듈 설정을 useMemo로 감싸 렌더링 시 무한 루프 도는 현상 방지
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'size': ['12px', '14px', '16px', '18px', '24px', '32px'] }],
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }], 
      [{ 'align': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  }), []);

  // Base64 데이터를 진짜 파일(Blob) 객체로 변환하는 함수 (Ctrl+V용)
  const base64ToBlob = (base64Data, contentType = '') => {
    const sliceSize = 1024;
    const byteCharacters = atob(base64Data.split(',')[1]);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  // 1. 로그인 상태 감시 및 데이터 실시간 로드
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        if (adminDoc.exists() && adminDoc.data().isAdmin === true) {
          setUser(currentUser);
          fetchCurrentUrls();

          // 게시글 목록 실시간 감시 (최신순)
          const unsubscribePosts = onSnapshot(collection(db, 'posts'), (snapshot) => {
            const postsArr = [];
            snapshot.forEach((doc) => {
              postsArr.push({ id: doc.id, ...doc.data() });
            });
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

  // [통합 핵심 핸들러] 게시글 작성 및 수정 시 클라우드 변환 저장 로직 (최종 수정본 병합)
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) return alert('제목과 내용을 입력해주세요.');

    setUploading(true);
    try {
      let finalContent = content;
      let uploadedImageUrls = [];

      // 외부 인풋으로 추가되어 본문에 깔린 'blob:' 가짜 주소 찾아서 Storage 업로드
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          if (finalContent.includes(`alt="attached_${file.name}"`)) {
            const storageRef = ref(storage, `board/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            
            uploadedImageUrls.push(downloadUrl);

            const regex = new RegExp(`src="blob:[^"]+"[^>]*alt="attached_${file.name}"`, 'g');
            finalContent = finalContent.replace(regex, `src="${downloadUrl}" alt="${file.name}"`);
          }
        }
      }

      // 에디터 내부에 Ctrl+V(복사 붙여넣기)로 적재된 'base64' 소스 코드 찾아내서 변환
      const base64Regex = /src="(data:image\/(png|jpeg|jpg|gif);base64,[^"]+)"/g;
      let match;
      const base64Matches = [];

      while ((match = base64Regex.exec(content)) !== null) {
        base64Matches.push(match[1]);
      }

      for (let i = 0; i < base64Matches.length; i++) {
        const base64Str = base64Matches[i];
        const contentType = base64Str.match(/data:(image\/[^;]+);/)[1];
        const extension = contentType.split('/')[1];
        
        const imageBlob = base64ToBlob(base64Str, contentType);
        
        const storageRef = ref(storage, `board/${Date.now()}_pasted_img_${i}.${extension}`);
        const snapshot = await uploadBytes(storageRef, imageBlob);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        uploadedImageUrls.push(downloadUrl);
        finalContent = finalContent.replace(base64Str, downloadUrl);
      }

      // 💾 최종 분기 단계: 데이터베이스 저장
      if (editingPostId) {
        // 🔄 [수정 모드] 기존 문서 업데이트
        const postRef = doc(db, 'posts', editingPostId);
        
        // 🟢 [정밀 수정] Ctrl+V 치환까지 모두 끝난 'finalContent' 본문에서 
        // 깨끗하게 완성된 src="주소"들을 순수하게 전부 다 추출합니다. (blob 제외)
        const allImagesInContent = [];
        const imgSrcRegex = /src="([^"]+)"/g;
        let imgMatch;
        
        while ((imgMatch = imgSrcRegex.exec(finalContent)) !== null) {
          const url = imgMatch[1];
          // 정상적으로 업로드 완료된 파이어베이스 스토리지 주소만 배열에 담습니다.
          if (url.startsWith('https://firebasestorage.googleapis.com')) {
            allImagesInContent.add ? allImagesInContent.add(url) : allImagesInContent.push(url);
          }
        }

        // 혹시 모를 중복 주소 적재를 방지하기 위해 Set을 이용해 고유한 주소만 남깁니다.
        const finalImageUrls = [...new Set(allImagesInContent)];

        const updateData = {
          title,
          content: finalContent,
          imageUrls: finalImageUrls, // 🟢 눈에 보이는 최종 이미지 개수 그대로 정확하게 반영됩니다!
        };

        await updateDoc(postRef, updateData);
        alert('글이 성공적으로 수정되었습니다!');
        setEditingPostId(null);
      } else {
        // ➕ [새 글 작성 모드] Firestore에 새 문서 생성
        await addDoc(collection(db, 'posts'), {
          title,
          content: finalContent,
          imageUrls: uploadedImageUrls,
          createdAt: new Date(),
          author: user.email
        });
        alert('새 글이 성공적으로 저장되었습니다!');
      }

      // 폼 및 상태 초기화
      setTitle('');
      setContent('');
      setImageFiles([]);
      document.getElementById('file-input').value = ''; 
    } catch (error) {
      console.error(error);
      alert('글 등록/수정 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 체크박스 일괄 선택/해제 로직
  const handleSelectPost = (postId) => {
    if (selectedPostIds.includes(postId)) {
      setSelectedPostIds(selectedPostIds.filter(id => id !== postId));
    } else {
      setSelectedPostIds([...selectedPostIds, postId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedPostIds.length === posts.length) {
      setSelectedPostIds([]); 
    } else {
      setSelectedPostIds(posts.map(post => post.id)); 
    }
  };

  // 일괄 삭제 로직 (Firebase Batch 사용)
  const handleDeleteSelected = async () => {
    if (selectedPostIds.length === 0) return alert('삭제할 게시글을 선택해주세요.');
    if (!window.confirm(`선택한 ${selectedPostIds.length}개의 글을 정말 삭제하시겠습니까?`)) return;

    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach((id) => {
        const postRef = doc(db, 'posts', id);
        batch.delete(postRef);
      });
      await batch.commit(); 
      
      alert('선택한 게시글이 삭제되었습니다.');
      setSelectedPostIds([]); 
    } catch (error) {
      console.error(error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const startEdit = (post) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    window.scrollTo({ top: 300, behavior: 'smooth' }); 
  };

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

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>⚙️ 최고 관리자 대시보드</h2>
        <button onClick={handleLogout} style={{ padding: '7px 14px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>로그아웃</button>
      </div>
      <p style={{ color: '#666', marginBottom: '30px' }}>계정: {user.email}</p>

      {/* SECTION 1: 메인화면 배너 이미지 주소 수정 폼 */}
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
            <div style={{ backgroundColor: '#fff' }}>
              <ReactQuill 
                ref={quillRef}
                theme="snow"
                modules={quillModules}
                value={content} 
                onChange={(value) => setContent(value)} 
                placeholder="여기에 내용을 작성하세요. 이미지 붙여넣기(Ctrl+V), 이미지 아이콘 클릭, 하단 인풋 창을 통한 첨부가 모두 정상 작동합니다!"
                style={{ height: '350px', marginBottom: '50px' }} 
              />
            </div>
          </div>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              이미지 첨부 {editingPostId && <span style={{color:'orange', fontSize:'12px'}}>(수정 시 미첨부하면 기존 이미지 유지)</span>}
            </label>
            <input id="file-input" type="file" accept="image/*" multiple onChange={handleImageChange} style={{ padding: '5px 0' }} />
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#888' }}>* 여러 장 선택 가능 (선택 시 본문에 가상 주소로 깨짐 없이 자동 배치됩니다.)</p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={uploading} style={{ flex: 1, padding: '12px', backgroundColor: editingPostId ? '#e65100' : '#0070f3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? '클라우드 변환 및 저장 중...' : editingPostId ? '수정 완료 및 반영' : '새 게시글 저장하기'}
            </button>
            {editingPostId && (
              <button type="button" onClick={() => { setEditingPostId(null); setTitle(''); setContent(''); setImageFiles([]); }} style={{ padding: '12px', backgroundColor: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
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