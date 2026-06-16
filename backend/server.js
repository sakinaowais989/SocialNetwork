const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create directories
const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(__dirname, 'uploads/images');
const storiesDir = path.join(__dirname, 'uploads/stories');

[uploadsDir, imagesDir, storiesDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// File upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'media') cb(null, storiesDir);
        else cb(null, imagesDir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Data stores
const users = new Map();
const posts = new Map();
const comments = new Map();
const friendRequests = new Map();
const notifications = new Map();
const stories = new Map();
const clients = new Map();
const onlineUsers = new Map();
const JWT_SECRET = 'secret123';

console.log('🚀 Server Starting on Port 5003...');

// Helper Functions
function sendNotification(userId, notification) {
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'notification', data: notification }));
    }
    const userNotifs = notifications.get(userId) || [];
    userNotifs.unshift({ ...notification, read: false, id: uuidv4(), createdAt: new Date() });
    notifications.set(userId, userNotifs.slice(0, 50));
}

function broadcastOnlineStatus(userId, status) {
    const user = Array.from(users.values()).find(u => u.userId === userId);
    if (user && user.friends) {
        user.friends.forEach(friendId => {
            const friendWs = clients.get(friendId);
            if (friendWs && friendWs.readyState === WebSocket.OPEN) {
                friendWs.send(JSON.stringify({ 
                    type: 'user_status', 
                    data: { userId, fullName: user.fullName, online: status, avatar: user.avatar }
                }));
            }
        });
    }
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ============ TEST ROUTE ============
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// ============ AUTH ============
app.post('/api/register', async (req, res) => {
    console.log('📝 Register:', req.body.email);
    const { username, email, password, fullName } = req.body;
    
    if (users.has(email)) {
        console.log('❌ User already exists:', email);
        return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
        userId: uuidv4(),
        username,
        email,
        password: hashedPassword,
        fullName,
        bio: '',
        avatar: `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${encodeURIComponent(fullName)}`,
        coverPhoto: null,
        privacy: 'public',
        friends: [],
        createdAt: new Date()
    };
    users.set(email, user);
    console.log('✅ User registered:', email);
    
    const token = jwt.sign({ userId: user.userId, email }, JWT_SECRET);
    res.json({ 
        token, 
        user: { ...user, password: undefined } 
    });
});

app.post('/api/login', async (req, res) => {
    console.log('🔐 Login:', req.body.email);
    const { email, password } = req.body;
    
    const user = users.get(email);
    if (!user) {
        console.log('❌ User not found:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        console.log('❌ Wrong password:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('✅ Login successful:', email);
    onlineUsers.set(user.userId, true);
    broadcastOnlineStatus(user.userId, true);
    
    const token = jwt.sign({ userId: user.userId, email }, JWT_SECRET);
    res.json({ 
        token, 
        user: { ...user, password: undefined } 
    });
});

app.get('/api/me', authenticate, (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    res.json({ ...user, password: undefined });
});

// ============ PROFILE ============
app.put('/api/profile/update', authenticate, upload.single('avatar'), (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    if (user) {
        if (req.body.bio !== undefined) user.bio = req.body.bio;
        if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
        if (req.file) user.avatar = `http://localhost:5003/uploads/images/${req.file.filename}`;
        res.json({ success: true, user: { ...user, password: undefined } });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.put('/api/profile/cover', authenticate, upload.single('cover'), (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    if (user && req.file) {
        user.coverPhoto = `http://localhost:5003/uploads/images/${req.file.filename}`;
        res.json({ success: true, coverPhoto: user.coverPhoto });
    } else {
        res.status(404).json({ error: 'Upload failed' });
    }
});

app.put('/api/settings/privacy', authenticate, (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    if (user) {
        user.privacy = req.body.privacy;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// ============ USERS ============
app.get('/api/users/search', authenticate, (req, res) => {
    const query = req.query.q?.toLowerCase() || '';
    const result = Array.from(users.values())
        .filter(u => u.userId !== req.userId && 
               (u.username.toLowerCase().includes(query) || u.fullName.toLowerCase().includes(query)))
        .map(u => ({ 
            userId: u.userId, 
            username: u.username, 
            fullName: u.fullName, 
            avatar: u.avatar, 
            isFriend: u.friends.includes(req.userId) 
        }));
    res.json(result);
});

// ============ FRIENDS ============
app.post('/api/friends/request/:userId', authenticate, (req, res) => {
    const toUserId = req.params.userId;
    const fromUser = Array.from(users.values()).find(u => u.userId === req.userId);
    const toUser = Array.from(users.values()).find(u => u.userId === toUserId);
    
    if (!toUser) return res.status(404).json({ error: 'User not found' });
    if (fromUser.friends.includes(toUserId)) return res.status(400).json({ error: 'Already friends' });
    
    const existing = friendRequests.get(toUserId) || [];
    if (existing.some(r => r.fromUserId === req.userId && r.status === 'pending')) {
        return res.status(400).json({ error: 'Request already sent' });
    }
    
    existing.push({ 
        requestId: uuidv4(), 
        fromUserId: req.userId, 
        fromUserName: fromUser.fullName, 
        fromUserAvatar: fromUser.avatar, 
        status: 'pending', 
        createdAt: new Date() 
    });
    friendRequests.set(toUserId, existing);
    
    sendNotification(toUserId, {
        type: 'friend_request',
        message: `${fromUser.fullName} sent you a friend request`,
        fromUserId: req.userId, fromUserName: fromUser.fullName
    });
    res.json({ success: true });
});

app.post('/api/friends/accept/:requestId', authenticate, (req, res) => {
    const requests = friendRequests.get(req.userId) || [];
    const request = requests.find(r => r.requestId === req.params.requestId);
    if (!request) return res.status(404).json({ error: 'Not found' });
    
    request.status = 'accepted';
    const currentUser = Array.from(users.values()).find(u => u.userId === req.userId);
    const fromUser = Array.from(users.values()).find(u => u.userId === request.fromUserId);
    
    if (currentUser && fromUser) {
        if (!currentUser.friends.includes(request.fromUserId)) currentUser.friends.push(request.fromUserId);
        if (!fromUser.friends.includes(req.userId)) fromUser.friends.push(req.userId);
        
        sendNotification(request.fromUserId, {
            type: 'friend_accept',
            message: `${currentUser.fullName} accepted your friend request`,
            fromUserId: req.userId, fromUserName: currentUser.fullName
        });
    }
    res.json({ success: true });
});

app.post('/api/friends/reject/:requestId', authenticate, (req, res) => {
    const requests = friendRequests.get(req.userId) || [];
    const index = requests.findIndex(r => r.requestId === req.params.requestId);
    if (index !== -1) {
        requests.splice(index, 1);
        friendRequests.set(req.userId, requests);
    }
    res.json({ success: true });
});

app.get('/api/friends/requests', authenticate, (req, res) => {
    res.json((friendRequests.get(req.userId) || []).filter(r => r.status === 'pending'));
});

app.get('/api/friends', authenticate, (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    if (!user) return res.json([]);
    const friends = user.friends.map(friendId => {
        const friend = Array.from(users.values()).find(u => u.userId === friendId);
        return friend ? { 
            userId: friend.userId, 
            username: friend.username, 
            fullName: friend.fullName, 
            avatar: friend.avatar, 
            online: onlineUsers.get(friend.userId) || false 
        } : null;
    }).filter(Boolean);
    res.json(friends);
});

// ============ POSTS ============
app.post('/api/posts', authenticate, upload.single('image'), (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const post = {
        postId: uuidv4(),
        userId: req.userId,
        userName: user.fullName,
        userAvatar: user.avatar,
        content: req.body.content || '',
        image: req.file ? `http://localhost:5003/uploads/images/${req.file.filename}` : null,
        privacy: req.body.privacy || 'public',
        createdAt: new Date(),
        likes: [],
        likeCount: 0,
        commentCount: 0,
        shareCount: 0
    };
    posts.set(post.postId, post);
    
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'new_post', data: post }));
        }
    });
    res.json({ success: true, post });
});

app.get('/api/posts/feed', authenticate, (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    let feedPosts = Array.from(posts.values());
    
    if (user) {
        feedPosts = feedPosts.filter(post => {
            if (post.userId === req.userId) return true;
            if (post.privacy === 'public') return true;
            if (post.privacy === 'friends' && user.friends.includes(post.userId)) return true;
            return false;
        });
    }
    feedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(feedPosts);
});

app.delete('/api/posts/:postId', authenticate, (req, res) => {
    const post = posts.get(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });
    posts.delete(req.params.postId);
    res.json({ success: true });
});

app.put('/api/posts/:postId', authenticate, (req, res) => {
    const post = posts.get(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });
    post.content = req.body.content || post.content;
    res.json({ success: true, post });
});

app.post('/api/posts/:postId/like', authenticate, (req, res) => {
    const post = posts.get(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Not found' });
    
    const liked = post.likes.includes(req.userId);
    if (liked) {
        post.likes = post.likes.filter(id => id !== req.userId);
        post.likeCount--;
    } else {
        post.likes.push(req.userId);
        post.likeCount++;
        
        if (post.userId !== req.userId) {
            const liker = Array.from(users.values()).find(u => u.userId === req.userId);
            sendNotification(post.userId, {
                type: 'like',
                message: `${liker.fullName} liked your post`,
                fromUserId: req.userId, fromUserName: liker.fullName
            });
        }
    }
    res.json({ likeCount: post.likeCount, liked: !liked });
});

app.post('/api/posts/:postId/comment', authenticate, (req, res) => {
    const post = posts.get(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Not found' });
    
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    const comment = {
        commentId: uuidv4(),
        userId: req.userId,
        userName: user.fullName,
        userAvatar: user.avatar,
        content: req.body.content,
        createdAt: new Date()
    };
    
    const postComments = comments.get(post.postId) || [];
    postComments.push(comment);
    comments.set(post.postId, postComments);
    post.commentCount = postComments.length;
    
    if (post.userId !== req.userId) {
        sendNotification(post.userId, {
            type: 'comment',
            message: `${user.fullName} commented: "${req.body.content.slice(0, 50)}"`,
            fromUserId: req.userId, fromUserName: user.fullName
        });
    }
    res.json({ success: true, comment });
});

app.get('/api/posts/:postId/comments', authenticate, (req, res) => {
    res.json(comments.get(req.params.postId) || []);
});

app.post('/api/posts/:postId/share', authenticate, (req, res) => {
    const originalPost = posts.get(req.params.postId);
    if (!originalPost) return res.status(404).json({ error: 'Not found' });
    
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    const sharedPost = {
        postId: uuidv4(),
        userId: req.userId,
        userName: user.fullName,
        userAvatar: user.avatar,
        content: `Shared ${originalPost.userName}'s post`,
        image: originalPost.image,
        privacy: 'public',
        createdAt: new Date(),
        likes: [],
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        isShared: true,
        originalPostId: originalPost.postId,
        originalPostUserName: originalPost.userName,
        originalPostContent: originalPost.content
    };
    posts.set(sharedPost.postId, sharedPost);
    originalPost.shareCount = (originalPost.shareCount || 0) + 1;
    res.json({ success: true, post: sharedPost });
});

app.get('/api/notifications', authenticate, (req, res) => {
    res.json(notifications.get(req.userId) || []);
});

// ============ STORIES ============
app.post('/api/stories', authenticate, upload.single('media'), (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const story = {
        storyId: uuidv4(),
        userId: req.userId,
        userName: user.fullName,
        userAvatar: user.avatar,
        media: `http://localhost:5003/uploads/stories/${req.file.filename}`,
        type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    stories.set(story.storyId, story);
    res.json({ success: true, story });
});

app.get('/api/stories/feed', authenticate, (req, res) => {
    const user = Array.from(users.values()).find(u => u.userId === req.userId);
    const friendIds = [req.userId, ...(user?.friends || [])];
    const activeStories = Array.from(stories.values())
        .filter(s => friendIds.includes(s.userId) && new Date(s.expiresAt) > new Date())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(activeStories);
});

// ============ WEBSOCKET ============
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            clients.set(decoded.userId, ws);
            onlineUsers.set(decoded.userId, true);
            console.log(`✅ User ${decoded.userId} online`);
            
            broadcastOnlineStatus(decoded.userId, true);
            
            ws.on('close', () => {
                clients.delete(decoded.userId);
                onlineUsers.set(decoded.userId, false);
                broadcastOnlineStatus(decoded.userId, false);
                console.log(`❌ User ${decoded.userId} offline`);
            });
        } catch (err) {
            console.log('❌ WebSocket auth failed');
        }
    }
    // ============ MESSAGE ROUTES ============
app.post('/api/messages', authenticate, (req, res) => {
    const { toUserId, content } = req.body;
    const fromUser = Array.from(users.values()).find(u => u.userId === req.userId);
    const toUser = Array.from(users.values()).find(u => u.userId === toUserId);
    
    if (!toUser) return res.status(404).json({ error: 'User not found' });
    
    const message = {
        messageId: uuidv4(),
        fromUserId: req.userId,
        fromUserName: fromUser.fullName,
        fromUserAvatar: fromUser.avatar,
        toUserId: toUserId,
        toUserName: toUser.fullName,
        toUserAvatar: toUser.avatar,
        content: content,
        createdAt: new Date(),
        read: false
    };
    
    // Store messages (use Map in memory)
    const messages = new Map();
    const conversationId = [req.userId, toUserId].sort().join('-');
    const conversation = messages.get(conversationId) || [];
    conversation.push(message);
    messages.set(conversationId, conversation);
    
    // Send real-time message
    const toWs = clients.get(toUserId);
    if (toWs && toWs.readyState === WebSocket.OPEN) {
        toWs.send(JSON.stringify({ type: 'new_message', data: message }));
    }
    
    res.json({ success: true, message });
});

app.get('/api/messages', authenticate, (req, res) => {
    // Return all conversations for user
    res.json([]); // Simplified
});

app.get('/api/messages/:userId', authenticate, (req, res) => {
    const conversationId = [req.userId, req.params.userId].sort().join('-');
    // Return messages
    res.json([]); // Simplified
});
});

const PORT = 5003;
server.listen(PORT, () => {
    console.log(`\n🚀 =========================================`);
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🚀 http://localhost:${PORT}`);
    console.log(`🚀 WebSocket: ws://localhost:${PORT}`);
    console.log(`🚀 =========================================\n`);
});