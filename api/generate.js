export default async function handler(req, res) {
    // Add error logging
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Validate request method
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                success: false, 
                message: 'Method not allowed' 
            });
        }

        // Validate request body
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: 'Request body is missing'
            });
        }

        const { startDate, endDate, email } = req.body;

        // Log received data
        console.log('Received request with data:', {
            startDate,
            endDate,
            email,
            bodyType: typeof req.body,
            contentType: req.headers['content-type']
        });

        // Validate required fields
        if (!startDate || !endDate || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields',
                received: { startDate, endDate, email }
            });
        }

        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await connectToMongo();

        // Run the main process
        console.log(`Processing request for dates: ${startDate} to ${endDate}`);
        await runAll(startDate, endDate, email, false, true);
        
        // Send success response
        res.status(200).json({ 
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
        
        // Send error response
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Internal server error',
            errorCode: error.code
        });
    }
}