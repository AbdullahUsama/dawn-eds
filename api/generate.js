import { connectToMongo } from '../db.js';
import { runAll } from '../app.js';

export default async function handler(req, res) {
    // Set proper content type for JSON responses
    res.setHeader('Content-Type', 'application/json');
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({ status: 'ok' });
    }

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                success: false, 
                message: 'Method not allowed' 
            });
        }

        const { startDate, endDate, email } = req.body || {};

        // Enhanced validation with specific messages
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: 'Request body is missing'
            });
        }

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

        // Connect to MongoDB
        await connectToMongo();

        // Run the main process
        await runAll(startDate, endDate, email, false, true);
        
        return res.status(200).json({ 
            success: true, 
            message: 'Process started! You will receive an email shortly.' 
        });
    } catch (error) {
        console.error('API Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}