exports.up = async function up(knex) {
  await knex.schema.alterTable("conversation_search_audit", (table) => {
    table.index(["createdAt"], "conversation_search_audit_created_at_idx");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("conversation_search_audit", (table) => {
    table.dropIndex(["createdAt"], "conversation_search_audit_created_at_idx");
  });
};
