import { connectdb } from "@/lib/mongodb";
import Stream from "@/models/LiveStream";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {

    try {
        await connectdb()
        const streams = await Stream.find({isLive: true}).sort({startTime: -1});
        return NextResponse.json({streams},{status: 200})
    } catch (error) {
        console.log((error as Error).message)
        return NextResponse.json({message: "Internal server issue"},{status: 500})
    }
    
}