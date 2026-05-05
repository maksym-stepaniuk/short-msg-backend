import mongoose from "mongoose";

const uri = process.env.MONGO_URI ?? "mongodb://chat_admin:chat_password@localhost:27017/chat_backend?authSource=admin";
const databaseName = process.env.MONGO_DATABASE ?? process.env.MONGO_INITDB_DATABASE ?? "chat_backend";

export const connectMongoose = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      dbName: databaseName
    });
  }
};

export const closeMongoose = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
