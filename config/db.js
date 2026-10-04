const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
    try {
        if (
            mongoose.connection.readyState === 1
        ) {
            return mongoose.connection;
        }

        if (cachedConnection) {
            return cachedConnection;
        }

        const mongoURI =
            process.env.MONGO_URI;

        if (
            !mongoURI ||
            typeof mongoURI !== 'string' ||
            !mongoURI.trim()
        ) {
            throw new Error(
                'MONGO_URI is not defined in the environment variables.'
            );
        }

        cachedConnection =
            mongoose.connect(
                mongoURI.trim(),
                {
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    maxPoolSize: 10,
                    minPoolSize: 2
                }
            );

        const connection =
            await cachedConnection;

        console.log('');
        console.log(
            ` Database: ${connection.connection.name}`
        );
        console.log(
            ` Host: ${connection.connection.host}`
        );
        console.log(
            ' Status: Connected'
        );
        console.log(
            ' MongoDB: Atlas'
        );
        console.log('');

        return connection;

    } catch (error) {
        cachedConnection = null;

        console.error('');
        console.error(
            ' MONGODB CONNECTION FAILED'
        );
        console.error(
            ` ${error.message}`
        );
        console.error('');

        throw error;
    }
};

module.exports = connectDB;