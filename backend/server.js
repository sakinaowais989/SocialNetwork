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

// ============ CONFIGURATION ============
const PORT = process.env.PORT || 5003;
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Dynamic Base URL
const getBaseUrl = () => {
    if (process.env.RAILWAY_STATIC_URL) {
        return `https://${process.env.RAILWAY_STATIC_URL}`;
    }
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL;
    }
    return `http://localhost:${PORT}`;
};

// ============ MIDDLEWARE ============
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://socialnetwork-production-f406.up.railway.app',
        'https://social-network-pink-six.vercel.app/',
        '*'
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ STATIC FILES ============
const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(__dirname, 'uploads/images');
const storiesDir = path.join(__dirname, 'uploads/stories');

[uploadsDir, imagesDir, storiesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created: ${dir}`);
    }
});

// Serve static files
app.use('/uploads', express.static(uploadsDir));

// ============ FILE UPLOAD ============
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'media' || file.fieldname === 'story') {
            cb(null, storiesDir);
        } else {
            cb(null, imagesDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// ============ DATA STORES ============
const users = new Map();
const posts = new Map();
const comments = new Map();
const friendRequests = new Map();
const notifications = new Map();
const stories = new Map();
const messages = new Map();
const clients = new Map();
const onlineUsers = new Map();

// ============ HELPER FUNCTIONS ============
const getFullImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    const baseUrl = getBaseUrl();
    if (path.startsWith('/uploads/')) {
        return `${baseUrl}${path}`;
    }
    return `${baseUrl}/uploads/${path}`;
};

const sendNotification = (userId, notification) => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'notification', data: notification }));
    }
    const userNotifs = notifications.get(userId) || [];
    userNotifs.unshift({ ...notification, read: false, id: uuidv4(), createdAt: new Date() });
    notifications.set(userId, userNotifs.slice(0, 50));
};

const broadcastOnlineStatus = (userId, status) => {
    const user = Array.from(users.values()).find(u => u.userId === userId);
    if (user && user.friends) {
        user.friends.forEach(friendId => {
            const friendWs = clients.get(friendId);
            if (friendWs && friendWs.readyState === 1) {
                friendWs.send(JSON.stringify({
                    type: 'user_status',
                    data: { userId, fullName: user.fullName, online: status, avatar: getFullImageUrl(user.avatar) }
                }));
            }
        });
    }
};

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// ============ AUTH ROUTES ============
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, fullName } = req.body;
        
        if (users.has(email)) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const existingUser = Array.from(users.values()).find(u => u.username === username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
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
        
        const token = jwt.sign({ userId: user.userId, email }, JWT_SECRET);
        const { password: _, ...userWithoutPassword } = user;
        res.json({ token, user: userWithoutPassword });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.get(email);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        onlineUsers.set(user.userId, true);
        broadcastOnlineStatus(user.userId, true);
        
        const token = jwt.sign({ userId: user.userId, email }, JWT_SECRET);
        const { password: _, ...userWithoutPassword } = user;
        res.json({ token, user: userWithoutPassword });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/me', authenticate, (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { password: _, ...userWithoutPassword } = user;
        if (userWithoutPassword.avatar) {
            userWithoutPassword.avatar = getFullImageUrl(userWithoutPassword.avatar);
        }
        if (userWithoutPassword.coverPhoto) {
            userWithoutPassword.coverPhoto = getFullImageUrl(userWithoutPassword.coverPhoto);
        }
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Get user failed' });
    }
});

// ============ PROFILE ROUTES ============
app.put('/api/profile/update', authenticate, upload.single('avatar'), (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (req.body.bio !== undefined) user.bio = req.body.bio;
        if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
        if (req.body.username !== undefined) {
            const existing = Array.from(users.values()).find(u => u.username === req.body.username && u.userId !== req.userId);
            if (existing) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            user.username = req.body.username;
        }
        if (req.file) {
            user.avatar = `/uploads/images/${req.file.filename}`;
        }
        
        const { password: _, ...userWithoutPassword } = user;
        if (userWithoutPassword.avatar) {
            userWithoutPassword.avatar = getFullImageUrl(userWithoutPassword.avatar);
        }
        if (userWithoutPassword.coverPhoto) {
            userWithoutPassword.coverPhoto = getFullImageUrl(userWithoutPassword.coverPhoto);
        }
        res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Profile update failed' });
    }
});

app.put('/api/profile/cover', authenticate, upload.single('cover'), (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        user.coverPhoto = `/uploads/images/${req.file.filename}`;
        res.json({ success: true, coverPhoto: getFullImageUrl(user.coverPhoto) });
    } catch (error) {
        console.error('Cover upload error:', error);
        res.status(500).json({ error: 'Cover upload failed' });
    }
});

app.put('/api/settings/privacy', authenticate, (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.privacy = req.body.privacy || 'public';
        res.json({ success: true });
    } catch (error) {
        console.error('Privacy update error:', error);
        res.status(500).json({ error: 'Privacy update failed' });
    }
});

// ============ SEARCH ============
app.get('/api/users/search', authenticate, (req, res) => {
    try {
        const query = req.query.q?.toLowerCase() || '';
        const currentUser = Array.from(users.values()).find(u => u.userId === req.userId);
        
        const results = Array.from(users.values())
            .filter(u => {
                if (u.userId === req.userId) return false;
                return u.username.toLowerCase().includes(query) || 
                       u.fullName.toLowerCase().includes(query);
            })
            .map(u => {
                const isFriend = currentUser?.friends.includes(u.userId) || false;
                const userRequests = friendRequests.get(u.userId) || [];
                const isRequested = userRequests.some(r => r.fromUserId === req.userId && r.status === 'pending');
                const pendingReqs = friendRequests.get(req.userId) || [];
                const isPending = pendingReqs.some(r => r.fromUserId === u.userId && r.status === 'pending');
                
                return {
                    userId: u.userId,
                    username: u.username,
                    fullName: u.fullName,
                    avatar: getFullImageUrl(u.avatar),
                    isFriend,
                    isRequested,
                    isPending
                };
            });
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ============ FRIEND ROUTES ============
app.post('/api/friends/request/:userId', authenticate, (req, res) => {
    try {
        const toUserId = req.params.userId;
        const fromUser = Array.from(users.values()).find(u => u.userId === req.userId);
        const toUser = Array.from(users.values()).find(u => u.userId === toUserId);

        if (!toUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (fromUser.friends.includes(toUserId)) {
            return res.status(400).json({ error: 'Already friends' });
        }

        const existing = friendRequests.get(toUserId) || [];
        if (existing.some(r => r.fromUserId === req.userId && r.status === 'pending')) {
            return res.status(400).json({ error: 'Request already sent' });
        }

        existing.push({
            requestId: uuidv4(),
            fromUserId: req.userId,
            fromUserName: fromUser.fullName,
            fromUserAvatar: getFullImageUrl(fromUser.avatar),
            status: 'pending',
            createdAt: new Date()
        });
        friendRequests.set(toUserId, existing);

        sendNotification(toUserId, {
            type: 'friend_request',
            message: `${fromUser.fullName} sent you a friend request`,
            fromUserId: req.userId,
            fromUserName: fromUser.fullName,
            fromUserAvatar: getFullImageUrl(fromUser.avatar)
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Friend request error:', error);
        res.status(500).json({ error: 'Friend request failed' });
    }
});

app.post('/api/friends/accept/:requestId', authenticate, (req, res) => {
    try {
        const requests = friendRequests.get(req.userId) || [];
        const request = requests.find(r => r.requestId === req.params.requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        request.status = 'accepted';
        const currentUser = Array.from(users.values()).find(u => u.userId === req.userId);
        const fromUser = Array.from(users.values()).find(u => u.userId === request.fromUserId);

        if (currentUser && fromUser) {
            if (!currentUser.friends.includes(request.fromUserId)) {
                currentUser.friends.push(request.fromUserId);
            }
            if (!fromUser.friends.includes(req.userId)) {
                fromUser.friends.push(req.userId);
            }
            sendNotification(request.fromUserId, {
                type: 'friend_accept',
                message: `${currentUser.fullName} accepted your friend request`,
                fromUserId: req.userId,
                fromUserName: currentUser.fullName
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Accept friend error:', error);
        res.status(500).json({ error: 'Accept friend failed' });
    }
});

app.post('/api/friends/reject/:requestId', authenticate, (req, res) => {
    try {
        const requests = friendRequests.get(req.userId) || [];
        const index = requests.findIndex(r => r.requestId === req.params.requestId);
        if (index !== -1) {
            requests.splice(index, 1);
            friendRequests.set(req.userId, requests);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Reject friend error:', error);
        res.status(500).json({ error: 'Reject friend failed' });
    }
});

app.get('/api/friends/requests', authenticate, (req, res) => {
    try {
        const requests = (friendRequests.get(req.userId) || [])
            .filter(r => r.status === 'pending')
            .map(r => ({
                ...r,
                fromUserAvatar: getFullImageUrl(r.fromUserAvatar)
            }));
        res.json(requests);
    } catch (error) {
        console.error('Get friend requests error:', error);
        res.status(500).json({ error: 'Get friend requests failed' });
    }
});

app.get('/api/friends', authenticate, (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        if (!user) {
            return res.json([]);
        }
        const friends = user.friends.map(friendId => {
            const friend = Array.from(users.values()).find(u => u.userId === friendId);
            return friend ? {
                userId: friend.userId,
                username: friend.username,
                fullName: friend.fullName,
                avatar: getFullImageUrl(friend.avatar),
                online: onlineUsers.get(friend.userId) || false
            } : null;
        }).filter(Boolean);
        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Get friends failed' });
    }
});

// ============ POST ROUTES ============
app.post('/api/posts', authenticate, upload.single('image'), (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const post = {
            postId: uuidv4(),
            userId: req.userId,
            userName: user.fullName,
            userUsername: user.username,
            userAvatar: getFullImageUrl(user.avatar),
            content: req.body.content || '',
            image: req.file ? `/uploads/images/${req.file.filename}` : null,
            privacy: req.body.privacy || 'public',
            createdAt: new Date(),
            likes: [],
            likeCount: 0,
            commentCount: 0,
            shareCount: 0
        };
        
        if (post.image) {
            post.image = getFullImageUrl(post.image);
        }
        
        posts.set(post.postId, post);

        clients.forEach((ws) => {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'new_post', data: post }));
            }
        });
        res.json({ success: true, post });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: 'Create post failed' });
    }
});

app.get('/api/posts/feed', authenticate, (req, res) => {
    try {
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
        
        feedPosts = feedPosts.map(post => ({
            ...post,
            image: post.image ? getFullImageUrl(post.image) : null,
            userAvatar: getFullImageUrl(post.userAvatar)
        }));
        
        feedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(feedPosts);
    } catch (error) {
        console.error('Get feed error:', error);
        res.status(500).json({ error: 'Get feed failed' });
    }
});

app.delete('/api/posts/:postId', authenticate, (req, res) => {
    try {
        const post = posts.get(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.userId !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        posts.delete(req.params.postId);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: 'Delete post failed' });
    }
});

app.put('/api/posts/:postId', authenticate, (req, res) => {
    try {
        const post = posts.get(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.userId !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        post.content = req.body.content || post.content;
        res.json({ success: true, post });
    } catch (error) {
        console.error('Edit post error:', error);
        res.status(500).json({ error: 'Edit post failed' });
    }
});

app.post('/api/posts/:postId/like', authenticate, (req, res) => {
    try {
        const post = posts.get(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

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
                    fromUserId: req.userId,
                    fromUserName: liker.fullName
                });
            }
        }
        res.json({ likeCount: post.likeCount, liked: !liked });
    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({ error: 'Like post failed' });
    }
});

app.post('/api/posts/:postId/comment', authenticate, (req, res) => {
    try {
        const post = posts.get(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        const comment = {
            commentId: uuidv4(),
            userId: req.userId,
            userName: user.fullName,
            userUsername: user.username,
            userAvatar: getFullImageUrl(user.avatar),
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
                fromUserId: req.userId,
                fromUserName: user.fullName
            });
        }
        res.json({ success: true, comment });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Add comment failed' });
    }
});

app.get('/api/posts/:postId/comments', authenticate, (req, res) => {
    try {
        const postComments = comments.get(req.params.postId) || [];
        const fixedComments = postComments.map(c => ({
            ...c,
            userAvatar: getFullImageUrl(c.userAvatar)
        }));
        res.json(fixedComments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Get comments failed' });
    }
});

app.post('/api/posts/:postId/share', authenticate, (req, res) => {
    try {
        const originalPost = posts.get(req.params.postId);
        if (!originalPost) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        const sharedPost = {
            postId: uuidv4(),
            userId: req.userId,
            userName: user.fullName,
            userUsername: user.username,
            userAvatar: getFullImageUrl(user.avatar),
            content: `Shared ${originalPost.userName}'s post`,
            image: originalPost.image ? getFullImageUrl(originalPost.image) : null,
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
    } catch (error) {
        console.error('Share post error:', error);
        res.status(500).json({ error: 'Share post failed' });
    }
});

