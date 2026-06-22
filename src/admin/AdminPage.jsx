import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import styles from './AdminPage.module.css';

// Quill 커스텀 설정 (컴포넌트 외부에 한 번만 선언해야 중복 등록 방지)
const Quill = ReactQuill.Quill;
const Size = Quill.import('attributors/style/size');
Size.whitelist = ['12px', '14px', '16px', '18px', '24px', '32px'];
Quill.register(Size, true);

// blob: URL도 안전한 주소로 인식하도록 허용 (파일 첨부 미리보기용)
const ImageBlot = Quill.import('formats/image');
class CustomImageBlot extends ImageBlot {
  static sanitize(url) {
    if (
      url.startsWith('blob:') ||
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:')
    ) {
      return url;
    }
    return super.sanitize(url);
  }
}
Quill.register(CustomImageBlot, true);

const QUILL_MODULES = {
  toolbar: [
    [{ size: ['12px', '14px', '16px', '18px', '24px', '32px'] }],
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ],
};

// base64 문자열을 Blob 객체로 변환 (Ctrl+V 붙여넣기 이미지 처리용)
function base64ToBlob(base64Data) {
  const [header, data] = base64Data.split(',');
  const contentType = header.match(/:(.*?);/)[1];
  const sliceSize = 1024;
  const byteCharacters = atob(data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(byteNumbers);
  }

  return new Blob(byteArrays, { type: contentType });
}

