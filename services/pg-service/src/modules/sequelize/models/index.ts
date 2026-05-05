import { ConversationAuditLog } from "./conversationAuditLog";
import { DeliveryReceipt } from "./deliveryReceipt";

ConversationAuditLog.hasMany(DeliveryReceipt, {
  as: "deliveryReceipts",
  foreignKey: "auditLogId"
});

DeliveryReceipt.belongsTo(ConversationAuditLog, {
  as: "auditLog",
  foreignKey: "auditLogId"
});

export { ConversationAuditLog, DeliveryReceipt };
