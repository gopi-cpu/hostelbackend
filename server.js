const dotenv = require("dotenv");
const express = require("express");
const http = require('http');
const socketIo = require('socket.io'); 
const jwt = require('jsonwebtoken'); 
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
require('dotenv').config();
// const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const Bookings = require('./routes/bookingroute');
// const fileUpload = require('express-fileupload');
const Rooms = require('./routes/roomroute');
const bedRoutes = require('./routes/bedroutes')
const connectDB = require("./database/db");
const userRoutes = require("./routes/authUser");
// const userRoutes = require("./routes/userRoutes");
const hostels = require('./routes/hostelroute');
const payments = require('./routes/paymentroutes')
const Reviews = require('./routes/reviewroute')
const students = require('./routes/students')
const locationController = require('./routes/locationRoutes')
const uploadRoutes  = require('./routes/upload')
const maintenance  = require('./routes/maintenanceRoutes')
const Message = require('./models/message')
const Property = require('./models/hostelschema')
const path = require('path');

dotenv.config();    


const app = express();
const server = http.createServer(app);
// Middleware
app.use(express.json()); // for parsing application/json
const io = socketIo(server, {
  cors: {
    origin: "*", // Configure for your React Native app
    methods: ["GET", "POST"]
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role; // 'user' or 'owner'
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

const issueTypeMap = {
  'general': 0,
  'maintenance': 1,
  'payment': 2,
  'complaint': 3,
  'other': 4
};

const connectedUsers = new Map(); // userId -> socketId
const connectedOwners = new Map(); // ownerId -> socketId

app.set('connectedUsers', connectedUsers);
app.set('connectedOwners', connectedOwners);

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
  
  // Register user/owner based on role
  if (socket.userRole === 'owner') {
    connectedOwners.set(socket.userId.toString(), socket.id);
     socket.join(`owner_${socket.userId}`);
        Property.find({ owner: socket.userId }).then(hostels => {
      hostels.forEach(hostel => {
        socket.join(`hostel_${hostel._id}`);
        console.log(`Owner ${socket.userId} joined hostel room: ${hostel._id}`);
      });
    });
  } else {
    connectedUsers.set(socket.userId.toString(), socket.id);
      socket.join(`user_${socket.userId}`);
  }

    socket.on('join_owner_room', (data) => {
    if (socket.userRole === 'owner' && data.ownerId === socket.userId) {
      socket.join(`owner_${data.ownerId}`);
      socket.emit('joined_room', { room: `owner_${data.ownerId}` });
    }
  });

   socket.on('join_hostel_room', (data) => {
    Property.findOne({ _id: data.hostelId, owner: socket.userId }).then(hostel => {
      if (hostel) {
        socket.join(`hostel_${data.hostelId}`);
        socket.emit('joined_room', { room: `hostel_${data.hostelId}` });
      }
    });
  });
  // Join personal room for direct messages
  socket.join(`user_${socket.userId}`);

  // Handle sending messages (Tenant -> Owner)
  socket.on('send_message', async (data) => {
    const { pgId, message, issueType = 'general' } = data;
    
    try {
      // Your existing message creation logic
      const newMessage = await Message.create({
        s: socket.userId,
        r: data.receiverId,
        p: pgId,
        m: message,
        t: 0,
        i: issueTypeMap[issueType.toLowerCase()] || 0,
        st: 0
      });

      // Populate for response
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('s', 'name')
        .populate('r', 'name');

      const formattedMessage = {
        _id: populatedMessage._id,
        text: populatedMessage.m,
        type: 'text',
        issueType: issueType.toLowerCase(),
        status: 'sent',
        createdAt: populatedMessage.c,
        sender: {
          _id: populatedMessage.s._id,
          name: populatedMessage.s.name
        },
        receiver: {
          _id: populatedMessage.r._id,
          name: populatedMessage.r.name
        }
      };

      // Emit to receiver if online
      const receiverSocketId = connectedOwners.get(data.receiverId) || 
                               connectedUsers.get(data.receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new_message', {
          message: formattedMessage,
          pgId: pgId,
          senderId: socket.userId
        });
        
        // Update message status to delivered
        await Message.findByIdAndUpdate(newMessage._id, { st: 1 });
        formattedMessage.status = 'delivered';
        
        // Notify sender about delivery
        socket.emit('message_delivered', {
          messageId: newMessage._id,
          status: 'delivered'
        });
      }

      // Confirm to sender
      socket.emit('message_sent', {
        tempId: data.tempId,
        message: formattedMessage
      });

    } catch (error) {
      socket.emit('message_error', { error: error.message });
    }
  });

  // Handle owner sending message to tenant
  socket.on('send_message_to_tenant', async (data) => {
    const { userId, pgId, message, issueType = 'general' } = data;
    
    try {
      // Verify ownership
      const property = await Property.findById(pgId);
      if (!property || property.owner.toString() !== socket.userId.toString()) {
        return socket.emit('message_error', { error: 'Not authorized' });
      }

      const newMessage = await Message.create({
        s: socket.userId,
        r: userId,
        p: pgId,
        m: message,
        t: 0,
        i: issueTypeMap[issueType.toLowerCase()] || 0,
        st: 0
      });

      const formattedMessage = {
        _id: newMessage._id,
        text: newMessage.m,
        type: 'text',
        issueType: issueType.toLowerCase(),
        status: 'sent',
        createdAt: newMessage.c,
        sender: { _id: socket.userId, name: socket.user?.name || 'Owner' },
        receiver: { _id: userId }
      };

      // Emit to tenant if online
      const tenantSocketId = connectedUsers.get(userId);
      if (tenantSocketId) {
        io.to(tenantSocketId).emit('new_message', {
          message: formattedMessage,
          pgId: pgId,
          senderId: socket.userId
        });
        
        await Message.findByIdAndUpdate(newMessage._id, { st: 1 });
      }

      socket.emit('message_sent', {
        tempId: data.tempId,
        message: { ...formattedMessage, status: 'delivered' }
      });

    } catch (error) {
      socket.emit('message_error', { error: error.message });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { receiverId, pgId, isTyping } = data;
    const receiverSocketId = connectedOwners.get(receiverId) || 
                             connectedUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', {
        userId: socket.userId,
        pgId: pgId,
        isTyping: isTyping
      });
    }
  });

  // Mark messages as read
  socket.on('mark_read', async (data) => {
    const { messageIds, senderId } = data;
    
    try {
      await Message.updateMany(
        { _id: { $in: messageIds }, r: socket.userId },
        { $set: { st: 2, ra: new Date() } }
      );

      // Notify sender that messages were read
      const senderSocketId = connectedOwners.get(senderId) || 
                            connectedUsers.get(senderId);
      
      if (senderSocketId) {
        io.to(senderSocketId).emit('messages_read', {
          messageIds: messageIds,
          readBy: socket.userId
        });
      }
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  // Join PG room for group notifications
  socket.on('join_pg', (pgId) => {
    socket.join(`pg_${pgId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
    connectedUsers.delete(socket.userId.toString());
    connectedOwners.delete(socket.userId.toString());
  });
});

// Make io accessible in routes
app.set('io', io);

app.use(cookieParser());
// Connect DB
connectDB();

app.use(hpp());

// // Sanitize data
// app.use(
//   mongoSanitize({
//     replaceWith: '_',   // instead of deleting req.query, it will safely replace keys
//   })
// );


// Set security headers
app.use(helmet());

// Prevent XSS attacks
// app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Enable CORS
app.use(cors());




app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// // Routes
app.use("/api/auth", userRoutes);
app.use('/api/students', students);
app.use('/api/properties', hostels);
app.use('/api/:hostelId/reviews', require('./routes/reviewroute'));
app.use('/api/bookings',Bookings)
app.use('/api/rooms', Rooms);
app.use('/api/reviews',Reviews)
app.use('/api/payments',payments)
// Mount routes
app.use('/api/rooms/:roomId/beds', bedRoutes);
app.use('/api/v1/hostels/:hostelId/beds', bedRoutes);
app.use('/api/location',locationController)
app.use('/api/upload', uploadRoutes);
app.use('/api/maintenance',maintenance)

app.get('/',(req,res)=>{
  res.send('running')
})


const PORT = process.env.PORT || '5000';
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
