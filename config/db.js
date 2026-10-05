const mongoose = require('mongoose');


/* ============================================================
   CONNECTION CACHE
============================================================ */

let cachedConnection = null;


/* ============================================================
   DATABASE CONNECTION
============================================================ */

const connectDB = async () => {
    try {

        /* --------------------------------------------------------
           ALREADY CONNECTED
        -------------------------------------------------------- */

        if (
            mongoose.connection.readyState === 1
        ) {
            return mongoose.connection;
        }


        /* --------------------------------------------------------
           CONNECTION ALREADY IN PROGRESS
        -------------------------------------------------------- */

        if (cachedConnection) {
            return await cachedConnection;
        }


        /* --------------------------------------------------------
           MONGODB URI
        -------------------------------------------------------- */

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


        /* --------------------------------------------------------
           CREATE CONNECTION
        -------------------------------------------------------- */

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


        /* --------------------------------------------------------
           WAIT FOR CONNECTION
        -------------------------------------------------------- */

        const connection =
            await cachedConnection;


        /* --------------------------------------------------------
           CONNECTION SUCCESS
        -------------------------------------------------------- */

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

        /* --------------------------------------------------------
           RESET CACHE AFTER FAILURE
        -------------------------------------------------------- */

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


/* ============================================================
   EXPORT
============================================================ */

module.exports = connectDB;