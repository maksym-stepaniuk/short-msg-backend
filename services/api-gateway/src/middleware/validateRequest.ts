import type { RequestHandler } from "express";
import { z } from "zod";

type RequestSchemas = {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
  headers?: z.ZodType;
};

export const validateRequest = (schemas: RequestSchemas): RequestHandler => {
  return (req, _res, next) => {
    try {
      schemas.params?.parse(req.params);
      schemas.query?.parse(req.query);
      schemas.headers?.parse(req.headers);
      schemas.body?.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
};

