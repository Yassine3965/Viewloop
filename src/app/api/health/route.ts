import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    time: Date.now(),
    uptime: process.uptime(),
    version: "1.0.0"
  });
}
