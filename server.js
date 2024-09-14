const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

// Initialize app and middleware
const app = express();
const PORT = 3000;
mongoose.connect('mongodb://localhost/alligator', { useNewUrlParser: true, useUnifiedTopology: true });

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Schema for Users and Posts
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  profilePicture: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notifications: Array,
});
const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  image: String,
  video: String,
  likes: Number,
  views: Number,
  replies: [{ user: String, comment: String }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Multer storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(403);
  jwt.verify(token, 'secretkey', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Register user
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  res.json({ message: 'User created' });
});

// Login user
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(403).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id }, 'secretkey');
  res.json({ token });
});

// Create a post
app.post('/post', authenticateToken, upload.single('image'), async (req, res) => {
  const post = new Post({
    user: req.user.id,
    content: req.body.content,
    image: req.file ? `/images/${req.file.filename}` : null,
    video: req.body.video,
    likes: 0,
    views: 0,
    replies: []
  });
  await post.save();
  res.json({ message: 'Post created' });
});

// Fetch posts
app.get('/posts', authenticateToken, async (req, res) => {
  const posts = await Post.find({}).populate('user').exec();
  res.json(posts);
});

// Search users
app.get('/search', authenticateToken, async (req, res) => {
  const query = req.query.q;
  const users = await User.find({ username: new RegExp(query, 'i') }).exec();
  res.json(users);
});

// Follow user
app.post('/follow', authenticateToken, async (req, res) => {
  const { followId } = req.body;
  const user = await User.findById(req.user.id);
  user.followers.push(followId);
  await user.save();
  res.json({ message: 'User followed' });
});

// Get notifications
app.get('/notifications', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).exec();
  res.json(user.notifications);
});

// Serve HTML and frontend code
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Alligator</title>
    <style>
      body { font-family: Arial, sans-serif; }
      header { display: flex; justify-content: space-between; background-color: #333; padding: 10px; color: white; }
      footer { display: flex; justify-content: space-around; position: fixed; bottom: 0; width: 100%; background-color: #333; color: white; }
      button { padding: 10px; }
      #postFeed { padding: 20px; }
      .post { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <header>
      <img src="data:image/webp;base64,[INSERT BASE64 IMAGE DATA]" alt="Alligator Logo" height="50">
      <h1>Alligator</h1>
      <button id="notificationsBtn">Notifications</button>
    </header>
    
    <div id="postFeed"></div>
    
    <footer>
      <button id="profileBtn">Your Profile</button>
      <button id="createPostBtn">+</button>
      <button id="searchBtn">Search</button>
    </footer>
    
    <script>
      document.getElementById('profileBtn').addEventListener('click', () => {
        alert('Profile Page');
      });
      
      document.getElementById('createPostBtn').addEventListener('click', () => {
        alert('Create Post Page');
      });
      
      document.getElementById('searchBtn').addEventListener('click', () => {
        alert('Search Page');
      });
      
      document.getElementById('notificationsBtn').addEventListener('click', async () => {
        const res = await fetch('/notifications', {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        const notifications = await res.json();
        alert('Notifications: ' + JSON.stringify(notifications));
      });
      
      async function loadPosts() {
        const res = await fetch('/posts', {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        const posts = await res.json();
        const postFeed = document.getElementById('postFeed');
        posts.forEach(post => {
          postFeed.innerHTML += '<div class="post">' +
            '<p>' + post.content + '</p>' +
            (post.image ? '<img src="' + post.image + '">' : '') +
            '<p>Likes: ' + post.likes + ' | Views: ' + post.views + '</p>' +
          '</div>';
        });
      }
      loadPosts();
    </script>
  </body>
  </html>
  `);
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
