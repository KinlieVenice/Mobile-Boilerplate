import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { prisma } from "./db.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", message: "Server running!", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", message: "Server running!", db: "unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
