const request = require("supertest");

const gatewayUrl = process.env.API_GATEWAY_URL ?? "http://localhost:8080";
const api = request(gatewayUrl);

const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createUser = async (label) => {
  const response = await api.post("/users").send({
    email: `jest-${label}-${unique()}@example.test`,
    username: `jest-${label}`
  });

  expect(response.status).toBe(201);
  expect(response.body).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      email: expect.any(String),
      username: `jest-${label}`,
      createdAt: expect.any(String)
    })
  );

  return response.body;
};

const createGroup = async (adminId, memberIds = [], title = "Jest critical group") => {
  const response = await api.post("/conversations").send({
    type: "group",
    title: `${title} ${unique()}`,
    createdById: adminId,
    memberIds
  });

  expect(response.status).toBe(201);
  return response.body;
};

const expectErrorShape = (body) => {
  expect(body).toEqual(
    expect.objectContaining({
      error: expect.any(String),
      code: expect.any(String)
    })
  );
  expect(Object.hasOwn(body, "details")).toBe(true);
};

describe("api-gateway critical e2e paths", () => {
  test("GET /health returns OK", async () => {
    const response = await api.get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "api-gateway"
    });
  });

  test("users: creates user and duplicate email returns 409 error format", async () => {
    const email = `jest-duplicate-${unique()}@example.test`;

    const created = await api.post("/users").send({
      email,
      username: "jest-duplicate"
    });
    expect(created.status).toBe(201);

    const duplicate = await api.post("/users").send({
      email,
      username: "jest-duplicate-again"
    });
    expect(duplicate.status).toBe(409);
    expectErrorShape(duplicate.body);
    expect(duplicate.body.code).toBe("PRISMA_UNIQUE_CONSTRAINT");
  });

  test("conversations: group admin rules and membership conflicts", async () => {
    const admin = await createUser("group-admin");
    const member = await createUser("group-member");
    const secondMember = await createUser("group-second-member");
    const outsider = await createUser("group-outsider");

    const conversation = await createGroup(admin.id, [member.id]);
    expect(conversation.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: admin.id, role: "admin" })
      ])
    );

    const adminAdd = await api.post(`/conversations/${conversation.id}/members`).send({
      requesterId: admin.id,
      userId: secondMember.id
    });
    expect(adminAdd.status).toBe(201);
    expect(adminAdd.body).toEqual(expect.objectContaining({ userId: secondMember.id, role: "member" }));

    const nonAdminAdd = await api.post(`/conversations/${conversation.id}/members`).send({
      requesterId: member.id,
      userId: outsider.id
    });
    expect(nonAdminAdd.status).toBe(403);
    expectErrorShape(nonAdminAdd.body);
    expect(nonAdminAdd.body.code).toBe("NOT_ADMIN");

    const duplicateMember = await api.post(`/conversations/${conversation.id}/members`).send({
      requesterId: admin.id,
      userId: member.id
    });
    expect(duplicateMember.status).toBe(409);
    expectErrorShape(duplicateMember.body);
    expect(duplicateMember.body.code).toBe("PRISMA_UNIQUE_CONSTRAINT");
  });

  test("messages: member sends, Mongo document and PostgreSQL pointer are persisted", async () => {
    const author = await createUser("message-author");
    const member = await createUser("message-member");
    const outsider = await createUser("message-outsider");
    const conversation = await createGroup(author.id, [member.id]);

    const message = await api.post(`/conversations/${conversation.id}/messages`).send({
      authorId: author.id,
      body: "critical e2e persisted message",
      attachments: [],
      clientMessageId: `critical-${unique()}`
    });
    expect(message.status).toBe(201);
    expect(message.body).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        conversationId: conversation.id,
        authorId: author.id,
        seq: 1,
        body: "critical e2e persisted message",
        deliveryStatus: "server_received"
      })
    );

    const messages = await api
      .get(`/conversations/${conversation.id}/messages`)
      .query({ requesterId: member.id, limit: 10 });
    expect(messages.status).toBe(200);
    expect(messages.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: message.body._id, seq: 1 })
      ])
    );

    const pgConversation = await api.get(`/conversations/${conversation.id}`);
    expect(pgConversation.status).toBe(200);
    expect(pgConversation.body.lastSeq).toBe(1);
    expect(pgConversation.body.lastMessageAt).toEqual(expect.any(String));
    expect(pgConversation.body.messagePointers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mongoId: message.body._id,
          seq: 1,
          authorId: author.id,
          deliveryStatus: "server_received"
        })
      ])
    );

    const forbidden = await api.post(`/conversations/${conversation.id}/messages`).send({
      authorId: outsider.id,
      body: "outsider cannot send",
      attachments: []
    });
    expect(forbidden.status).toBe(403);
    expectErrorShape(forbidden.body);
    expect(forbidden.body.code).toBe("NOT_MEMBER");
  });

  test("message reads: limit and afterSeq cursor work", async () => {
    const author = await createUser("read-author");
    const member = await createUser("read-member");
    const conversation = await createGroup(author.id, [member.id]);

    const first = await api.post(`/conversations/${conversation.id}/messages`).send({
      authorId: author.id,
      body: "first cursor message",
      attachments: [],
      clientMessageId: `cursor-first-${unique()}`
    });
    expect(first.status).toBe(201);

    const second = await api.post(`/conversations/${conversation.id}/messages`).send({
      authorId: member.id,
      body: "second cursor message",
      attachments: [],
      clientMessageId: `cursor-second-${unique()}`
    });
    expect(second.status).toBe(201);

    const limited = await api
      .get(`/conversations/${conversation.id}/messages`)
      .set("X-User-Id", author.id)
      .query({ limit: 1 });
    expect(limited.status).toBe(200);
    expect(limited.body).toHaveLength(1);
    expect(limited.body[0].seq).toBe(1);

    const afterSeq = await api
      .get(`/conversations/${conversation.id}/messages`)
      .query({ requesterId: author.id, afterSeq: first.body.seq, limit: 10 });
    expect(afterSeq.status).toBe(200);
    expect(afterSeq.body.map((message) => message.seq)).toEqual([second.body.seq]);
  });

  test("hybrid operation compensates Mongo document after simulated PostgreSQL finalization failure", async () => {
    const author = await createUser("compensation-author");
    const member = await createUser("compensation-member");
    const conversation = await createGroup(author.id, [member.id]);

    const failed = await api
      .post(`/conversations/${conversation.id}/messages`)
      .set("x-simulate-pg-finalize-failure", "true")
      .send({
        authorId: author.id,
        body: "message that must be compensated by jest",
        attachments: []
      });
    expect(failed.status).toBe(500);
    expectErrorShape(failed.body);
    expect(failed.body.code).toBe("SIMULATED_PG_FINALIZE_FAILURE");

    const messages = await api
      .get(`/conversations/${conversation.id}/messages`)
      .query({ requesterId: author.id, limit: 20 });
    expect(messages.status).toBe(200);
    expect(messages.body.some((message) => message.body === "message that must be compensated by jest")).toBe(false);

    const pgConversation = await api.get(`/conversations/${conversation.id}`);
    expect(pgConversation.status).toBe(200);
    expect(pgConversation.body.lastSeq).toBe(0);
    expect(pgConversation.body.messagePointers).toHaveLength(0);
  });

  test("analytics: messages-per-day returns database aggregation", async () => {
    const author = await createUser("analytics-author");
    const member = await createUser("analytics-member");
    const conversation = await createGroup(author.id, [member.id]);

    const message = await api.post(`/conversations/${conversation.id}/messages`).send({
      authorId: author.id,
      body: "analytics aggregation message",
      attachments: [],
      clientMessageId: `analytics-${unique()}`
    });
    expect(message.status).toBe(201);

    const analytics = await api
      .get("/analytics/messages-per-day")
      .query({ conversationId: conversation.id });
    expect(analytics.status).toBe(200);
    expect(analytics.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: message.body.createdAt.slice(0, 10),
          count: expect.any(Number)
        })
      ])
    );
    expect(analytics.body.find((item) => item.day === message.body.createdAt.slice(0, 10)).count).toBeGreaterThanOrEqual(1);
  });
});
