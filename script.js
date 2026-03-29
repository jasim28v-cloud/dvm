// ========== إعدادات الأدمن ==========
const ADMIN_EMAILS = ['jasim28v@gmail.com'];
let isAdmin = false;

// ========== المتغيرات العامة ==========
let currentUser = null;
let currentUserData = null;
let currentVideoId = null;
let currentShareUrl = null;
let allUsers = {};
let allVideos = [];
let allSounds = {};
let isMuted = true;
let viewingProfileUserId = null;
let currentFeed = 'forYou';
let currentReplyTo = null;
let reportTargetId = null;
let reportTargetType = null;
let currentChatUserId = null;

// ========== دوال المصادقة ==========
function switchAuth(type) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (type === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    if (!email || !password) { msg.innerText = 'Please fill all fields'; return; }
    msg.innerText = 'Logging in...';
    try {
        await auth.signInWithEmailAndPassword(email, password);
        msg.innerText = '';
    } catch (error) {
        if (error.code === 'auth/user-not-found') msg.innerText = 'No account found';
        else if (error.code === 'auth/wrong-password') msg.innerText = 'Wrong password';
        else msg.innerText = 'Error: ' + error.message;
    }
}

async function register() {
    const username = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const msg = document.getElementById('regMsg');
    if (!username || !email || !password) { msg.innerText = 'Fill all fields'; return; }
    if (password.length < 6) { msg.innerText = 'Password must be 6+ chars'; return; }
    msg.innerText = 'Creating account...';
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.ref(`users/${userCredential.user.uid}`).set({
            username, email, bio: '', avatarUrl: '', followers: {}, following: {}, totalLikes: 0, createdAt: Date.now()
        });
        msg.innerText = '';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') msg.innerText = 'Email already used';
        else msg.innerText = 'Error: ' + error.message;
    }
}

function logout() { auth.signOut(); location.reload(); }

// ========== التحقق من الأدمن ==========
function checkAdminStatus() {
    if (currentUser && ADMIN_EMAILS.includes(currentUser.email)) {
        isAdmin = true;
        return true;
    }
    isAdmin = false;
    return false;
}

async function renderAdminPanel() {
    if (!isAdmin) return '';
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    const videosSnap = await db.ref('videos').once('value');
    const videos = videosSnap.val() || {};
    const totalLikes = Object.values(videos).reduce((sum, v) => sum + (v.likes || 0), 0);
    return `<div class="admin-panel-section"><h3>🔧 Admin Panel</h3><div class="admin-stats"><div class="admin-stat-card">Users: ${Object.keys(users).length}</div><div class="admin-stat-card">Videos: ${Object.keys(videos).length}</div><div class="admin-stat-card">Likes: ${totalLikes}</div></div><button onclick="adminClearAll()" style="background:red;padding:8px;border-radius:12px;">⚠️ Delete All Data</button></div>`;
}

async function adminClearAll() { if (!isAdmin) return; if(confirm('Delete ALL videos and users?')){ await db.ref('videos').remove(); await db.ref('users').remove(); alert('Deleted'); location.reload(); } }

// ========== تحميل البيانات ==========
async function loadUserData() { const snap = await db.ref(`users/${currentUser.uid}`).get(); if (snap.exists()) currentUserData = { uid: currentUser.uid, ...snap.val() }; }
db.ref('users').on('value', s => { allUsers = s.val() || {}; renderStories(); });

