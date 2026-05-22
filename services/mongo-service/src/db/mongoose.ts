import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
const databaseName = process.env.MONGO_DATABASE ?? process.env.MONGO_INITDB_DATABASE;

if (!uri) {
  throw new Error("MONGO_URI environment variable is required");
}

if (!databaseName) {
  throw new Error("MONGO_DATABASE or MONGO_INITDB_DATABASE environment variable is required");
}

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
