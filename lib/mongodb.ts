import mongoose from "mongoose";

export const connectdb = async ()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI as string , {
            dbName:"LiveStream"
        });
    } catch (error) {
        console.log((error as Error).message)
    }
}