function addHashtags(text) { if (!text) return ''; return text.replace(/#(\w+)/g, '<span class="hashtag" onclick="searchHashtag(\'$1\')">#$1</span>'); }
function searchHashtag(tag) { document.getElementById('searchInput').value = '#' + tag; openSearch(); searchAll(); }

async function incrementViews(videoId) {
    if (!currentUser) return;
    const viewRef = db.ref(`videos/${videoId}/views`);
    const viewSnap = await viewRef.get();
    await viewRef.set((viewSnap.val() || 0) + 1);
}

db.ref('videos').on('value', (s) => {
    const data = s.val();
    if (!data) { allVideos = []; renderVideos(); return; }
    allVideos = []; allSounds = {};
    Object.keys(data).forEach(key => { const v = { id: key, ...data[key] }; allVideos.push(v); if (v.music) allSounds[v.music] = (allSounds[v.music] || 0) + 1; });
    allVideos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderVideos(); renderSoundsList();
});

function renderVideos() {
    const container = document.getElementById('videosContainer');
    if (!container) return;
    container.innerHTML = '';
    let filteredVideos = currentFeed === 'forYou' ? allVideos : allVideos.filter(v => currentUserData?.following?.[v.sender]);
    if (filteredVideos.length === 0) { container.innerHTML = '<div class="loading"><div class="spinner"></div><span>No videos</span></div>'; return; }
    filteredVideos.forEach(video => {
        const isLiked = video.likedBy && video.likedBy[currentUser?.uid];
        const user = allUsers[video.sender] || { username: video.senderName || 'user', avatarUrl: '' };
        const isFollowing = currentUserData?.following && currentUserData.following[video.sender];
        const commentsCount = video.comments ? Object.keys(video.comments).length : 0;
        const caption = addHashtags(video.description || '');
        const avatarHtml = (user.avatarUrl && user.avatarUrl !== '') ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0)?.toUpperCase() || '👤');
        const views = video.views || 0;
        const div = document.createElement('div'); div.className = 'video-item';
        div.innerHTML = `
            <video loop playsinline muted data-src="${video.url}" poster="${video.thumbnail || ''}"></video>
            <div class="video-info">
                <div class="author-info"><div class="author-avatar" onclick="viewProfile('${video.sender}')">${avatarHtml}</div><div class="author-name"><span onclick="viewProfile('${video.sender}')">@${user.username}</span>${currentUser?.uid !== video.sender ? `<button class="follow-btn" onclick="toggleFollow('${video.sender}', this)">${isFollowing ? 'متابع' : 'متابعة'}</button>` : ''}</div></div>
                <div class="video-caption">${caption}</div>
                <div class="video-music" onclick="searchBySound('${video.music || 'Original Sound'}')"><i class="fas fa-music"></i> ${video.music || 'Original Sound'}</div>
                <div class="views-count"><i class="fas fa-eye"></i> ${views} مشاهدة</div>
            </div>
            <div class="side-actions">
                <button class="side-btn" onclick="toggleGlobalMute()"><i class="fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i></button>
                <button class="side-btn like-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${video.id}', this)"><i class="fas fa-heart"></i><span class="count">${video.likes || 0}</span></button>
                <button class="side-btn" onclick="openComments('${video.id}')"><i class="fas fa-comment"></i><span class="count">${commentsCount}</span></button>
                <button class="side-btn" onclick="openShare('${video.url}')"><i class="fas fa-share"></i></button>
                <button class="side-btn" onclick="openReport('${video.id}', 'video')"><i class="fas fa-flag"></i></button>
            </div>
        `;
        const videoEl = div.querySelector('video');
        videoEl.addEventListener('dblclick', (e) => { e.stopPropagation(); const likeBtn = div.querySelector('.like-btn'); if (likeBtn) { toggleLike(video.id, likeBtn); showHeartAnimation(e.clientX, e.clientY); } });
        let viewsAdded = false;
        videoEl.addEventListener('play', () => { if (!viewsAdded && currentUser) { viewsAdded = true; incrementViews(video.id); } });
        container.appendChild(div);
    });
    initVideoObserver();
}
function showHeartAnimation(x, y) { const heart = document.createElement('div'); heart.className = 'heart-animation'; heart.innerHTML = '❤️'; heart.style.left = (x - 40) + 'px'; heart.style.top = (y - 40) + 'px'; document.body.appendChild(heart); setTimeout(() => heart.remove(), 800); }
function initVideoObserver() { const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { const video = entry.target.querySelector('video'); if (entry.isIntersecting) { if (!video.src) video.src = video.dataset.src; video.muted = isMuted; video.play().catch(()=>{}); } else video.pause(); }); }, { threshold: 0.65 }); document.querySelectorAll('.video-item').forEach(seg => observer.observe(seg)); }
function toggleGlobalMute() { isMuted = !isMuted; document.querySelectorAll('video').forEach(v => v.muted = isMuted); }
function switchFeed(feed) { currentFeed = feed; document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active')); event.target.classList.add('active'); renderVideos(); }

async function toggleLike(videoId, btn) { if (!currentUser) return; const videoRef = db.ref(`videos/${videoId}`); const snap = await videoRef.get(); const video = snap.val(); if (!video) return; let likes = video.likes || 0; let likedBy = video.likedBy || {}; if (likedBy[currentUser.uid]) { likes--; delete likedBy[currentUser.uid]; } else { likes++; likedBy[currentUser.uid] = true; await addNotification(video.sender, 'like', currentUser.uid); } await videoRef.update({ likes, likedBy }); btn.classList.toggle('active'); const countSpan = btn.querySelector('.count'); if (countSpan) countSpan.innerText = likes; }

async function toggleFollow(userId, btn) { if (!currentUser || currentUser.uid === userId) return; const userRef = db.ref(`users/${currentUser.uid}/following/${userId}`); const targetRef = db.ref(`users/${userId}/followers/${currentUser.uid}`); const snap = await userRef.get(); if (snap.exists()) { await userRef.remove(); await targetRef.remove(); btn.innerText = 'متابعة'; await addNotification(userId, 'unfollow', currentUser.uid); } else { await userRef.set(true); await targetRef.set(true); btn.innerText = 'متابع'; await addNotification(userId, 'follow', currentUser.uid); } if (viewingProfileUserId === userId) await loadProfileData(userId); renderStories(); }

async function openComments(videoId) {
    currentVideoId = videoId; currentReplyTo = null;
    const panel = document.getElementById('commentsPanel');
    const snap = await db.ref(`videos/${videoId}/comments`).get();
    const comments = snap.val() || {};
    const container = document.getElementById('commentsList');
    container.innerHTML = '';
    const mainComments = {}, replies = {};
    Object.entries(comments).forEach(([id, c]) => { if (c.parentId) { if (!replies[c.parentId]) replies[c.parentId] = []; replies[c.parentId].push({ id, ...c }); } else mainComments[id] = { id, ...c }; });
    for (const [id, comment] of Object.entries(mainComments)) {
        const user = allUsers[comment.userId] || { username: comment.username || 'user', avatarUrl: '' };
        const avatarHtml = (user.avatarUrl && user.avatarUrl !== '') ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0)?.toUpperCase() || '👤');
        const commentDiv = document.createElement('div'); commentDiv.className = 'comment-item';
        commentDiv.innerHTML = `<div class="comment-main"><div class="comment-avatar">${avatarHtml}</div><div class="comment-content"><div class="font-bold">@${user.username}</div><div class="text-sm">${comment.text}</div><div class="comment-actions"><span onclick="setReplyTo('${id}', '@${user.username}')">رد</span></div></div></div><div class="replies-container" id="replies-${id}"></div>`;
        container.appendChild(commentDiv);
        const repliesContainer = commentDiv.querySelector(`#replies-${id}`);
        if (replies[id]) { replies[id].forEach(reply => { const rUser = allUsers[reply.userId] || { username: reply.username || 'user' }; const rAvatar = rUser.avatarUrl ? `<img src="${rUser.avatarUrl}">` : (rUser.username?.charAt(0) || '👤'); const replyDiv = document.createElement('div'); replyDiv.className = 'comment-main mt-2'; replyDiv.innerHTML = `<div class="comment-avatar" style="width:32px;height:32px;">${rAvatar}</div><div class="comment-content"><div class="font-bold text-sm">@${rUser.username}</div><div class="text-xs">${reply.text}</div></div>`; repliesContainer.appendChild(replyDiv); }); }
    }
    if (container.innerHTML === '') container.innerHTML = '<div class="text-center">لا توجد تعليقات</div>';
    panel.classList.add('open');
}
function setReplyTo(commentId, username) { currentReplyTo = commentId; document.getElementById('commentInput').focus(); document.getElementById('commentInput').placeholder = `رد على ${username}...`; }
function closeComments() { document.getElementById('commentsPanel').classList.remove('open'); currentReplyTo = null; document.getElementById('commentInput').placeholder = 'أضف تعليقاً... استخدم @ للإشارة'; }
async function addComment() { const input = document.getElementById('commentInput'); if (!input.value.trim() || !currentVideoId) return; let text = input.value; const mentionMatches = text.match(/@(\w+)/g); if (mentionMatches) { for (const match of mentionMatches) { const username = match.substring(1); const user = Object.values(allUsers).find(u => u.username === username); if (user) await addNotification(user.uid, 'mention', currentUser.uid); } } const commentData = { userId: currentUser.uid, username: currentUserData?.username, text, timestamp: Date.now() }; if (currentReplyTo) commentData.parentId = currentReplyTo; await db.ref(`videos/${currentVideoId}/comments`).push(commentData); input.value = ''; currentReplyTo = null; openComments(currentVideoId); }
function showMentionSuggestions() { const input = document.getElementById('commentInput'); const value = input.value; const lastWord = value.split(' ').pop(); if (lastWord.startsWith('@')) { const searchTerm = lastWord.substring(1).toLowerCase(); const matches = Object.values(allUsers).filter(u => u.username.toLowerCase().includes(searchTerm) && u.uid !== currentUser?.uid); const div = document.getElementById('mentionSuggestions'); if (matches.length) { div.style.display = 'block'; div.innerHTML = matches.map(m => `<div class="mention-suggestion-item" onclick="insertMention('${m.username}')">@${m.username}</div>`).join(''); } else div.style.display = 'none'; } else document.getElementById('mentionSuggestions').style.display = 'none'; }
function insertMention(username) { const input = document.getElementById('commentInput'); input.value = input.value.replace(/@\w*$/, `@${username} `); document.getElementById('mentionSuggestions').style.display = 'none'; input.focus(); }

