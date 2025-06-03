import { connectToMongo } from '../db.js';
import { runAll } from '../app.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Add global error handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default async function handler(req, res) {
    // Add request logging
    console.log('Incoming request:', {
        method: req.method,
        headers: req.headers,
        body: req.body
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Validate request method
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                success: false, 
                message: 'Method not allowed' 
            });
        }

        // Log and validate request body
        console.log('Request body:', req.body);
        
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: 'Request body is missing'
            });
        }

        const { startDate, endDate, email } = req.body;

        // Validate required fields
        if (!startDate || !endDate || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields',
                details: {
                    startDate: !startDate ? 'missing' : 'ok',
                    endDate: !endDate ? 'missing' : 'ok',
                    email: !email ? 'missing' : 'ok'
                }
            });
        }

        // Try MongoDB connection
        console.log('Attempting MongoDB connection...');
        try {
            await connectToMongo();
            console.log('MongoDB connected successfully');
        } catch (dbError) {
            console.error('MongoDB connection error:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Database connection failed',
                error: dbError.message
            });
        }

        // Run main process with error handling
        console.log('Starting runAll process...');
        try {
            await runAll(startDate, endDate, email, false, true);
            console.log('runAll completed successfully');
        } catch (processError) {
            console.error('runAll process error:', processError);
            return res.status(500).json({
                success: false,
                message: 'Process execution failed',
                error: processError.message
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Process started! You will receive an email shortly.' 
        });
    } catch (error) {
        // Enhanced error logging
        console.error('API Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? {
                name: error.name,
                stack: error.stack,
                code: error.code
            } : undefined
        });
    }
}