import { connectToMongo } from './db.js';
export default async function handler(req, res) {
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
        await connectToMongo();
        
        const { startDate, endDate, email } = req.body;
        
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
        console.error('Detailed error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'An error occurred while processing your request'
        });
    }
}