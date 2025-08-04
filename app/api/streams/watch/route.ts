import { connectdb } from "@/lib/mongodb";
import Stream from "@/models/LiveStream";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req:NextRequest) {

    try {
         const id  = req.nextUrl.searchParams.get("id") 
         if(!id){
            return NextResponse.json({error: "Stream id required"},{status: 400})
         }

         await connectdb()
         const stream = await Stream.findById(id);

         if (!stream || !stream.isLive) {
           return NextResponse.json({ error: "Stream not found or not live" },{status: 404});
         }

         // Increment viewer count
         await Stream.findByIdAndUpdate({_id: id}, { $inc: { viewers: 1 } });

         // Redirect to HLS stream
         redirect(
           `http://localhost:8000/live/${stream.streamKey}/index.m3u8`
         );
    } catch (error) {
        console.log((error as Error).message)
        return NextResponse.json({error: "Internal server issue"},{status: 500})
    }
    
}