function openShare(url) { currentShareUrl = url; document.getElementById('sharePanel').classList.add('open'); }
function closeShare() { document.getElementById('sharePanel').classList.remove('open'); }
function copyLink() { navigator.clipboard.writeText(currentShareUrl); showToast(); closeShare(); }
function shareToWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(currentShareUrl)}`, '_blank'); closeShare(); }
function shareToTelegram() { window.open(`https://t.me/share/url?url=${encodeURIComponent(currentShareUrl)}`, '_blank'); closeShare(); }
function downloadVideo() { window.open(currentShareUrl, '_blank'); closeShare(); }
function showToast() { const t = document.getElementById('copyToast'); t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }

async function addNotification(targetUserId, type, fromUserId) { if (targetUserId === fromUserId) return; const fromUser = allUsers[fromUserId] || { username: 'مستخدم' }; const messages = { like: 'أعجب بفيديوك', comment: 'علق على فيديوك', follow: 'بدأ متابعتك', unfollow: 'توقف عن متابعتك', mention: 'أشار إليك' }; await db.ref(`notifications/${targetUserId}`).push({ type, fromUserId, fromUsername: fromUser.username, message: messages[type], timestamp: Date.now(), read: false }); }
async function openNotifications() { const panel = document.getElementById('notificationsPanel'); const snap = await db.ref(`notifications/${currentUser.uid}`).once('value'); const notifs = snap.val() || {}; const container = document.getElementById('notificationsList'); container.innerHTML = ''; Object.values(notifs).reverse().forEach(n => { container.innerHTML += `<div class="notification-item"><i class="fas ${n.type === 'like' ? 'fa-heart' : 'fa-user-plus'}"></i><div><b>${n.fromUsername}</b><div class="text-xs">${n.message}</div></div></div>`; if (!n.read) db.ref(`notifications/${currentUser.uid}/${Object.keys(notifs).find(k=>notifs[k]===n)}/read`).set(true); }); panel.classList.add('open'); }
function closeNotifications() { document.getElementById('notificationsPanel').classList.remove('open'); }

