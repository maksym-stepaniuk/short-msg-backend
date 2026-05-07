import type { Collection } from "mongodb";
import { connectMongo } from "./mongoClient";
import type { MessageDocument } from "../types/message";

const databaseName = process.env.MONGO_DATABASE ?? process.env.MONGO_INITDB_DATABASE ?? "chat_backend";

export const messagesCollection = async (): Promise<Collection<MessageDocument>> => {
  const client = await connectMongo();
  return client.db(databaseName).collection<MessageDocument>("messages");
};

export const ensureMessageIndexes = async () => {
  const collection = await messagesCollection();

  await collection.createIndexes([
    {
      key: {
        conversationId: 1,
        seq: 1
      },
      unique: true,
      name: "messages_conversation_seq_unique"
    },
    {
      key: {
        conversationId: 1,
        createdAt: -1
      },
      name: "messages_conversation_created_at_idx"
    },
    {
      key: {
        body: "text"
      },
      name: "messages_body_text_idx"
    },
    {
      key: {
        authorId: 1,
        createdAt: -1
      },
      name: "messages_author_created_at_idx"
    },
    {
      key: {
        createdAt: -1
      },
      name: "messages_created_at_idx"
    },
    {
      key: {
        conversationId: 1,
        authorId: 1,
        clientMessageId: 1
      },
      name: "messages_client_message_id_unique",
      unique: true,
      partialFilterExpression: {
        clientMessageId: {
          $exists: true
        }
      }
    }
  ]);
};
