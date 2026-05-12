const assert = require("node:assert/strict");

const gatewayUrl = process.env.API_GATEWAY_URL ?? "http://localhost:3000";

const request = async (method, path, body, headers = {}) => {
  const response = await fetch(`${gatewayUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return {
    status: response.status,
    payload
  };
};

const createUser = async (suffix) => {
  const response = await request("POST", "/users", {
    email: `read-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,
    username: `read-${suffix}`
  });
  assert.equal(response.status, 201);
  return response.payload;
};

const sendMessage = async (conversationId, authorId, body) => {
  const response = await request("POST", `/conversations/${conversationId}/messages`, {
    authorId,
    body,
    attachments: [],
    clientMessageId: `read-${Date.now()}-${Math.random().toString(16).slice(2)}`
  });
  assert.equal(response.status, 201);
  return response.payload;
};

const main = async () => {
  const author = await createUser("author");
  const member = await createUser("member");
  const outsider = await createUser("outsider");

  const conversation = await request("POST", "/conversations", {
    type: "direct",
    createdById: author.id,
    memberIds: [member.id]
  });
  assert.equal(conversation.status, 201);
  const conversationId = conversation.payload.id;

  const first = await sendMessage(conversationId, author.id, "first read endpoint message");
  const second = await sendMessage(conversationId, member.id, "second read endpoint needle message");

  const messages = await request(
    "GET",
    `/conversations/${conversationId}/messages?requesterId=${author.id}&afterSeq=0&limit=20`
  );
  assert.equal(messages.status, 200);
  assert.deepEqual(
    messages.payload.map((message) => message.seq),
    [first.seq, second.seq]
  );

  const beforeSecond = await request(
    "GET",
    `/conversations/${conversationId}/messages?beforeSeq=${second.seq}&limit=20`,
    undefined,
    {
      "X-User-Id": member.id
    }
  );
  assert.equal(beforeSecond.status, 200);
  assert.equal(beforeSecond.payload.length, 1);
  assert.equal(beforeSecond.payload[0].seq, first.seq);

  const forbiddenMessages = await request(
    "GET",
    `/conversations/${conversationId}/messages?requesterId=${outsider.id}&limit=20`
  );
  assert.equal(forbiddenMessages.status, 403);
  assert.equal(forbiddenMessages.payload.code, "NOT_MEMBER");

  const search = await request(
    "GET",
    `/conversations/${conversationId}/messages/search?requesterId=${author.id}&q=needle&limit=10`
  );
  assert.equal(search.status, 200);
  assert.ok(search.payload.some((message) => message._id === second._id));

  const forbiddenSearch = await request(
    "GET",
    `/conversations/${conversationId}/messages/search?requesterId=${outsider.id}&q=needle`
  );
  assert.equal(forbiddenSearch.status, 403);
  assert.equal(forbiddenSearch.payload.code, "NOT_MEMBER");

  const conversations = await request("GET", `/users/${author.id}/conversations`);
  assert.equal(conversations.status, 200);
  assert.equal(conversations.payload[0].id, conversationId);
  assert.ok(["admin", "member"].includes(conversations.payload[0].role));
  assert.equal(conversations.payload[0].lastSeq, second.seq);
  assert.ok(Object.hasOwn(conversations.payload[0], "joinedAt"));
  assert.ok(Object.hasOwn(conversations.payload[0], "lastMessageAt"));

  console.log("read-endpoints e2e passed");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