app.get('/api/notifications', authenticate, (req, res) => {
    try {
        res.json(notifications.get(req.userId) || []);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Get notifications failed' });
    }
});

// ============ STORY ROUTES ============
app.post('/api/stories', authenticate, upload.single('media'), (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const story = {
            storyId: uuidv4(),
            userId: req.userId,
            userName: user.fullName,
            userAvatar: getFullImageUrl(user.avatar),
            media: getFullImageUrl(`/uploads/stories/${req.file.filename}`),
            type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        
        stories.set(story.storyId, story);
        
        clients.forEach((ws) => {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'new_story', data: story }));
            }
        });
        
        res.json({ success: true, story });
    } catch (error) {
        console.error('Create story error:', error);
        res.status(500).json({ error: 'Create story failed' });
    }
});

app.get('/api/stories/feed', authenticate, (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.userId === req.userId);
        const friendIds = [req.userId, ...(user?.friends || [])];
        const activeStories = Array.from(stories.values())
            .filter(s => friendIds.includes(s.userId) && new Date(s.expiresAt) > new Date())
            .map(s => ({
                ...s,
                media: getFullImageUrl(s.media),
                userAvatar: getFullImageUrl(s.userAvatar)
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(activeStories);
    } catch (error) {
        console.error('Get stories error:', error);
        res.status(500).json({ error: 'Get stories failed' });
    }
});

// ============ MESSAGE ROUTES ============
app.post('/api/messages', authenticate, (req, res) => {
    try {
        const { toUserId, content } = req.body;
        const fromUser = Array.from(users.values()).find(u => u.userId === req.userId);
        const toUser = Array.from(users.values()).find(u => u.userId === toUserId);

        if (!toUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const message = {
            messageId: uuidv4(),
            fromUserId: req.userId,
            fromUserName: fromUser.fullName,
            fromUserAvatar: getFullImageUrl(fromUser.avatar),
            toUserId: toUserId,
            toUserName: toUser.fullName,
            toUserAvatar: getFullImageUrl(toUser.avatar),
            content: content,
            createdAt: new Date(),
            read: false
        };

        const conversationId = [req.userId, toUserId].sort().join('-');
        const conversation = messages.get(conversationId) || [];
        conversation.push(message);
        messages.set(conversationId, conversation);

        const toWs = clients.get(toUserId);
        if (toWs && toWs.readyState === 1) {
            toWs.send(JSON.stringify({ type: 'new_message', data: message }));
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Send message failed' });
    }
});

app.get('/api/messages/:userId', authenticate, (req, res) => {
    try {
        const conversationId = [req.userId, req.params.userId].sort().join('-');
        const conversation = messages.get(conversationId) || [];
        const fixedMessages = conversation.map(m => ({
            ...m,
            fromUserAvatar: getFullImageUrl(m.fromUserAvatar),
            toUserAvatar: getFullImageUrl(m.toUserAvatar)
        }));
        res.json(fixedMessages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Get messages failed' });
    }
});

app.get('/api/messages', authenticate, (req, res) => {
    try {
        const allMessages = [];
        for (const [key, value] of messages) {
            if (key.includes(req.userId)) {
                allMessages.push(...value);
            }
        }
        const fixedMessages = allMessages.map(m => ({
            ...m,
            fromUserAvatar: getFullImageUrl(m.fromUserAvatar),
            toUserAvatar: getFullImageUrl(m.toUserAvatar)
        }));
        res.json(fixedMessages);
    } catch (error) {
        console.error('Get all messages error:', error);
        res.status(500).json({ error: 'Get all messages failed' });
    }
});

// ============ WEBSOCKET ============
wss.on('connection', (ws, req) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        
        if (!token) {
            ws.close(1008, 'No token provided');
            return;
        }
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const userId = decoded.userId;
            
            clients.set(userId, ws);
            onlineUsers.set(userId, true);
            console.log(`✅ User ${userId} online (${onlineUsers.size} users online)`);
            broadcastOnlineStatus(userId, true);

            ws.on('close', (code) => {
                clients.delete(userId);
                onlineUsers.set(userId, false);
                broadcastOnlineStatus(userId, false);
                console.log(`❌ User ${userId} offline (${onlineUsers.size} users online) - Code: ${code}`);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error for user:', userId, error);
            });
        } catch (err) {
            console.log('❌ WebSocket auth failed:', err.message);
            ws.close(1008, 'Invalid token');
        }
    } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close(1011, 'Internal server error');
    }
});

// ============ START SERVER ============
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 =========================================`);
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🚀 Local: http://localhost:${PORT}`);
    console.log(`🚀 Base URL: ${getBaseUrl()}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log(`🚀 =========================================\n`);
});

// ============ ERROR HANDLING ============
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});