function openReport(id, type) { reportTargetId = id; reportTargetType = type; document.getElementById('reportPanel').classList.add('open'); }
function closeReportPanel() { document.getElementById('reportPanel').classList.remove('open'); reportTargetId = null; }
async function submitReport(reason) { if (!reportTargetId || !currentUser) return; await db.ref('reports').push({ targetId: reportTargetId, targetType: reportTargetType, reason, reportedBy: currentUser.uid, timestamp: Date.now() }); alert('تم الإبلاغ'); closeReportPanel(); }

function openSearch() { document.getElementById('searchPanel').classList.add('open'); }
function closeSearch() { document.getElementById('searchPanel').classList.remove('open'); }
function searchAll() { const query = document.getElementById('searchInput').value.toLowerCase(); const resultsDiv = document.getElementById('searchResults'); if (!query) { resultsDiv.innerHTML = ''; return; } const users = Object.values(allUsers).filter(u => u.username.toLowerCase().includes(query)); const videos = allVideos.filter(v => v.description?.toLowerCase().includes(query) || v.music?.toLowerCase().includes(query)); const hashtags = [...new Set(allVideos.flatMap(v => (v.description?.match(/#\w+/g) || []).filter(h => h.toLowerCase().includes(query))))]; resultsDiv.innerHTML = `${users.length ? `<div><h4>Users</h4>${users.map(u => `<div class="search-result" onclick="viewProfile('${u.uid}')"><div class="search-avatar">${u.avatarUrl ? `<img src="${u.avatarUrl}">` : u.username[0]}</div><div>@${u.username}</div></div>`).join('')}</div>` : ''}${hashtags.length ? `<div><h4>Hashtags</h4>${hashtags.map(h => `<div class="search-result" onclick="searchHashtag('${h.substring(1)}')"><i class="fas fa-hashtag"></i> ${h}</div>`).join('')}</div>` : ''}${videos.length ? `<div><h4>Videos</h4>${videos.map(v => `<div class="search-result" onclick="playVideo('${v.url}')"><i class="fas fa-video"></i> ${v.description?.substring(0,40)}</div>`).join('')}</div>` : ''}`; }

function openSounds() { document.getElementById('soundsPanel').classList.add('open'); }
function closeSounds() { document.getElementById('soundsPanel').classList.remove('open'); }
function renderSoundsList() { const container = document.getElementById('soundsList'); if (!container) return; const sorted = Object.entries(allSounds).sort((a,b)=>b[1]-a[1]); container.innerHTML = sorted.map(([name,count])=>`<div class="sound-item" onclick="searchBySound('${name}')"><div class="sound-icon"><i class="fas fa-music"></i></div><div>${name}<div class="text-xs">${count} videos</div></div></div>`).join(''); }
function searchBySound(soundName) { document.getElementById('searchInput').value = soundName; closeSounds(); openSearch(); searchAll(); }

async function viewProfile(userId) { viewingProfileUserId = userId; await loadProfileData(userId); document.getElementById('profilePanel').classList.add('open'); }
async function loadProfileData(userId) {
    const userSnap = await db.ref(`users/${userId}`).get(); const user = userSnap.val(); if (!user) return;
    const avatarDisplay = document.getElementById('profileAvatarDisplay'); if (user.avatarUrl) avatarDisplay.innerHTML = `<img src="${user.avatarUrl}">`; else avatarDisplay.innerHTML = user.username?.charAt(0) || '👤';
    document.getElementById('profileNameDisplay').innerText = user.username; document.getElementById('profileBioDisplay').innerText = user.bio || '';
    document.getElementById('profileFollowers').innerText = Object.keys(user.followers || {}).length; document.getElementById('profileFollowing').innerText = Object.keys(user.following || {}).length;
    const userVideos = allVideos.filter(v => v.sender === userId); const totalLikes = userVideos.reduce((s,v)=>s+(v.likes||0),0); document.getElementById('profileLikes').innerText = totalLikes;
    const container = document.getElementById('profileVideosList'); container.innerHTML = ''; userVideos.forEach(v => { const thumb = document.createElement('div'); thumb.className = 'video-thumb'; thumb.innerHTML = '<i class="fas fa-play"></i>'; thumb.onclick = () => playVideo(v.url); container.appendChild(thumb); });
    const actionsDiv = document.getElementById('profileActions'); actionsDiv.innerHTML = '';
    if (userId === currentUser?.uid) { actionsDiv.innerHTML = `<button class="edit-profile-btn" onclick="openEditProfile()">تعديل الملف</button><button class="logout-btn" onclick="logout()">تسجيل خروج</button>`; if (isAdmin) actionsDiv.innerHTML += await renderAdminPanel(); }
    else { const isFollowing = currentUserData?.following && currentUserData.following[userId]; actionsDiv.innerHTML = `<button class="follow-btn" onclick="toggleFollow('${userId}', this)">${isFollowing ? 'متابع' : 'متابعة'}</button><button class="edit-profile-btn" onclick="openPrivateChat('${userId}')"><i class="fas fa-envelope"></i> رسالة</button>`; }
}
function openMyProfile() { if (currentUser) viewProfile(currentUser.uid); }
function closeProfile() { document.getElementById('profilePanel').classList.remove('open'); }
function openEditProfile() { document.getElementById('editUsername').value = currentUserData?.username || ''; document.getElementById('editBio').value = currentUserData?.bio || ''; document.getElementById('editProfilePanel').classList.add('open'); }
function closeEditProfile() { document.getElementById('editProfilePanel').classList.remove('open'); }
async function saveProfile() { const newUsername = document.getElementById('editUsername').value; const newBio = document.getElementById('editBio').value; await db.ref(`users/${currentUser.uid}`).update({ username: newUsername, bio: newBio }); currentUserData.username = newUsername; currentUserData.bio = newBio; closeEditProfile(); if (viewingProfileUserId === currentUser.uid) await loadProfileData(currentUser.uid); renderVideos(); }
function changeAvatar() { document.getElementById('avatarInput').click(); }
async function uploadAvatar(input) { const file = input.files[0]; if (!file) return; const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET); const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd }); const data = await res.json(); await db.ref(`users/${currentUser.uid}/avatarUrl`).set(data.secure_url); currentUserData.avatarUrl = data.secure_url; if (viewingProfileUserId === currentUser.uid) await loadProfileData(currentUser.uid); renderVideos(); renderStories(); }
function playVideo(url) { window.open(url, '_blank'); }

async function renderStories() { if (!currentUser) return; const container = document.getElementById('storiesContainer'); if (!container) return; const following = currentUserData?.following || {}; let storiesUsers = [{ uid: currentUser.uid, username: currentUserData?.username, avatarUrl: currentUserData?.avatarUrl, isCurrentUser: true }]; for (const id of Object.keys(following)) { const user = allUsers[id]; if (user) storiesUsers.push({ uid: id, username: user.username, avatarUrl: user.avatarUrl }); } storiesUsers = storiesUsers.slice(0,15); container.innerHTML = storiesUsers.map(user => `<div class="story-item" onclick="alert('Stories coming soon')"><div class="story-avatar">${user.avatarUrl ? `<img src="${user.avatarUrl}">` : `<div>${user.username?.charAt(0)?.toUpperCase() || '👤'}</div>`}</div><div class="story-name">${user.isCurrentUser ? 'قصتك' : '@' + (user.username?.substring(0,10)||'')}</div></div>`).join(''); }

function toggleDarkMode() { document.body.classList.toggle('light-mode'); const isLight = document.body.classList.contains('light-mode'); document.getElementById('darkModeText').innerText = isLight ? 'فاتح' : 'داكن'; localStorage.setItem('darkMode', isLight ? 'light' : 'dark'); }
if (localStorage.getItem('darkMode') === 'light') { document.body.classList.add('light-mode'); document.getElementById('darkModeText').innerText = 'فاتح'; }

async function openConversations() { const panel = document.getElementById('conversationsPanel'); const container = document.getElementById('conversationsList'); const convSnap = await db.ref(`private_chats/${currentUser.uid}`).once('value'); const convs = convSnap.val() || {}; container.innerHTML = ''; for (const [otherId, data] of Object.entries(convs)) { const user = allUsers[otherId]; if(user) container.innerHTML += `<div class="conversation-item" onclick="openPrivateChat('${otherId}')"><div class="conversation-avatar">${user.avatarUrl ? `<img src="${user.avatarUrl}">` : user.username[0]}</div><div><b>@${user.username}</b><div class="text-xs">${data.lastMessage?.substring(0,30)||''}</div></div></div>`; } if(container.innerHTML==='') container.innerHTML='<div class="text-center">No conversations</div>'; panel.classList.add('open'); }
function closeConversations() { document.getElementById('conversationsPanel').classList.remove('open'); }
async function openPrivateChat(otherUserId) { currentChatUserId = otherUserId; const user = allUsers[otherUserId]; document.getElementById('chatUserName').innerText = `@${user?.username}`; await loadPrivateMessages(otherUserId); document.getElementById('privateChatPanel').classList.add('open'); closeConversations(); }
function closePrivateChat() { document.getElementById('privateChatPanel').classList.remove('open'); currentChatUserId = null; }
async function loadPrivateMessages(otherUserId) { const container = document.getElementById('privateMessagesList'); container.innerHTML = '<div class="loading">Loading...</div>'; const chatId = getChatId(currentUser.uid, otherUserId); const snap = await db.ref(`private_messages/${chatId}`).once('value'); const msgs = snap.val() || {}; container.innerHTML = ''; Object.values(msgs).sort((a,b)=>a.timestamp-b.timestamp).forEach(msg => { const isSent = msg.senderId === currentUser.uid; const time = new Date(msg.timestamp).toLocaleTimeString(); let content = msg.type === 'image' ? `<img src="${msg.imageUrl}" style="max-width:150px;border-radius:12px;">` : `<div class="message-bubble ${isSent ? 'sent' : 'received'}">${msg.text}</div>`; container.innerHTML += `<div class="private-message ${isSent ? 'sent' : 'received'}"><div>${content}<div class="message-time">${time}</div></div></div>`; }); container.scrollTop = container.scrollHeight; }
async function sendPrivateMessage() { const input = document.getElementById('privateMessageInput'); const text = input.value.trim(); if(!text || !currentChatUserId) return; const chatId = getChatId(currentUser.uid, currentChatUserId); await db.ref(`private_messages/${chatId}`).push({ senderId: currentUser.uid, text, type: 'text', timestamp: Date.now() }); await db.ref(`private_chats/${currentUser.uid}/${currentChatUserId}`).set({ lastMessage: text, lastTimestamp: Date.now() }); await db.ref(`private_chats/${currentChatUserId}/${currentUser.uid}`).set({ lastMessage: text, lastTimestamp: Date.now() }); input.value = ''; await loadPrivateMessages(currentChatUserId); }
function getChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }

let selectedVideoFile = null;
function openUploadPanel() { document.getElementById('uploadPanel').classList.add('open'); resetUploadForm(); }
function closeUploadPanel() { document.getElementById('uploadPanel').classList.remove('open'); resetUploadForm(); }
function resetUploadForm() { selectedVideoFile = null; document.getElementById('videoPreview').style.display = 'none'; document.querySelector('.video-preview-area').style.display = 'block'; document.getElementById('videoDescription').value = ''; document.getElementById('videoMusic').value = ''; document.getElementById('uploadProgressBar').style.display = 'none'; document.getElementById('uploadStatus').innerHTML = ''; }
function previewVideo(file) { if (!file) return; selectedVideoFile = file; const reader = new FileReader(); reader.onload = e => { const preview = document.getElementById('videoPreview'); preview.src = e.target.result; preview.style.display = 'block'; document.querySelector('.video-preview-area').style.display = 'none'; }; reader.readAsDataURL(file); }
function selectVideoFile(input) { const file = input.files[0]; if(file && file.type.startsWith('video/')) previewVideo(file); else alert('Please select a video'); }
async function uploadVideoWithDetails() { if(!selectedVideoFile) { alert('Select a video first'); return; } const description = document.getElementById('videoDescription').value; const music = document.getElementById('videoMusic').value || 'Original Sound'; const progressBar = document.getElementById('uploadProgressBar'); const progressFill = document.getElementById('progressFill'); const statusDiv = document.getElementById('uploadStatus'); progressBar.style.display = 'block'; try { const fd = new FormData(); fd.append('file', selectedVideoFile); fd.append('upload_preset', UPLOAD_PRESET); fd.append('resource_type', 'video'); const xhr = new XMLHttpRequest(); xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`); xhr.upload.onprogress = (e) => { if(e.lengthComputable) progressFill.style.width = (e.loaded/e.total)*100+'%'; }; const response = await new Promise((resolve,reject)=>{ xhr.onload=()=>resolve(xhr); xhr.onerror=()=>reject(xhr); xhr.send(fd); }); const result = JSON.parse(response.responseText); await db.ref('videos/').push({ url: result.secure_url, thumbnail: result.secure_url.replace('.mp4','.jpg'), description, music, sender: currentUser.uid, senderName: currentUserData?.username, likes: 0, likedBy: {}, comments: {}, views: 0, timestamp: Date.now() }); statusDiv.innerHTML = '✅ Uploaded!'; setTimeout(()=>{ closeUploadPanel(); renderVideos(); },1500); } catch(e) { statusDiv.innerHTML = '❌ Upload failed'; console.error(e); } }

function switchTab(tab) { document.querySelectorAll('.nav-item').forEach(t=>t.classList.remove('active')); if(event.target.closest('.nav-item')) event.target.closest('.nav-item').classList.add('active'); if(tab === 'search') openSearch(); if(tab === 'notifications') openNotifications(); if(tab === 'home') { closeSearch(); closeNotifications(); closeProfile(); closeSounds(); closeUploadPanel(); closeConversations(); closePrivateChat(); } }

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user; await loadUserData(); checkAdminStatus();
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        renderStories();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});
console.log('✅ SHΔDØW System Ready with all features');
