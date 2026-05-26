const assert = require("node:assert/strict");

const gatewayUrl = process.env.API_GATEWAY_URL ?? "http://localhost:8080";

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
    email: `hybrid-${suffix}-${Date.now()}@example.test`,
    username: `hybrid-${suffix}`
  });

  assert.equal(response.status, 201);
  return response.payload;
};

const main = async () => {
  const author = await createUser("author");
  const member = await createUser("member");
  const outsider = await createUser("outsider");

  const conversationResponse = await request("POST", "/conversations", {
    type: "direct",
    createdById: author.id,
    memberIds: [member.id]
  });

  assert.equal(conversationResponse.status, 201);
  const conversationId = conversationResponse.payload.id;

  const messageResponse = await request("POST", `/conversations/${conversationId}/messages`, {
    authorId: author.id,
    body: "hybrid success message",
    attachments: [],
    clientMessageId: `client-${Date.now()}`
  });

  assert.equal(messageResponse.status, 201);
  assert.equal(messageResponse.payload.seq, 1);
  assert.equal(messageResponse.payload.deliveryStatus, "server_received");

  const conversationAfterMessage = await request("GET", `/conversations/${conversationId}`);
  assert.equal(conversationAfterMessage.status, 200);
  assert.equal(conversationAfterMessage.payload.lastSeq, 1);
  assert.equal(conversationAfterMessage.payload.messagePointers.length, 1);
  assert.equal(conversationAfterMessage.payload.messagePointers[0].mongoId, messageResponse.payload._id);

  const forbiddenResponse = await request("POST", `/conversations/${conversationId}/messages`, {
    authorId: outsider.id,
    body: "outsider should not send",
    attachments: []
  });

  assert.equal(forbiddenResponse.status, 403);
  assert.equal(forbiddenResponse.payload.code, "NOT_MEMBER");

  const compensationResponse = await request(
    "POST",
    `/conversations/${conversationId}/messages`,
    {
      authorId: author.id,
      body: "message that must be compensated",
      attachments: []
    },
    {
      "x-simulate-pg-finalize-failure": "true"
    }
  );

  assert.equal(compensationResponse.status, 500);
  assert.equal(compensationResponse.payload.code, "SIMULATED_PG_FINALIZE_FAILURE");

  const messagesAfterCompensation = await request(
    "GET",
    `/conversations/${conversationId}/messages?requesterId=${author.id}&afterSeq=0&limit=20`
  );
  assert.equal(messagesAfterCompensation.status, 200);
  assert.equal(
    messagesAfterCompensation.payload.some((message) => message.body === "message that must be compensated"),
    false
  );

  const conversationAfterCompensation = await request("GET", `/conversations/${conversationId}`);
  assert.equal(conversationAfterCompensation.status, 200);
  assert.equal(conversationAfterCompensation.payload.lastSeq, 1);
  assert.equal(conversationAfterCompensation.payload.messagePointers.length, 1);

  console.log("hybrid-message e2e passed");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
