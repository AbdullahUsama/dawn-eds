// config.js
import dotenv from 'dotenv';
dotenv.config(); // Loads environment variables from .env file

export const API_KEYS = {
    GEMINI: process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE",
};

export const EMAIL_CONFIG = {
    USER: process.env.GMAIL_USER || 'your-email@gmail.com',
    APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || 'your-app-password',
};

export const MONGODB_CONFIG = {
    URI: process.env.MONGO_URI || "mongodb+srv://abd:123@cluster0.u5omh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    DB_NAME: "dawn-news",
    COLLECTION_NAME: "sentEmails",
};

export const SCRAPING_CONFIG = {
    BASE_URL: "https://www.dawn.com/newspaper/editorial/",
};

export const FILE_PATHS = {
    JSON_OUTPUT: "articles_vocab.json",
    PDF_OUTPUT: "Editorial_Vocabulary.pdf",
};

export const DEFAULT_DATES = {
    START_DATE: "2025-05-30",
    END_DATE: "2025-05-30",
};