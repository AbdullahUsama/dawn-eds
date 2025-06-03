import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runAll } from './app.js';
import { connectToMongo } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ...existing imports...

app.post('/generate', async (req, res) => {
    const { startDate, endDate, email } = req.body;
    
    if (!startDate || !endDate || !email) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields' 
        });
    }

    try {
        console.log(`Processing request for dates: ${startDate} to ${endDate}`);
        // Pass the frontend dates directly to runAll
        await runAll(startDate, endDate, email);
        res.json({ 
            success: true, 
            message: 'Process started! You will receive an email shortly.' 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred while processing your request' 
        });
    }
});

// Initialize MongoDB connection and start server
async function startServer() {
    try {
        await connectToMongo();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nGracefully shutting down...');
    process.exit(0);
});