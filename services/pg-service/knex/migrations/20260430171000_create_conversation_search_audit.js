exports.up = async function up(knex) {
  await knex.schema.createTable("conversation_search_audit", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("userId").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("type").nullable();
    table.string("title").nullable();
    table.timestamp("createdAfter", { useTz: false }).nullable();
    table.timestamp("createdBefore", { useTz: false }).nullable();
    table.integer("resultCount").notNullable().defaultTo(0);
    table.timestamp("createdAt", { useTz: false }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("conversation_search_audit");
};
