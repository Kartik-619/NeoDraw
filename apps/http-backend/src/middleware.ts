import { NextFunction, Request, Response } from "express";
import { JWT_SECRET } from "@repo/backend-common/config";
import jwt, { JwtPayload } from "jsonwebtoken";

// 1. Extend the Express Request type properly
interface AuthenticatedRequest extends Request {
    userId?: string;
}

export function middleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"] ?? "";
    // Handle both "Bearer <token>" and raw token
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

    if (!token || !JWT_SECRET) {
        res.status(403).json({ message: "Unauthorized: Missing token or config" });
        return;
    }

    try {
        // 2. Explicitly cast to JwtPayload to access .userId
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

        // 3. Robust check: ensure it's an object and has the property
        if (typeof decoded !== "string" && decoded.userId) {
            req.userId = decoded.userId as string;
            next();
        } else {
            res.status(403).json({ message: "Unauthorized: Invalid token payload" });
        }
    } catch (err) {
        res.status(403).json({ message: "Unauthorized: Token verification failed" });
    }
}