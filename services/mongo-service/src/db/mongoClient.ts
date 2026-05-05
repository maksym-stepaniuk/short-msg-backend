import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI ?? "mongodb://chat_admin:chat_password@localhost:27017/chat_backend?authSource=admin";

export const mongoClient = new MongoClient(uri);

let connected = false;

export const connectMongo = async () => {
  if (!connected) {
    await mongoClient.connect();
    connected = true;
  }

  return mongoClient;
};

export const closeMongo = async () => {
  if (connected) {
    await mongoClient.close();
    connected = false;
  }
};