function AdminPage() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [urls, setUrls] = useState({ img1: '', img2: '', img3: '' });

  const [posts, setPosts] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [selectedPostIds, setSelectedPostIds] = useState([]);

  const quillRef = useRef(null);

  // 이미지 삽입/로드 완료 시점에 가로 넘침 방지
  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return;

      // img + 부모 p 태그 모두 가로 넘침 방지
      const applyToImg = (img) => {
        const apply = () => {
          img.removeAttribute('width');
          img.removeAttribute('height');
          img.style.setProperty('max-width', '100%', 'important');
          img.style.setProperty('height', 'auto', 'important');
          // 부모 p 태그도 함께 제한
          const parent = img.parentElement;
          if (parent) {
            parent.style.setProperty('max-width', '100%', 'important');
            parent.style.setProperty('overflow', 'hidden', 'important');
          }
        };
        apply();
        img.addEventListener('load', apply);
      };

      // text-change 때마다 새로 추가된 img에 적용
      const constrainImages = () => {
        quill.root.querySelectorAll('img').forEach(applyToImg);
      };

      quill.on('text-change', constrainImages);
      // 수정 모드 진입 시 기존 이미지에도 즉시 적용
      constrainImages();

      quillRef.current._constrainImages = constrainImages;
    }, 300);

    return () => {
      clearTimeout(timer);
      const quill = quillRef.current?.getEditor();
      if (quill && quillRef.current?._constrainImages) {
        quill.off('text-change', quillRef.current._constrainImages);
      }
    };
  }, [user]);

  // 로그인 상태 감시 + 관리자 확인 + 게시글 실시간 로드
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        return;
      }

      const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
      if (adminDoc.exists() && adminDoc.data().isAdmin === true) {
        setUser(currentUser);
        fetchCurrentUrls();

        const unsubscribePosts = onSnapshot(collection(db, 'posts'), (snapshot) => {
          const postsArr = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setPosts(postsArr);
        });

        return () => unsubscribePosts();
      } else {
        alert('관리자 권한이 없습니다.');
        signOut(auth);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const fetchCurrentUrls = async () => {
    const docSnap = await getDoc(doc(db, 'settings', 'homepage'));
    if (docSnap.exists()) setUrls(docSnap.data());
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      alert('로그인 실패: 이메일과 비밀번호를 확인하세요.');
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleUrlUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'settings', 'homepage'), urls);
      alert('배너 이미지 주소가 반영되었습니다!');
    } catch {
      alert('업데이트에 실패했습니다.');
    }
  };

  // 파일 첨부 시 에디터 본문에 blob 미리보기로 삽입
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setImageFiles((prev) => [...prev, ...files]);

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let currentIndex = quill.getSelection(true)?.index ?? quill.getLength();

    files.forEach((file) => {
      const blobUrl = URL.createObjectURL(file);
      quill.insertEmbed(currentIndex, 'image', blobUrl);
      quill.formatText(currentIndex, 1, { alt: `attached_${file.name}`, style: 'max-width: 100%;' });
      currentIndex += 1;
    });

    quill.setSelection(currentIndex);
    e.target.value = '';
  };

  // 게시글 저장: blob/base64 이미지를 Firebase Storage로 업로드 후 URL 교체
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) return alert('제목과 내용을 입력해주세요.');

    setUploading(true);
    try {
      let finalContent = content;

      // 파일 첨부 이미지(blob) → Storage 업로드
      for (const file of imageFiles) {
        if (!finalContent.includes(`alt="attached_${file.name}"`)) continue;

        const storageRef = ref(storage, `board/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        const regex = new RegExp(`src="blob:[^"]*"[^>]*alt="attached_${file.name}"`, 'g');
        finalContent = finalContent.replace(regex, `src="${downloadUrl}" alt="${file.name}"`);
      }

      // Ctrl+V 붙여넣기 이미지(base64) → Storage 업로드
      const base64Regex = /src="(data:image\/(png|jpeg|jpg|gif);base64,[^"]+)"/g;
      const base64Matches = [...finalContent.matchAll(base64Regex)].map((m) => m[1]);

      for (let i = 0; i < base64Matches.length; i++) {
        const base64Str = base64Matches[i];
        const contentType = base64Str.match(/data:(image\/[^;]+);/)[1];
        const ext = contentType.split('/')[1];
        const blob = base64ToBlob(base64Str);

        const storageRef = ref(storage, `board/${Date.now()}_paste_${i}.${ext}`);
        const snapshot = await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        finalContent = finalContent.replace(base64Str, downloadUrl);
      }

      if (editingPostId) {
        // 수정 모드: 최종 본문에서 Firebase Storage URL만 추출
        const allUrls = [...finalContent.matchAll(/src="(https:\/\/firebasestorage\.googleapis\.com[^"]*)"/g)]
          .map((m) => m[1]);
        const uniqueUrls = [...new Set(allUrls)];

        await updateDoc(doc(db, 'posts', editingPostId), {
          title,
          content: finalContent,
          imageUrls: uniqueUrls,
        });

        alert('글이 수정되었습니다!');
        setEditingPostId(null);
      } else {
        // 새 글 작성
        const uploadedUrls = [...finalContent.matchAll(/src="(https:\/\/firebasestorage\.googleapis\.com[^"]*)"/g)]
          .map((m) => m[1]);

        await addDoc(collection(db, 'posts'), {
          title,
          content: finalContent,
          imageUrls: [...new Set(uploadedUrls)],
          createdAt: new Date(),
          author: user.email,
        });

        alert('새 글이 저장되었습니다!');
      }

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

  const handleSelectPost = (postId) => {
    setSelectedPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  const handleSelectAll = () => {
    setSelectedPostIds(selectedPostIds.length === posts.length ? [] : posts.map((p) => p.id));
  };

  const handleDeleteSelected = async () => {
    if (selectedPostIds.length === 0) return alert('삭제할 게시글을 선택해주세요.');
    if (!window.confirm(`선택한 ${selectedPostIds.length}개의 글을 정말 삭제하시겠습니까?`)) return;

    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach((id) => batch.delete(doc(db, 'posts', id)));
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

    // 수정 모드 진입 후 에디터가 렌더링되면 기존 이미지에 max-width 재적용
    setTimeout(() => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      quill.root.querySelectorAll('img').forEach((img) => {
        const apply = () => {
          img.removeAttribute('width');
          img.removeAttribute('height');
          img.style.setProperty('max-width', '100%', 'important');
          img.style.setProperty('height', 'auto', 'important');
          const parent = img.parentElement;
          if (parent) {
            parent.style.setProperty('max-width', '100%', 'important');
            parent.style.setProperty('overflow', 'hidden', 'important');
          }
        };
        apply();
        img.addEventListener('load', apply, { once: true });
      });
    }, 100);
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setTitle('');
    setContent('');
    setImageFiles([]);
  };

  // 로그인 화면
  if (!user) {
    return (
      <div className={styles.loginWrapper}>
        <h2>관리자 로그인</h2>
        <form className={styles.loginForm} onSubmit={handleLogin}>
          <div>
            <label className={styles.formLabel}>아이디 (이메일)</label>
            <input
              className={styles.input}
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={styles.formLabel}>비밀번호</label>
            <input
              className={styles.input}
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            로그인
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardHeader}>
        <h2>관리자 대시보드</h2>
        <button className={styles.btnLogout} onClick={handleLogout}>
          로그아웃
        </button>
      </div>
      <p className={styles.accountInfo}>계정: {user.email}</p>

      {/* 배너 이미지 URL 수정 */}
      <section className={`${styles.section} ${styles.sectionBanner}`}>
        <h3>메인 배너 이미지 주소 수정</h3>
        <p className={styles.sectionDescription}>
          홈페이지 메인에 노출되는 배너 이미지 3장의 URL입니다.
        </p>
        <form className={styles.formColumn} onSubmit={handleUrlUpdate}>
          {['img1', 'img2', 'img3'].map((key, i) => (
            <div key={key} className={styles.formRow}>
              <label>이미지 {i + 1} URL</label>
              <input
                className={styles.inputFlex}
                type="text"
                value={urls[key]}
                onChange={(e) => setUrls({ ...urls, [key]: e.target.value })}
                placeholder={`https://example.com/image${i + 1}.jpg`}
              />
            </div>
          ))}
          <button type="submit" className={`${styles.btn} ${styles.btnSuccess}`}>
            배너 설정 저장 및 즉시 반영
          </button>
        </form>
      </section>

      <hr className={styles.sectionDivider} />

      {/* 게시글 작성 / 수정 */}
      <section className={`${styles.section} ${styles.sectionPost}`}>
        <h3>{editingPostId ? '게시글 수정하기' : '새 게시글 등록하기'}</h3>
        <form className={styles.formColumn} onSubmit={handlePostSubmit}>
          <div>
            <label className={styles.formLabel}>제목</label>
            <input
              className={styles.input}
              type="text"
              placeholder="글 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={styles.formLabel}>내용</label>
            <div className={styles.quillWrapper}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                modules={QUILL_MODULES}
                value={content}
                onChange={setContent}
                placeholder="내용을 작성하세요. 이미지 붙여넣기(Ctrl+V) 및 파일 첨부 모두 지원합니다."
              />
            </div>
          </div>
          <div>
            <label className={styles.formLabel}>
              이미지 첨부
              {editingPostId && (
                <span className={styles.formLabelNote}>
                  (수정 시 미첨부하면 기존 이미지 유지)
                </span>
              )}
            </label>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
            />
            <p className={styles.formHint}>여러 장 선택 가능. 선택 시 본문에 자동 배치됩니다.</p>
          </div>
          <div className={styles.btnRow}>
            <button
              type="submit"
              disabled={uploading}
              className={`${styles.btn} ${editingPostId ? styles.btnWarning : styles.btnPrimary} ${styles.btnFullWidth} ${uploading ? styles.btnDisabled : ''}`}
            >
              {uploading ? '저장 중...' : editingPostId ? '수정 완료' : '게시글 저장'}
            </button>
            {editingPostId && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnNeutral}`}
                onClick={cancelEdit}
              >
                취소
              </button>
            )}
          </div>
        </form>
      </section>

      {/* 게시글 목록 */}
      <section>
        <div className={styles.listHeader}>
          <h3>등록된 게시글 목록 ({posts.length}개)</h3>
          <button
            className={`${styles.btn} ${styles.btnDanger} ${selectedPostIds.length === 0 ? styles.btnDisabled : ''}`}
            onClick={handleDeleteSelected}
            disabled={selectedPostIds.length === 0}
          >
            선택 삭제 ({selectedPostIds.length})
          </button>
        </div>

        <table className={styles.postTable}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={posts.length > 0 && selectedPostIds.length === posts.length}
                />
              </th>
              <th>글 제목 (클릭 시 수정)</th>
              <th>등록 일시</th>
              <th>이미지</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan="4" className={styles.postEmpty}>
                  등록된 글이 없습니다. 위 폼에서 첫 글을 작성해 보세요!
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr
                  key={post.id}
                  className={`${styles.postRow} ${editingPostId === post.id ? styles.postRowEditing : ''}`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedPostIds.includes(post.id)}
                      onChange={() => handleSelectPost(post.id)}
                    />
                  </td>
                  <td>
                    <span className={styles.postTitleLink} onClick={() => startEdit(post)}>
                      {post.title}
                    </span>
                  </td>
                  <td className={styles.postMeta}>
                    {post.createdAt?.toDate().toLocaleString() || '방금 전'}
                  </td>
                  <td className={styles.postMeta}>
                    {post.imageUrls?.length ?? 0}장
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
