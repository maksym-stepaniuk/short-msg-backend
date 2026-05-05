import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from "sequelize";
import { sequelize } from "../sequelize";

export class ConversationAuditLog extends Model<
  InferAttributes<ConversationAuditLog>,
  InferCreationAttributes<ConversationAuditLog>
> {
  declare id: CreationOptional<string>;
  declare conversationId: string;
  declare actorId: string;
  declare action: string;
  declare metadata: Record<string, unknown>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ConversationAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        isObject(value: unknown) {
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            throw new Error("metadata must be an object");
          }
        }
      }
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  },
  {
    sequelize,
    tableName: "conversation_audit_logs",
    hooks: {
      beforeCreate: (auditLog) => {
        auditLog.action = auditLog.action.trim().toUpperCase();
      }
    }
  }
);
