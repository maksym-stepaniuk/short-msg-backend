const users = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    email: "alice@example.test",
    username: "alice"
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    email: "bob@example.test",
    username: "bob"
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    email: "carol@example.test",
    username: "carol"
  }
];

const conversations = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    type: "direct",
    title: null,
    createdById: users[0].id
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    type: "group",
    title: "study group",
    createdById: users[0].id
  }
];

exports.seed = async function seed(knex) {
  await knex("users")
    .insert(users)
    .onConflict("email")
    .merge(["username"]);

  await knex("conversations")
    .insert(conversations)
    .onConflict("id")
    .merge(["type", "title", "createdById"]);

  await knex("conversation_members")
    .insert([
      {
        conversationId: conversations[0].id,
        userId: users[0].id,
        role: "member"
      },
      {
        conversationId: conversations[0].id,
        userId: users[1].id,
        role: "member"
      },
      {
        conversationId: conversations[1].id,
        userId: users[0].id,
        role: "admin"
      },
      {
        conversationId: conversations[1].id,
        userId: users[1].id,
        role: "member"
      },
      {
        conversationId: conversations[1].id,
        userId: users[2].id,
        role: "member"
      }
    ])
    .onConflict(["conversationId", "userId"])
    .merge(["role"]);
};
