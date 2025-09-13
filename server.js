const dotenv = require("dotenv");
const express = require("express");
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

const connectDB = require("./database/db");
const userRoutes = require("./routes/authUser");
// const userRoutes = require("./routes/userRoutes");
const hostels = require('./routes/hostelroute');

const Reviews = require('./routes/reviewroute')
dotenv.config();    


const app = express();

// Middleware
app.use(express.json()); // for parsing application/json


app.use(cookieParser());
// Connect DB
connectDB();


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





// // Routes
app.use("/api/auth", userRoutes);
app.use('/api/hostels', hostels);
app.use('/api/:hostelId/reviews', require('./routes/reviewroute'));
app.use('/api/booking',Bookings)
app.use('/api/rooms', Rooms);
app.use('/api/reviews',Reviews)


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
