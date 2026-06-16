'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FaPlus, FaFacebookMessenger, FaSearch, FaHome, FaUserFriends, 
  FaCamera, FaPhotoVideo, FaSmile, FaThumbsUp, FaComment,
  FaShare, FaEllipsisH, FaEdit, FaTrash, FaTimesCircle,
  FaGlobe, FaLock, FaUsers, FaUserPlus, FaClock, FaBell,
  FaUserCircle, FaEnvelope, FaLock as FaLockIcon, FaUser,
  FaRegHeart, FaHeart, FaRegComment, FaRegShareSquare,
  FaCheck, FaTimes, FaPaperPlane, FaCaretDown, FaSignOutAlt,
  FaThumbsUp as FaThumbsUpSolid
} from 'react-icons/fa';
import { MdOutlineLiveTv } from 'react-icons/md';

const API_URL = 'http://localhost:5003/api';

// Fake Users Data for demo
const FAKE_USERS = [
  { id: 'f1', name: 'Ali Khan', username: 'alikhan', avatar: 'https://ui-avatars.com/api/?background=6366f1&color=fff&name=Ali+Khan' },
  { id: 'f2', name: 'Sara Ahmed', username: 'saraahmed', avatar: 'https://ui-avatars.com/api/?background=e74c3c&color=fff&name=Sara+Ahmed' },
  { id: 'f3', name: 'Usman Malik', username: 'usmanmalik', avatar: 'https://ui-avatars.com/api/?background=2ecc71&color=fff&name=Usman+Malik' },
  { id: 'f4', name: 'Fatima Noor', username: 'fatimanoor', avatar: 'https://ui-avatars.com/api/?background=f39c12&color=fff&name=Fatima+Noor' },
  { id: 'f5', name: 'Hassan Raza', username: 'hassanraza', avatar: 'https://ui-avatars.com/api/?background=9b59b6&color=fff&name=Hassan+Raza' },
];

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    setToken(localStorage.getItem('token'));
  }, []);
  
  if (!token) return <LoginPage />;
  return <HomeContent />;
}

