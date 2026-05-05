exports.up = async function up(knex) {
  await knex.schema.createTable("conversation_audit_logs", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("conversationId").notNullable().references("id").inTable("conversations").onDelete("CASCADE");
    table.uuid("actorId").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.string("action").notNullable();
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("createdAt", { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: false }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("delivery_receipts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("auditLogId").notNullable().references("id").inTable("conversation_audit_logs").onDelete("CASCADE");
    table.uuid("messagePointerId").notNullable().references("id").inTable("message_pointers").onDelete("CASCADE");
    table.uuid("userId").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.enu("status", ["server_received", "delivered", "read"], {
      useNative: true,
      enumName: "delivery_receipt_status"
    }).notNullable();
    table.timestamp("deliveredAt", { useTz: false }).nullable();
    table.timestamp("readAt", { useTz: false }).nullable();
    table.timestamp("createdAt", { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: false }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("delivery_receipts");
  await knex.schema.dropTableIfExists("conversation_audit_logs");
  await knex.raw('DROP TYPE IF EXISTS "delivery_receipt_status"');
};
