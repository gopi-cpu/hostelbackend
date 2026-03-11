const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Single letter field names for minimal storage
  s: {  // sender (12 bytes vs 24 char string)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  r: {  // receiver
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  p: {  // property/pg
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true
  },
  m: {  // message content
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  t: {  // type: 0=text, 1=image, 2=file, 3=system
    type: Number,
    default: 0,
    enum: [0, 1, 2, 3]
  },
  i: {  // issueType: 0=general, 1=maintenance, 2=payment, 3=complaint, 4=other
    type: Number,
    default: 0,
    enum: [0, 1, 2, 3, 4]
  },
  st: { // status: 0=sent, 1=delivered, 2=read
    type: Number,
    default: 0,
    enum: [0, 1, 2]
  },
  meta: { // metadata for files (optional, minimized)
    u: String, // url
    n: String, // name
    s: Number  // size
  },
  rt: { // replyTo (threading)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    sparse: true
  },
  ra: Date // readAt (only set when actually read)
}, {
  timestamps: {
    createdAt: 'c',  // short field names
    updatedAt: 'u'
  },
  minimize: true,     // don't store empty objects
  versionKey: false   // remove __v field
});

// Compound indexes for common queries
messageSchema.index({ p: 1, c: -1 });           // Property messages, newest first
messageSchema.index({ s: 1, r: 1, c: -1 });     // Conversation between users
messageSchema.index({ r: 1, st: 1 });           // Unread messages for receiver

// Optional: Auto-delete messages older than 2 years
// messageSchema.index({ c: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('Message', messageSchema);