function HomeContent() {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [showFriendsPage, setShowFriendsPage] = useState(false);
  const [showMessengerPage, setShowMessengerPage] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<File | null>(null);
  const [storyMedia, setStoryMedia] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activePage, setActivePage] = useState('home');
  const [storyView, setStoryView] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const wsRef = useRef<WebSocket | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
        setIsMobileSearchOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // WebSocket
  useEffect(() => {
    if (!token) return;
    
    const ws = new WebSocket(`ws://localhost:5003/?token=${token}`);
    ws.onopen = () => console.log('🔌 WebSocket Connected');
    ws.onclose = () => setTimeout(() => new WebSocket(`ws://localhost:5003/?token=${token}`), 3000);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'notification') setNotifications(prev => [data.data, ...prev]);
      if (data.type === 'new_post') setPosts(prev => [data.data, ...prev]);
      if (data.type === 'new_story') setStories(prev => [data.data, ...prev]);
      if (data.type === 'new_message') {
        setMessages(prev => [...prev, data.data]);
        if (selectedChat && data.data.fromUserId === selectedChat.userId) {
          setChatMessages(prev => [...prev, data.data]);
        }
      }
      if (data.type === 'user_status') {
        setFriends(prev => prev.map(f => 
          f.userId === data.data.userId ? { ...f, online: data.data.online } : f
        ));
      }
      if (data.type === 'friend_request') {
        setFriendRequests(prev => [...prev, data.data]);
        setNotifications(prev => [{ 
          id: Date.now(), 
          message: `${data.data.fromUserName} sent you a friend request`, 
          read: false, 
          createdAt: new Date() 
        }, ...prev]);
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [token, selectedChat]);

  // Fetch data
  useEffect(() => {
    if (token) {
      fetchUser();
      fetchFeed();
      fetchFriends();
      fetchFriendRequests();
      fetchNotifications();
      fetchStories();
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
      setUser(res.data);
      setLoading(false);
    } catch (err) {
      localStorage.removeItem('token');
      window.location.reload();
    }
  };

  const fetchFeed = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts/feed`, { headers: { Authorization: `Bearer ${token}` } });
      setPosts(res.data);
    } catch (err) {}
  };

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API_URL}/friends`, { headers: { Authorization: `Bearer ${token}` } });
      setFriends(res.data);
    } catch (err) {}
  };

  const fetchFriendRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/friends/requests`, { headers: { Authorization: `Bearer ${token}` } });
      setFriendRequests(res.data);
    } catch (err) {}
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(res.data);
    } catch (err) {}
  };

  const fetchStories = async () => {
    try {
      const res = await axios.get(`${API_URL}/stories/feed`, { headers: { Authorization: `Bearer ${token}` } });
      setStories(res.data);
    } catch (err) {}
  };

  const fetchComments = async (postId: string) => {
    try {
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`, { headers: { Authorization: `Bearer ${token}` } });
      setComments(prev => ({ ...prev, [postId]: res.data }));
    } catch (err) {}
  };

  // ============ SEARCH USERS ============
  const searchUsers = async () => {
    if (!searchQuery.trim()) { 
      setSearchResults([]);
      setShowSearchResults(false);
      return; 
    }
    try {
      const res = await axios.get(`${API_URL}/users/search?q=${searchQuery}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const fakeResults = FAKE_USERS.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
      ).map(u => ({
        userId: u.id,
        username: u.username,
        fullName: u.name,
        avatar: u.avatar,
        isFriend: friends.some(f => f.userId === u.id),
        isRequested: pendingRequests.includes(u.id),
        isPending: friendRequests.some((r: any) => r.fromUserId === u.id),
        isFake: true
      }));
      
      const combinedResults = [...res.data, ...fakeResults];
      setSearchResults(combinedResults);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  // ============ SEND FRIEND REQUEST ============
  const sendFriendRequest = async (userId: string) => {
    try {
      if (friends.some(f => f.userId === userId)) {
        alert('Already friends!');
        return;
      }
      if (pendingRequests.includes(userId)) {
        alert('Friend request already sent!');
        return;
      }
      if (friendRequests.some((r: any) => r.fromUserId === userId)) {
        alert('This user already sent you a request!');
        return;
      }
      
      const isFake = FAKE_USERS.some(u => u.id === userId);
      if (isFake) {
        setPendingRequests(prev => [...prev, userId]);
        const fakeUser = FAKE_USERS.find(u => u.id === userId);
        setFriendRequests(prev => [...prev, {
          requestId: 'fake-' + Date.now(),
          fromUserId: userId,
          fromUserName: fakeUser?.name,
          fromUserAvatar: fakeUser?.avatar,
          status: 'pending',
          isFake: true
        }]);
        alert('Friend request sent to ' + fakeUser?.name + '!');
        setShowSearchResults(false);
        setSearchQuery('');
        return;
      }
      
      await axios.post(`${API_URL}/friends/request/${userId}`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setPendingRequests(prev => [...prev, userId]);
      alert('Friend request sent!');
      searchUsers();
    } catch (err: any) {
      if (err.response?.data?.error === 'Request already sent') {
        alert('Friend request already sent!');
      } else if (err.response?.data?.error === 'Already friends') {
        alert('Already friends!');
      } else {
        alert('Error sending friend request');
      }
    }
  };

  // ============ ACCEPT FRIEND REQUEST ============
  const acceptFriendRequest = async (requestId: string, userId?: string) => {
    try {
      if (requestId.startsWith('fake-')) {
        const req = friendRequests.find((r: any) => r.requestId === requestId);
        if (req) {
          const fakeUser = FAKE_USERS.find(u => u.id === req.fromUserId);
          if (fakeUser) {
            setFriends(prev => [...prev, {
              userId: fakeUser.id,
              username: fakeUser.username,
              fullName: fakeUser.name,
              avatar: fakeUser.avatar,
              online: true,
              isFake: true
            }]);
          }
          setFriendRequests(prev => prev.filter((r: any) => r.requestId !== requestId));
          alert('Friend request accepted!');
          fetchFriendRequests();
          fetchFriends();
        }
        return;
      }
      
      await axios.post(`${API_URL}/friends/accept/${requestId}`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      fetchFriendRequests();
      fetchFriends();
      alert('Friend request accepted!');
    } catch (err) {
      alert('Error accepting request');
    }
  };

  // ============ REJECT FRIEND REQUEST ============
  const rejectFriendRequest = async (requestId: string) => {
    try {
      if (requestId.startsWith('fake-')) {
        setFriendRequests(prev => prev.filter((r: any) => r.requestId !== requestId));
        alert('Friend request rejected!');
        return;
      }
      await axios.post(`${API_URL}/friends/reject/${requestId}`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      fetchFriendRequests();
    } catch (err) {
      alert('Error rejecting request');
    }
  };

  // ============ SEND MESSAGE ============
  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    
    const newMsg = {
      messageId: 'msg-' + Date.now(),
      fromUserId: user.userId,
      fromUserName: user.fullName,
      fromUserAvatar: user.avatar,
      toUserId: selectedChat.userId,
      toUserName: selectedChat.fullName,
      content: messageText,
      createdAt: new Date(),
      isFake: true
    };
    
    setChatMessages(prev => [...prev, newMsg]);
    setMessageText('');
    
    if (selectedChat.isFake || FAKE_USERS.some(u => u.id === selectedChat.userId)) {
      setTimeout(() => {
        const replyMsg = {
          messageId: 'msg-reply-' + Date.now(),
          fromUserId: selectedChat.userId,
          fromUserName: selectedChat.fullName,
          fromUserAvatar: selectedChat.avatar,
          toUserId: user.userId,
          content: 'Thanks for your message! 😊',
          createdAt: new Date(),
          isFake: true
        };
        setChatMessages(prev => [...prev, replyMsg]);
      }, 1000);
      return;
    }
    
    try {
      await axios.post(`${API_URL}/messages`, { 
        toUserId: selectedChat.userId, 
        content: messageText 
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {}
  };

  const updatePrivacy = async (privacy: string) => {
    try {
      await axios.put(`${API_URL}/settings/privacy`, { privacy }, { headers: { Authorization: `Bearer ${token}` } });
      setUser({ ...user, privacy });
      alert('Privacy updated!');
    } catch (err) {}
  };

  const createPost = async () => {
    if (!postContent.trim() && !postImage) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('content', postContent);
    if (postImage) formData.append('image', postImage);
    try {
      await axios.post(`${API_URL}/posts`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setPostContent('');
      setPostImage(null);
      setImagePreview(null);
      setShowCreatePostModal(false);
      fetchFeed();
    } catch (err) { alert('Error creating post'); }
    finally { setIsUploading(false); }
  };

  const createStory = async () => {
    if (!storyMedia) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('media', storyMedia);
    try {
      await axios.post(`${API_URL}/stories`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setShowStoryModal(false);
      setStoryMedia(null);
      setStoryPreview(null);
      alert('Story uploaded!');
      fetchStories();
    } catch (err) { alert('Error uploading story'); }
    finally { setIsUploading(false); }
  };

  const deletePost = async (postId: string) => {
    if (confirm('Delete this post?')) {
      await axios.delete(`${API_URL}/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchFeed();
    }
  };

  const editPost = async (postId: string) => {
    await axios.put(`${API_URL}/posts/${postId}`, { content: editContent }, { headers: { Authorization: `Bearer ${token}` } });
    setEditingPost(null);
    fetchFeed();
  };

  const likePost = async (postId: string) => {
    await axios.post(`${API_URL}/posts/${postId}/like`, {}, { headers: { Authorization: `Bearer ${token}` } });
    fetchFeed();
  };

  const addComment = async (postId: string) => {
    if (!commentText.trim()) return;
    await axios.post(`${API_URL}/posts/${postId}/comment`, { content: commentText }, { headers: { Authorization: `Bearer ${token}` } });
    setCommentText('');
    setActiveCommentPost(null);
    fetchFeed();
    fetchComments(postId);
  };

  const sharePost = async (postId: string) => {
    await axios.post(`${API_URL}/posts/${postId}/share`, {}, { headers: { Authorization: `Bearer ${token}` } });
    fetchFeed();
    alert('Post shared!');
  };

  const updateProfile = async (formData: FormData) => {
    try {
      const res = await axios.put(`${API_URL}/profile/update`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setUser(res.data.user);
      setShowProfileModal(false);
      alert('Profile updated!');
    } catch (err) { alert('Error updating profile'); }
  };

  const updateCoverPhoto = async (file: File) => {
    const formData = new FormData();
    formData.append('cover', file);
    try {
      const res = await axios.put(`${API_URL}/profile/cover`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setUser({ ...user, coverPhoto: res.data.coverPhoto });
      setShowCoverModal(false);
      alert('Cover photo updated!');
    } catch (err) { alert('Error updating cover'); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPostImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleStorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setStoryMedia(file);
      const reader = new FileReader();
      reader.onloadend = () => setStoryPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const formData = new FormData();
      formData.append('avatar', e.target.files[0]);
      updateProfile(formData);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setShowDropdown(false);
    window.location.reload();
  };

  const viewStory = (story: any) => {
    setStoryView(story);
  };

  // Messenger Page
  const MessengerPage = () => {
    const handleSendMessage = async () => {
      if (!messageText.trim() || !selectedChat) return;
      
      const newMsg = {
        messageId: 'msg-' + Date.now(),
        fromUserId: user.userId,
        fromUserName: user.fullName,
        fromUserAvatar: user.avatar,
        toUserId: selectedChat.userId,
        toUserName: selectedChat.fullName,
        content: messageText,
        createdAt: new Date(),
        isFake: true
      };
      
      setChatMessages(prev => [...prev, newMsg]);
      setMessageText('');
      
      if (selectedChat.isFake || FAKE_USERS.some(u => u.id === selectedChat.userId)) {
        setTimeout(() => {
          const replyMsg = {
            messageId: 'msg-reply-' + Date.now(),
            fromUserId: selectedChat.userId,
            fromUserName: selectedChat.fullName,
            fromUserAvatar: selectedChat.avatar,
            toUserId: user.userId,
            content: 'Thanks for your message! 😊',
            createdAt: new Date(),
            isFake: true
          };
          setChatMessages(prev => [...prev, replyMsg]);
        }, 1000);
        return;
      }
      
      try {
        await axios.post(`${API_URL}/messages`, { 
          toUserId: selectedChat.userId, 
          content: messageText 
        }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {}
    };

    const startChat = (friend: any) => {
      setSelectedChat(friend);
      setChatMessages([]);
      if (friend.isFake || FAKE_USERS.some(u => u.id === friend.userId)) {
        setTimeout(() => {
          setChatMessages([{
            messageId: 'welcome-' + Date.now(),
            fromUserId: friend.userId,
            fromUserName: friend.fullName,
            fromUserAvatar: friend.avatar,
            toUserId: user.userId,
            content: `Hey! How are you doing? 👋`,
            createdAt: new Date(),
            isFake: true
          }]);
        }, 500);
      }
    };

    return (
      <div className="fixed inset-0 bg-[#f0f2f5] z-50 flex flex-col">
        <div className="bg-white shadow-sm p-3 flex items-center gap-3">
          <button onClick={() => { setShowMessengerPage(false); setSelectedChat(null); setChatMessages([]); }} className="p-2 hover:bg-gray-100 rounded-full">
            <FaTimes className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-lg">Messenger</h2>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className={`${selectedChat ? 'hidden md:block' : 'block'} w-full md:w-80 bg-white border-r overflow-y-auto`}>
            {friends.length === 0 && FAKE_USERS.map(f => (
              <div 
                key={f.id} 
                onClick={() => startChat({ userId: f.id, fullName: f.name, avatar: f.avatar, online: true, isFake: true, username: f.username })}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b transition"
              >
                <img src={f.avatar} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{f.name}</p>
                  <p className="text-xs text-green-500">Online</p>
                </div>
              </div>
            ))}
            {friends.map(friend => (
              <div 
                key={friend.userId} 
                onClick={() => startChat(friend)}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b transition ${selectedChat?.userId === friend.userId ? 'bg-blue-50' : ''}`}
              >
                <img src={friend.avatar} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{friend.fullName}</p>
                  <p className="text-xs text-gray-500">{friend.online ? 'Online' : 'Offline'}</p>
                </div>
              </div>
            ))}
          </div>

          {selectedChat && (
            <div className="flex-1 flex flex-col bg-[#f0f2f5]">
              <div className="bg-white p-3 border-b flex items-center gap-3">
                <img src={selectedChat.avatar} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-semibold">{selectedChat.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedChat.online ? 'Online' : 'Offline'}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-20">Say hello to {selectedChat.fullName}!</div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.fromUserId === user.userId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-xl ${msg.fromUserId === user.userId ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${msg.fromUserId === user.userId ? 'text-blue-200' : 'text-gray-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white p-3 border-t flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={handleSendMessage} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition">
                  <FaPaperPlane className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Friends Page
  const FriendsPage = () => {
    const [activeTab, setActiveTab] = useState('friends');

    return (
      <div className="fixed inset-0 bg-[#f0f2f5] z-50 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowFriendsPage(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <FaTimes className="w-5 h-5" />
              </button>
              <h2 className="font-bold text-xl">Friends</h2>
            </div>
            <span className="text-sm text-gray-500">{friends.length} friends</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm mb-4">
            <div className="flex">
              <button 
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-3 text-sm font-semibold text-center ${activeTab === 'friends' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              >
                All Friends ({friends.length})
              </button>
              <button 
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-3 text-sm font-semibold text-center ${activeTab === 'requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              >
                Requests ({friendRequests.length})
              </button>
            </div>
          </div>

          {activeTab === 'friends' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {friends.length === 0 && FAKE_USERS.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-4 border-b hover:bg-gray-50 transition">
                  <img src={f.avatar} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-xs text-gray-500">@{f.username}</p>
                  </div>
                  <button 
                    onClick={() => { setShowFriendsPage(false); setShowMessengerPage(true); }}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition"
                  >
                    Message
                  </button>
                </div>
              ))}
              {friends.map(friend => (
                <div key={friend.userId} className="flex items-center gap-3 p-4 border-b hover:bg-gray-50 transition">
                  <img src={friend.avatar} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-semibold">{friend.fullName}</p>
                    <p className="text-xs text-gray-500">@{friend.username}</p>
                  </div>
                  <button 
                    onClick={() => { setShowFriendsPage(false); setShowMessengerPage(true); }}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition"
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          ) : (
            friendRequests.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">No friend requests</div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {friendRequests.map((req: any) => (
                  <div key={req.requestId} className="flex items-center gap-3 p-4 border-b hover:bg-gray-50 transition">
                    <img src={req.fromUserAvatar} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1">
                      <p className="font-semibold">{req.fromUserName}</p>
                      <p className="text-xs text-gray-500">Sent you a friend request</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptFriendRequest(req.requestId, req.fromUserId)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition">
                        <FaCheck className="w-4 h-4" />
                      </button>
                      <button onClick={() => rejectFriendRequest(req.requestId)} className="bg-gray-200 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-300 transition">
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f2f5]">
        <div className="w-8 h-8 border-4 border-[#1877f2] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-16">
      
      {/* Messenger Page */}
      {showMessengerPage && <MessengerPage />}

      {/* Friends Page */}
      {showFriendsPage && <FriendsPage />}

      {/* Story Viewer */}
      {storyView && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setStoryView(null)}>
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {storyView.type === 'video' ? (
                <video src={storyView.media} controls className="w-full rounded-xl max-h-[80vh] object-contain" autoPlay />
              ) : (
                <img src={storyView.media} className="w-full rounded-xl max-h-[80vh] object-contain" />
              )}
              <button onClick={() => setStoryView(null)} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full">
                <FaTimesCircle className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-0 right-0 text-center text-white">
                <p className="font-semibold">{storyView.userName}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreatePostModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-bold text-lg">Create post</h3>
              <button onClick={() => setShowCreatePostModal(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <FaTimesCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2">
                <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-sm">{user.fullName}</p>
                </div>
              </div>
              <textarea
                placeholder="What's on your mind?"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="w-full mt-3 text-base outline-none resize-none min-h-[100px]"
                autoFocus
              />
              {imagePreview && (
                <div className="relative mt-2">
                  <img src={imagePreview} className="w-full h-48 object-cover rounded-lg" />
                  <button onClick={() => { setPostImage(null); setImagePreview(null); }} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow">
                    <FaTimesCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="border rounded-lg mt-3">
                <div className="flex items-center justify-between p-2">
                  <span className="text-xs font-medium">Add to post</span>
                  <label className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer">
                    <FaPhotoVideo className="w-5 h-5 text-green-500" />
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  </label>
                </div>
              </div>
              <button
                onClick={createPost}
                disabled={(!postContent.trim() && !postImage) || isUploading}
                className="w-full mt-3 bg-[#1877f2] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#166fe5] disabled:opacity-50"
              >
                {isUploading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Modal */}
      {showStoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-bold">Create story</h3>
              <button onClick={() => setShowStoryModal(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <FaTimesCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <img src={user.avatar} className="w-10 h-10 rounded-full" />
                <div>
                  <p className="font-semibold text-sm">{user.fullName}</p>
                  <p className="text-xs text-gray-500">Add to your story</p>
                </div>
              </div>
              {storyPreview && (
                <img src={storyPreview} className="w-full h-48 object-cover rounded-lg mb-2" />
              )}
              <label className="block w-full text-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-blue-500">
                <FaCamera className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                <span className="text-xs text-gray-500">Select photo or video</span>
                <input type="file" accept="image/*,video/*" onChange={handleStorySelect} className="hidden" />
              </label>
              <button onClick={createStory} disabled={!storyMedia || isUploading} className="w-full mt-3 bg-[#1877f2] text-white py-2 rounded-lg text-sm disabled:opacity-50">
                {isUploading ? 'Uploading...' : 'Share to Story'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ HEADER WITH LOGOUT ============ */}
      <div className="bg-white shadow-sm sticky top-0 z-40 border-b">
        <div className="px-2 sm:px-3 max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between h-12">
            <div className="text-xl font-bold text-[#1877f2]">facebook</div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={() => setShowCreatePostModal(true)} className="p-1.5 bg-gray-100 rounded-full">
                <FaPlus className="w-4 h-4 text-gray-700" />
              </button>
              
              {/* SEARCH */}
              <div className="relative" ref={searchRef}>
                <button 
                  onClick={() => {
                    if (isMobileSearchOpen) {
                      setShowSearchResults(false);
                      setIsMobileSearchOpen(false);
                    } else {
                      setIsMobileSearchOpen(true);
                      setShowSearchResults(true);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }
                  }}
                  className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition"
                >
                  <FaSearch className="w-4 h-4 text-gray-700" />
                </button>
                
                {(showSearchResults || isMobileSearchOpen) && (
                  <div className="absolute right-0 top-full mt-2 w-[280px] sm:w-80 bg-white rounded-xl shadow-lg border z-50 overflow-hidden">
                    <div className="p-2 sm:p-3 border-b">
                      <div className="flex gap-1 sm:gap-2">
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search for friends..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                          className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button onClick={searchUsers} className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm hover:bg-blue-700 transition">
                          Search
                        </button>
                      </div>
                    </div>
                    {searchResults.length === 0 ? (
                      <div className="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">No users found</div>
                    ) : (
                      <div className="max-h-48 sm:max-h-60 overflow-y-auto">
                        {searchResults.map((u: any) => (
                          <div key={u.userId} className="flex items-center justify-between p-2 sm:p-3 hover:bg-gray-50 border-b">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <img src={u.avatar} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                              <div>
                                <p className="font-semibold text-xs sm:text-sm">{u.fullName}</p>
                                <p className="text-[10px] sm:text-xs text-gray-500">@{u.username}</p>
                              </div>
                            </div>
                            {u.isFriend ? (
                              <span className="text-green-600 text-[10px] sm:text-xs font-semibold">✓ Friends</span>
                            ) : u.isRequested || pendingRequests.includes(u.userId) ? (
                              <span className="text-gray-500 text-[10px] sm:text-xs">Requested</span>
                            ) : friendRequests.some((r: any) => r.fromUserId === u.userId) ? (
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => {
                                    const req = friendRequests.find((r: any) => r.fromUserId === u.userId);
                                    if (req) acceptFriendRequest(req.requestId, u.userId);
                                  }} 
                                  className="bg-blue-600 text-white px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs"
                                >
                                  Accept
                                </button>
                                <button 
                                  onClick={() => {
                                    const req = friendRequests.find((r: any) => r.fromUserId === u.userId);
                                    if (req) rejectFriendRequest(req.requestId);
                                  }} 
                                  className="bg-gray-200 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => sendFriendRequest(u.userId)} 
                                className="bg-blue-600 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs hover:bg-blue-700 transition"
                              >
                                Add Friend
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <button onClick={() => setShowMessengerPage(true)} className="p-1.5 bg-gray-100 rounded-full relative">
                <FaFacebookMessenger className="w-4 h-4 text-gray-700" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center">3</span>
              </button>
              
              {/* 🔴 LOGOUT BUTTON - DESKTOP */}
              <button 
                onClick={handleLogout} 
                className="hidden sm:flex items-center gap-1 bg-red-500 text-white px-2 sm:px-3 py-1 rounded-lg text-xs hover:bg-red-600 transition"
              >
                <FaSignOutAlt className="w-3 h-3" /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cover & Profile Section */}
      <div className="relative">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-blue-500 to-purple-600 relative cursor-pointer group" onClick={() => setShowCoverModal(true)}>
          {user.coverPhoto && <img src={user.coverPhoto} className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
            <span className="text-white opacity-0 group-hover:opacity-100 transition text-xs sm:text-sm flex items-center gap-1">
              <FaCamera className="w-3 h-3 sm:w-4 sm:h-4" /> Update Cover
            </span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowCoverModal(true); }} className="absolute bottom-2 right-2 bg-black/50 text-white p-1 rounded-lg text-xs hover:bg-black/70 transition">
            <FaCamera className="w-3 h-3" />
          </button>
        </div>
        <div className="px-2 sm:px-3">
          <div className="relative -mt-8 sm:-mt-10 flex justify-between items-end">
            <div className="relative">
              <img src={user.avatar} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white object-cover" />
              <button onClick={() => setShowProfileModal(true)} className="absolute bottom-0 right-0 bg-gray-200 rounded-full p-0.5 sm:p-1 hover:bg-gray-300 transition">
                <FaCamera className="w-2 h-2 sm:w-3 sm:h-3" />
              </button>
            </div>
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)} 
                className="bg-gray-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold hover:bg-gray-300 transition flex items-center gap-1 sm:gap-2"
              >
                Edit <FaCaretDown className="w-2 h-2 sm:w-3 sm:h-3" />
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-40 sm:w-48 bg-white rounded-xl shadow-lg border z-50 overflow-hidden">
                  <button onClick={() => { setShowProfileModal(true); setShowDropdown(false); }} className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm hover:bg-gray-50 transition">
                    <FaUser className="w-3 h-3 sm:w-4 sm:h-4" /> Edit Profile
                  </button>
                  <button onClick={() => { setShowFriendsPage(true); setShowDropdown(false); }} className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm hover:bg-gray-50 transition">
                    <FaUserFriends className="w-3 h-3 sm:w-4 sm:h-4" /> Friends
                  </button>
                  <button onClick={() => { setShowMessengerPage(true); setShowDropdown(false); }} className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm hover:bg-gray-50 transition">
                    <FaFacebookMessenger className="w-3 h-3 sm:w-4 sm:h-4" /> Messages
                  </button>
                  <div className="border-t">
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition">
                      <FaSignOutAlt className="w-3 h-3 sm:w-4 sm:h-4" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-1 sm:mt-2">
            <h2 className="font-bold text-base sm:text-lg">{user.fullName}</h2>
            <p className="text-gray-500 text-[10px] sm:text-xs">{friends.length} friends</p>
            {user.bio && (
              <p className="text-xs sm:text-sm text-gray-700 mt-0.5 sm:mt-1">{user.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-2 sm:px-3 py-2 sm:py-3 max-w-2xl mx-auto">
        {/* Create Post Box */}
        <div className="bg-white rounded-xl shadow-sm p-2 mb-3 cursor-pointer hover:bg-gray-50 transition" onClick={() => setShowCreatePostModal(true)}>
          <div className="flex gap-1.5 sm:gap-2">
            <img src={user.avatar} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" />
            <div className="flex-1 bg-gray-100 rounded-full px-2 sm:px-3 py-1 sm:py-1.5">
              <p className="text-gray-500 text-[10px] sm:text-xs">What's on your mind?</p>
            </div>
          </div>
        </div>

        {/* Stories */}
        <div className="bg-white rounded-xl shadow-sm p-2 mb-3 overflow-x-auto">
          <div className="flex gap-1.5 sm:gap-2">
            <div className="text-center cursor-pointer" onClick={() => setShowStoryModal(true)}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-yellow-400 to-red-500 p-0.5">
                <img src={user.avatar} className="w-full h-full rounded-full border-2 border-white object-cover" />
              </div>
              <p className="text-[8px] sm:text-[10px] mt-0.5">Create</p>
            </div>
            {stories.slice(0, 4).map((story) => (
              <div key={story.storyId} className="text-center cursor-pointer" onClick={() => viewStory(story)}>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-purple-400 to-pink-500 p-0.5">
                  <img src={story.userAvatar} className="w-full h-full rounded-full border-2 border-white object-cover" />
                </div>
                <p className="text-[8px] sm:text-[10px] mt-0.5 truncate w-12 sm:w-14">{story.userName?.split(' ')[0]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-3 mb-3">
            <p className="font-semibold text-xs sm:text-sm mb-1.5 sm:mb-2 flex items-center gap-1"><FaUserPlus className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" /> Requests ({friendRequests.length})</p>
            {friendRequests.slice(0, 3).map((req: any) => (
              <div key={req.requestId} className="flex items-center justify-between mb-1.5 sm:mb-2 p-1.5 sm:p-2 hover:bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <img src={req.fromUserAvatar} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                  <p className="font-medium text-xs sm:text-sm">{req.fromUserName}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => acceptFriendRequest(req.requestId, req.fromUserId)} className="bg-blue-600 text-white p-1 sm:p-1.5 rounded-full hover:bg-blue-700 transition">
                    <FaCheck className="w-2 h-2 sm:w-3 sm:h-3" />
                  </button>
                  <button onClick={() => rejectFriendRequest(req.requestId)} className="bg-gray-200 p-1 sm:p-1.5 rounded-full hover:bg-gray-300 transition">
                    <FaTimes className="w-2 h-2 sm:w-3 sm:h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Posts Feed */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500 text-xs sm:text-sm">No posts yet</div>
        ) : (
          posts.map(post => (
            <div key={post.postId} className="bg-white rounded-xl shadow-sm mb-3 overflow-hidden">
              <div className="p-2 sm:p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <img src={post.userAvatar} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" />
                    <div>
                      <p className="font-semibold text-xs sm:text-sm">{post.userName}</p>
                      <div className="flex items-center gap-1 text-[8px] sm:text-[10px] text-gray-400">
                        <FaClock className="w-1.5 h-1.5 sm:w-2 sm:h-2" /> {new Date(post.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {post.userId === user.userId && (
                    <div className="relative group">
                      <button className="p-1 rounded-full hover:bg-gray-100 transition">
                        <FaEllipsisH className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border hidden group-hover:block z-10 min-w-[100px] sm:min-w-[120px] overflow-hidden">
                        {editingPost === post.postId ? (
                          <div className="p-1.5 sm:p-2">
                            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-1.5 sm:p-2 border rounded-lg text-xs sm:text-sm" rows={2} />
                            <div className="flex gap-1 sm:gap-2 mt-1 sm:mt-2">
                              <button onClick={() => editPost(post.postId)} className="bg-blue-600 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs">Save</button>
                              <button onClick={() => setEditingPost(null)} className="bg-gray-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => { setEditingPost(post.postId); setEditContent(post.content); }} className="flex items-center gap-1.5 sm:gap-2 w-full px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-gray-100 transition">
                              <FaEdit className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" /> Edit
                            </button>
                            <button onClick={() => deletePost(post.postId)} className="flex items-center gap-1.5 sm:gap-2 w-full px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-red-600 hover:bg-gray-100 transition">
                              <FaTrash className="w-3 h-3 sm:w-4 sm:h-4" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs sm:text-sm mt-1.5 sm:mt-2">{post.content}</p>
                {post.image && (
                  <img src={post.image} className="mt-1.5 sm:mt-2 rounded-lg w-full max-h-48 sm:max-h-64 object-cover" />
                )}
                <div className="flex justify-between text-[8px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2 py-1 border-b">
                  <span className="flex items-center gap-0.5 sm:gap-1"><FaThumbsUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {post.likeCount || 0}</span>
                  <div className="flex gap-1.5 sm:gap-3">
                    <span>{post.commentCount || 0} comments</span>
                    <span>{post.shareCount || 0} shares</span>
                  </div>
                </div>
                <div className="flex py-0.5 sm:py-1">
                  <button onClick={() => likePost(post.postId)} className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition ${post.likes?.includes(user.userId) ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <FaThumbsUp className="w-3 h-3 sm:w-4 sm:h-4" /> {post.likes?.includes(user.userId) ? 'Liked' : 'Like'}
                  </button>
                  <button onClick={() => { setActiveCommentPost(activeCommentPost === post.postId ? null : post.postId); fetchComments(post.postId); }} className="flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold text-gray-600 hover:bg-gray-100 transition">
                    <FaComment className="w-3 h-3 sm:w-4 sm:h-4" /> Comment
                  </button>
                  <button onClick={() => sharePost(post.postId)} className="flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold text-gray-600 hover:bg-gray-100 transition">
                    <FaShare className="w-3 h-3 sm:w-4 sm:h-4" /> Share
                  </button>
                </div>
                {activeCommentPost === post.postId && (
                  <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t bg-gray-50 rounded-lg p-1.5 sm:p-2">
                    <div className="flex gap-1 sm:gap-2">
                      <img src={user.avatar} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                      <div className="flex-1 flex gap-1 sm:gap-2">
                        <input type="text" placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 px-2 sm:px-3 py-1 sm:py-2 bg-white rounded-full text-[10px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <button onClick={() => addComment(post.postId)} className="bg-blue-600 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-full text-[10px] sm:text-xs hover:bg-blue-700 transition">Post</button>
                      </div>
                    </div>
                    <div className="mt-1.5 sm:mt-2 space-y-1.5 sm:space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
                      {(comments[post.postId] || []).slice(0, 3).map((c: any) => (
                        <div key={c.commentId} className="flex gap-1.5 sm:gap-2">
                          <img src={c.userAvatar} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                          <div className="flex-1 bg-white rounded-lg p-1 sm:p-2">
                            <p className="font-semibold text-[10px] sm:text-xs">{c.userName}</p>
                            <p className="text-[10px] sm:text-xs">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ============ BOTTOM NAVIGATION WITH LOGOUT ============ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t py-1 px-1 sm:px-2 flex justify-around z-40">
        <button onClick={() => { setActivePage('home'); setShowFriendsPage(false); setShowMessengerPage(false); }} className={`flex flex-col items-center p-1 rounded-lg transition ${activePage === 'home' ? 'text-blue-600' : 'text-gray-500'}`}>
          <FaHome className={`w-4 h-4 sm:w-5 sm:h-5 ${activePage === 'home' ? 'text-blue-600' : 'text-gray-500'}`} />
          <span className={`text-[8px] sm:text-[9px] ${activePage === 'home' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>Home</span>
        </button>
        <button onClick={() => setActivePage('reels')} className={`flex flex-col items-center p-1 rounded-lg transition ${activePage === 'reels' ? 'text-blue-600' : 'text-gray-500'}`}>
          <MdOutlineLiveTv className={`w-4 h-4 sm:w-5 sm:h-5 ${activePage === 'reels' ? 'text-blue-600' : 'text-gray-500'}`} />
          <span className={`text-[8px] sm:text-[9px] ${activePage === 'reels' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>Reels</span>
        </button>
        <button onClick={() => setShowFriendsPage(true)} className={`flex flex-col items-center p-1 rounded-lg transition ${showFriendsPage ? 'text-blue-600' : 'text-gray-500'}`}>
          <FaUserFriends className={`w-4 h-4 sm:w-5 sm:h-5 ${showFriendsPage ? 'text-blue-600' : 'text-gray-500'}`} />
          <span className={`text-[8px] sm:text-[9px] ${showFriendsPage ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>Friends</span>
        </button>
        <div className="relative" ref={notificationsRef}>
          <button onClick={() => setShowNotifications(!showNotifications)} className={`flex flex-col items-center p-1 rounded-lg relative ${showNotifications ? 'text-blue-600' : 'text-gray-500'}`}>
            <FaBell className={`w-4 h-4 sm:w-5 sm:h-5 ${showNotifications ? 'text-blue-600' : 'text-gray-500'}`} />
            {notifications.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[7px] sm:text-[8px] rounded-full w-3 h-3 flex items-center justify-center">{notifications.length}</span>}
            <span className={`text-[8px] sm:text-[9px] ${showNotifications ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>Notif</span>
          </button>
          {showNotifications && (
            <div className="absolute bottom-10 right-0 w-56 sm:w-64 bg-white rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto border">
              <div className="p-2 border-b font-semibold text-[10px] sm:text-xs flex items-center gap-1 sm:gap-2"><FaBell className="w-3 h-3" /> Notifications</div>
              {notifications.length === 0 ? <div className="p-3 text-center text-gray-500 text-[10px] sm:text-xs">No notifications</div> : notifications.map(notif => (
                <div key={notif.id} className="p-2 border-b hover:bg-gray-50 flex gap-1.5 sm:gap-2">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center"><FaBell className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600" /></div>
                  <div className="flex-1"><p className="text-[10px] sm:text-xs">{notif.message}</p><p className="text-[8px] sm:text-[10px] text-gray-400">{new Date(notif.createdAt).toLocaleString()}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 🔴 LOGOUT BUTTON - MOBILE */}
        <button 
          onClick={handleLogout} 
          className="flex flex-col items-center p-1 rounded-lg transition text-red-500"
        >
          <FaSignOutAlt className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[8px] sm:text-[9px]">Logout</span>
        </button>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Edit Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="p-1 rounded-full hover:bg-gray-100">
                <FaTimesCircle className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-center">
                <img src={user.avatar} className="w-20 h-20 rounded-full mx-auto mb-1 object-cover" />
                <label className="text-blue-600 text-xs cursor-pointer hover:underline">Change Photo
                  <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                </label>
              </div>
              <input type="text" placeholder="Full Name" defaultValue={user.fullName} onBlur={(e) => { const fd = new FormData(); fd.append('fullName', e.target.value); updateProfile(fd); }} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea placeholder="Bio" defaultValue={user.bio || ''} onBlur={(e) => { const fd = new FormData(); fd.append('bio', e.target.value); updateProfile(fd); }} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              
              <div>
                <label className="text-xs font-medium mb-1 block">Privacy Setting</label>
                <select value={user.privacy || 'public'} onChange={(e) => updatePrivacy(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="public">🌍 Public</option>
                  <option value="friends">👥 Friends Only</option>
                  <option value="private">🔒 Private</option>
                </select>
              </div>
              
              <button onClick={() => setShowProfileModal(false)} className="w-full bg-gray-200 py-2 rounded-lg text-sm hover:bg-gray-300 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Modal */}
      {showCoverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Update Cover Photo</h3>
              <button onClick={() => setShowCoverModal(false)} className="p-1 rounded-full hover:bg-gray-100">
                <FaTimesCircle className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <label className="block w-full text-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-blue-500 transition">
              <FaCamera className="w-6 h-6 mx-auto mb-1 text-gray-400" />
              <span className="text-xs text-gray-500">Select Cover Photo</span>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && updateCoverPhoto(e.target.files[0])} className="hidden" />
            </label>
            <button onClick={() => setShowCoverModal(false)} className="w-full bg-gray-200 py-2 rounded-lg mt-3 text-sm hover:bg-gray-300 transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Login Page
function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/login`, { email, password });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        window.location.href = '/';
      }
    } catch (err: any) {
      alert('Login failed: ' + (err.response?.data?.error || 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fullName = `${firstName} ${surname}`.trim();
    const finalUsername = username || firstName.toLowerCase() + surname.toLowerCase();
    try {
      const res = await axios.post(`${API_URL}/register`, { 
        username: finalUsername, 
        email, 
        password, 
        fullName 
      });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        window.location.href = '/';
      }
    } catch (err: any) {
      alert('Registration failed: ' + (err.response?.data?.error || 'User may already exist'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="max-w-[400px] w-full">
        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-[#1877f2] mb-2">facebook</div>
          <p className="text-gray-600 text-sm">Connect with friends and the world</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-5">
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="email" placeholder="Email or phone number" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              </div>
              <div className="relative">
                <FaLockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#1877f2] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#166fe5] transition">Log In</button>
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-500">or</span></div>
              </div>
              <button onClick={() => setIsLogin(false)} type="button" className="w-full bg-[#42b72a] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#36a420] transition">Create new account</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="px-3 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" required />
                <input type="text" placeholder="Surname" value={surname} onChange={(e) => setSurname(e.target.value)} className="px-3 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              </div>
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              <p className="text-[10px] text-gray-500">By clicking Sign Up, you agree to our Terms and Privacy Policy.</p>
              <button type="submit" disabled={loading} className="w-full bg-[#42b72a] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#36a420] transition">Sign Up</button>
              <div className="text-center"><button onClick={() => setIsLogin(true)} type="button" className="text-[#1877f2] text-xs hover:underline">Already have an account?</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}