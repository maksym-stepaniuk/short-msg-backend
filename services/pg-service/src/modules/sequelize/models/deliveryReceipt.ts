import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from "sequelize";
import { sequelize } from "../sequelize";

export type DeliveryReceiptStatus = "server_received" | "delivered" | "read";

export class DeliveryReceipt extends Model<
  InferAttributes<DeliveryReceipt>,
  InferCreationAttributes<DeliveryReceipt>
> {
  declare id: CreationOptional<string>;
  declare auditLogId: string;
  declare messagePointerId: string;
  declare userId: string;
  declare status: DeliveryReceiptStatus;
  declare deliveredAt: Date | null;
  declare readAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

DeliveryReceipt.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    auditLogId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    messagePointerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM("server_received", "delivered", "read"),
      allowNull: false,
      validate: {
        isIn: [["server_received", "delivered", "read"]]
      }
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        readRequiresReadStatus(this: DeliveryReceipt, value: Date | null) {
          if (value && this.status !== "read") {
            throw new Error("readAt cannot be set when status is not read");
          }
        }
      }
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  },
  {
    sequelize,
    tableName: "delivery_receipts",
    hooks: {
      beforeCreate: (receipt) => {
        const now = new Date();

        if (receipt.status === "delivered" && !receipt.deliveredAt) {
          receipt.deliveredAt = now;
        }

        if (receipt.status === "read") {
          receipt.readAt = receipt.readAt ?? now;
          receipt.deliveredAt = receipt.deliveredAt ?? receipt.readAt;
        }
      }
    }
  }
);
