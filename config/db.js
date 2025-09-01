const mongoose = require('mongoose')

const connectDb = async()=>{
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI)
        console.log(`Mongodb connected successfully ${conn.connection.host}`);  
    } catch (error) {
        console.log(`Error connecting to the database ${error}`);
        process.exit(1)
    }
}
module.exports = connectDb 