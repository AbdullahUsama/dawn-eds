import { runAll } from '../app.js';
import { connectToMongo } from '../db.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

       try {
        // Ensure MongoDB is connected first
        await connectToMongo();
        
        const { startDate, endDate, email } = req.body;
        
        if (!startDate || !endDate || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        console.log(`Processing request for dates: ${startDate} to ${endDate}`);
        await runAll(startDate, endDate, email, false); // Pass false to prevent DB closing
        
        res.json({ 
            success: true, 
            message: 'Process started! You will receive an email shortly.' 
        });
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'An error occurred while processing your request'
        });
    }
}