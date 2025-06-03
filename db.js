// db.js
import { MongoClient, ServerApiVersion } from 'mongodb';
import { MONGODB_CONFIG } from './config.js'; // Import config

let client;
let dbInstance;

/**
 * Establishes a connection to the MongoDB database.
 * This function should be called once at the application's start.
 */
export async function connectToMongo() {
    if (dbInstance) {
        console.log("Already connected to MongoDB.");
        return;
    }

    client = new MongoClient(MONGODB_CONFIG.URI, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    try {
        await client.connect();
        console.log("Connected to MongoDB!");
        dbInstance = client.db(MONGODB_CONFIG.DB_NAME);
    } catch (error) {
        console.error("❌ Error connecting to MongoDB:", error);
        // Exiting the process if DB connection fails at startup is a common strategy
        // for applications that heavily rely on the database.
        process.exit(1);
    }
}

/**
 * Retrieves the active MongoDB database instance.
 * @returns {import('mongodb').Db | null} The MongoDB database instance or null if not yet connected.
 */
export function getDb() {
    if (!dbInstance) {
        console.error("⚠️ MongoDB not connected. Ensure connectToMongo() has been called.");
        return null;
    }
    return dbInstance;
}

/**
 * Closes the active MongoDB connection.
 */
export async function closeMongo() {
    if (client) {
        await client.close();
        console.log("MongoDB connection closed.");
    }
}

/**
 * Logs details of a sent email into the designated MongoDB collection.
 * @param {object} emailDetails - An object containing information about the sent email.
 * @param {string} emailDetails.recipientEmail - The email address of the recipient.
 * @param {string} emailDetails.pdfFileName - The name of the attached PDF file.
 * @param {string} [emailDetails.senderName="Dawn News Bot"] - The name displayed as the sender.
 * @param {string} emailDetails.messageId - The unique ID returned by the email service provider.
 */
export async function logSentEmail(emailDetails) {
    const db = getDb();
    if (!db) {
        console.error("Cannot log email: MongoDB connection not established.");
        return;
    }
    try {
        const sentEmailsCollection = db.collection(MONGODB_CONFIG.COLLECTION_NAME);
        await sentEmailsCollection.insertOne({
            recipientEmail: emailDetails.recipientEmail,
            senderName: emailDetails.senderName || "Dawn News Bot",
            pdfFileName: emailDetails.pdfFileName,
            timestamp: new Date(),
            messageId: emailDetails.messageId
        });
        console.log("Email details successfully logged to MongoDB!");
    } catch (error) {
        console.error('❌ Error logging email to database:', error);
    }
}

// Ensure MongoDB connection is gracefully closed on script termination
process.on('SIGINT', async () => {
    console.log("\nAttempting to close MongoDB connection...");
    await closeMongo();
    process.exit(0);
});