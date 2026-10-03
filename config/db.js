const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI;

        if (!mongoURI) {
            throw new Error(
                'MONGO_URI is not defined in the environment variables.'
            );
        }
        const connection = await mongoose.connect(mongoURI);
        console.log('');
        console.log(` Database: ${connection.connection.name}`);
        console.log(` Host: ${connection.connection.host}`);
        console.log(' Status: Connected');
        console.log('');
    } catch (error) {
        console.error('');
        console.error(' MONGODB CONNECTION FAILED');
        console.error(error.message);
        console.error('');
        process.exit(1);
    }
};

module.exports = connectDB;