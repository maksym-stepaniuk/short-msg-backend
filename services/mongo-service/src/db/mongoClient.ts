import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error("MONGO_URI environment variable is required");
}

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
