const assert = require("node:assert/strict");

const gatewayUrl = process.env.API_GATEWAY_URL ?? "http://localhost:8080";

const request = async (method, path, body) => {
  const response = await fetch(`${gatewayUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json"
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
    email: `domain-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,
    username: `domain-${suffix}`
  });
  assert.equal(response.status, 201);
  return response.payload;
};

const main = async () => {
  const admin = await createUser("admin");
  const member = await createUser("member");
  const secondMember = await createUser("second-member");
  const outsider = await createUser("outsider");

  const directTooMany = await request("POST", "/conversations", {
    type: "direct",
    createdById: admin.id,
    memberIds: [member.id, outsider.id]
  });
  assert.equal(directTooMany.status, 400);
  assert.equal(directTooMany.payload.code, "DIRECT_CONVERSATION_REQUIRES_TWO_MEMBERS");

  const group = await request("POST", "/conversations", {
    type: "group",
    title: "domain rules group",
    createdById: admin.id,
    memberIds: [member.id]
  });
  assert.equal(group.status, 201);
  const conversationId = group.payload.id;

  const duplicateMember = await request("POST", `/conversations/${conversationId}/members`, {
    requesterId: admin.id,
    userId: member.id
  });
  assert.equal(duplicateMember.status, 409);
  assert.equal(duplicateMember.payload.code, "PRISMA_UNIQUE_CONSTRAINT");

  const nonAdminAdd = await request("POST", `/conversations/${conversationId}/members`, {
    requesterId: member.id,
    userId: outsider.id
  });
  assert.equal(nonAdminAdd.status, 403);
  assert.equal(nonAdminAdd.payload.code, "NOT_ADMIN");

  const adminAdd = await request("POST", `/conversations/${conversationId}/members`, {
    requesterId: admin.id,
    userId: secondMember.id
  });
  assert.equal(adminAdd.status, 201);

  const forbiddenMessage = await request("POST", `/conversations/${conversationId}/messages`, {
    authorId: outsider.id,
    body: "not a member",
    attachments: []
  });
  assert.equal(forbiddenMessage.status, 403);
  assert.equal(forbiddenMessage.payload.code, "NOT_MEMBER");

  const attachmentOnlyMessage = await request("POST", `/conversations/${conversationId}/messages`, {
    authorId: admin.id,
    body: "",
    attachments: [
      {
        fileName: "empty-body.txt",
        mimeType: "text/plain",
        size: 5,
        storageKey: "domain/empty-body.txt"
      }
    ],
    clientMessageId: `attachment-only-${Date.now()}`
  });
  assert.equal(attachmentOnlyMessage.status, 201);
  assert.equal(attachmentOnlyMessage.payload.body, "");

  const clientMessageId = `idem-${Date.now()}`;
  const firstIdempotent = await request("POST", `/conversations/${conversationId}/messages`, {
    authorId: admin.id,
    body: "idempotent first",
    attachments: [],
    clientMessageId
  });
  assert.equal(firstIdempotent.status, 201);

  const duplicateIdempotent = await request("POST", `/conversations/${conversationId}/messages`, {
    authorId: admin.id,
    body: "idempotent duplicate",
    attachments: [],
    clientMessageId
  });
  assert.equal(duplicateIdempotent.status, 409);
  assert.equal(duplicateIdempotent.payload.code, "IDEMPOTENCY_CONFLICT");

  const softDelete = await request("DELETE", `/users/${outsider.id}`);
  assert.equal(softDelete.status, 200);
  assert.ok(softDelete.payload.deletedAt);

  console.log("domain-rules e2e passed");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
