import { connectdb } from "@/lib/mongodb";
import Stream from "@/models/LiveStream";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const {title, description, streamKey} = await req.json()
        if(!title || !description || !streamKey){
            return NextResponse.json({error: "title, description or streamkey required"},{status: 400})
        }

        await connectdb()

         const stream = new Stream({
           title,
           description,
           streamKey,
           isLive: true,
           startTime: new Date(),
           viewers: 0,
         });

         await stream.save();

       return  NextResponse.json({
           success: true,
           streamId: stream._id,
           message: "Stream started successfully",
         },{status: 200});
    } catch (error) {
        console.log((error as Error).message)
        return NextResponse.json({error: "Failed to start the stream"},{status: 500})
    }
    
}