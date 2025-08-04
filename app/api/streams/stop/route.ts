import Stream from "@/models/LiveStream";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

    try {
        const { streamKey } = await  req.json();

        if(!streamKey){
            return NextResponse.json({error: "Stream key required"},{status: 400})
        }

        const stream = await Stream.findOneAndUpdate(
          { streamKey, isLive: true },
          {
            isLive: false,
            endTime: new Date(),
          },
          { new: true }
        );

        if (!stream) {
          return NextResponse.json({ error: "Stream not found" },{status: 404});
        }

        return  NextResponse.json({
          success: true,
          message: "Stream stopped successfully",
        },{status: 200});
    } catch (error) {
        console.log((error as Error).message)
        return NextResponse.json({error: "Internal server issue"},{status: 500})
    }
    
}