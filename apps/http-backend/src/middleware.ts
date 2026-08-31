import { NextFunction, Request, Response } from "express";
import { JWT_SECRET } from "@repo/backend-common/config";
import jwt from "jsonwebtoken";

interface AuthPayload {
    userId: string;
}

export interface AuthenticatedRequest extends Request {
    userId?: string;
}

export function middleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(403).json({ message: "Unauthorized: No token" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;

        if (!decoded?.userId) {
            return res.status(403).json({ message: "Invalid token" });
        }

        req.userId = decoded.userId;
        next();
    } catch {
        res.status(403).json({ message: "Unauthorized" });
    }
}