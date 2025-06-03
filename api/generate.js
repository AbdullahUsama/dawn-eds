import { connectToMongo } from '../db.js';  // Fix the import path
import { runAll } from '../app.js';  // Add this import

export default async function handler(req, res) {
    // Add error logging
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    try {
        // Add more detailed logging
        console.log('Attempting to connect to MongoDB...');
        await connectToMongo();
        console.log('MongoDB connected successfully');
        
        const { startDate, endDate, email } = req.body;
        console.log('Received request with data:', { startDate, endDate, email });
        
        if (!startDate || !endDate || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        console.log(`Processing request for dates: ${startDate} to ${endDate}`);
        
        // Pass isVercel=true to handle PDF generation in memory
        await runAll(startDate, endDate, email, false, true);
        
        res.json({ 
            success: true, 
            message: 'Process started! You will receive an email shortly.' 
        });
    } catch (error) {
        // Enhanced error logging
        console.error('Detailed error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        res.status(500).json({ 
            success: false, 
            message: `Error: ${error.message}` || 'An error occurred while processing your request'
        });
    }
}