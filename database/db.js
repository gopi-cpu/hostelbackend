
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://penchalagopi7396_db_user:pEm9e3EkcrHRspJX@ac-wnkhubn-shard-00-00.yyocng9.mongodb.net:27017,ac-wnkhubn-shard-00-01.yyocng9.mongodb.net:27017,ac-wnkhubn-shard-00-02.yyocng9.mongodb.net:27017/hrms?ssl=true&replicaSet=atlas-3uuknb-shard-0&authSource=admin&retryWrites=true&w=majority", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1); // Exit if DB fails
  }
};

module.exports = connectDB;
