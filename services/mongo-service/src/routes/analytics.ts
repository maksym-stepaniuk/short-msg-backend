import { Router } from "express";
import { messagesCollection } from "../db/messagesCollection";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

const optionalString = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter must be provided once", { field });
  }

  return requireString(value, field);
};

const parseOptionalDate = (value: unknown, field: string) => {
  const raw = optionalString(value, field);

  if (!raw) {
    return undefined;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid date", { field });
  }

  return date;
};

const requiredDateRangeMatch = (from?: Date, to?: Date) => {
  return {
    createdAt: {
      $gte: from ?? new Date(0),
      $lte: to ?? new Date("9999-12-31T23:59:59.999Z")
    }
  };
};

export const analyticsRouter = Router();

analyticsRouter.get(
  "/analytics/messages-per-day",
  asyncHandler(async (req, res) => {
    const conversationId = requireString(req.query.conversationId, "conversationId");
    const from = parseOptionalDate(req.query.from, "from");
    const to = parseOptionalDate(req.query.to, "to");

    const collection = await messagesCollection();
    const result = await collection
      .aggregate([
        {
          $match: {
            conversationId,
            ...requiredDateRangeMatch(from, to)
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            },
            count: {
              $sum: 1
            }
          }
        },
        {
          $project: {
            _id: 0,
            day: "$_id",
            count: 1
          }
        },
        {
          $sort: {
            day: 1
          }
        }
      ])
      .toArray();

    res.json(result);
  })
);

analyticsRouter.get(
  "/analytics/messages-per-conversation",
  asyncHandler(async (req, res) => {
    const from = parseOptionalDate(req.query.from, "from");
    const to = parseOptionalDate(req.query.to, "to");

    const collection = await messagesCollection();
    const result = await collection
      .aggregate([
        {
          $match: requiredDateRangeMatch(from, to)
        },
        {
          $group: {
            _id: "$conversationId",
            count: {
              $sum: 1
            }
          }
        },
        {
          $lookup: {
            from: "activityevents",
            let: {
              conversationId: "$_id"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$conversationId", "$$conversationId"]
                  }
                }
              },
              {
                $sort: {
                  createdAt: -1
                }
              },
              {
                $limit: 1
              }
            ],
            as: "lastActivity"
          }
        },
        {
          $project: {
            _id: 0,
            conversationId: "$_id",
            count: 1,
            lastActivityType: {
              $ifNull: [
                {
                  $arrayElemAt: ["$lastActivity.type", 0]
                },
                null
              ]
            }
          }
        },
        {
          $sort: {
            count: -1
          }
        }
      ])
      .toArray();

    res.json(result);
  })
);
