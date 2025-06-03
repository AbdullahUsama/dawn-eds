// app.js
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PDFDocument from "pdfkit";
import fs from "fs";
import nodemailer from 'nodemailer';
import { closeMongo } from './db.js';
import { Readable } from 'stream';


// Import configurations and database functions
import { API_KEYS, EMAIL_CONFIG, SCRAPING_CONFIG, FILE_PATHS, DEFAULT_DATES } from './config.js';
import { connectToMongo, getDb, logSentEmail } from './db.js';

// --- Utility Functions (Internal to this module) ---

/**
 * Helper: Formats a Date object into a 'YYYY-MM-DD' string for URLs.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

/**
 * Generates an array of Date objects for each day within a specified inclusive range.
 * @param {string} startDateStr - The starting date string (e.g., "2025-05-30").
 * @param {string} endDateStr - The ending date string (e.g., "2025-05-31").
 * @returns {Date[]} An array of Date objects.
 */
function getDateRange(startDateStr, endDateStr) {
    const dates = [];
    let current = new Date(startDateStr);
    const end = new Date(endDateStr);

    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/**
 * Helper: Extracts content line by line from a given text section, filtering empty lines.
 * This is useful for processing AI responses that might have extraneous formatting.
 * @param {string} section - The text section to process.
 * @returns {string} Cleaned content with each meaningful line separated by a newline.
 */
function extractContentByLine(section) {
    if (!section) return "";
    const lines = section
        .split("\n")
        .map(line => line.trim())
        .filter(line => line !== '');
    return lines.join("\n");
}

// --- Core Application Functions ---
/**
 * Scrapes up to 3 editorial article links from Dawn.com per day in the specified date range.
 * @param {string} startDate - The beginning date (YYYY-MM-DD) for scraping.
 * @param {string} endDate - The end date (YYYY-MM-DD) for scraping.
 * @returns {Promise<string[]>} A promise that resolves to an array of article URLs.
 */
async function getEditorialLinksByDateRange(startDate, endDate) {
    const allLinks = [];
    const dates = getDateRange(startDate, endDate);

    for (const date of dates) {
        const formattedDate = formatDate(date);
        const url = `${SCRAPING_CONFIG.BASE_URL}${formattedDate}`;
        console.log(`Fetching editorial for ${formattedDate}...`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`⚠️ Failed to fetch ${url}: ${response.statusText}`);
                continue;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            let dailyCount = 0;

            $("article.story h2 a").each((_, element) => {
                if (dailyCount >= 3) return false; // stop after 3 valid URLs

                const href = $(element).attr("href");
                if (
                    href &&
                    /^https:\/\/www\.dawn\.com\/news\/\d+\/[a-z0-9-]+$/i.test(href)
                ) {
                    allLinks.push(href);
                    dailyCount++;
                }
            });

        } catch (error) {
            console.error(`❌ Error fetching ${url}:`, error);
        }
    }

    return allLinks;
}

// /**
//  * Scrapes editorial article links from Dawn.com for a specified date range.
//  * @param {string} startDate - The beginning date (YYYY-MM-DD) for scraping.
//  * @param {string} endDate - The end date (YYYY-MM-DD) for scraping.
//  * @returns {Promise<string[]>} A promise that resolves to an array of article URLs.
//  */
// async function getEditorialLinksByDateRange(startDate, endDate) {
//     const allLinks = [];
//     const dates = getDateRange(startDate, endDate);

//     for (const date of dates) {
//         const formattedDate = formatDate(date);
//         const url = `${SCRAPING_CONFIG.BASE_URL}${formattedDate}`;
//         console.log(`Fetching editorial for ${formattedDate}...`);

//         try {
//             const response = await fetch(url);
//             if (!response.ok) {
//                 console.warn(`⚠️ Failed to fetch ${url}: ${response.statusText}`);
//                 continue;
//             }
//             const html = await response.text();
//             const $ = cheerio.load(html);

//             $("article.story h2 a").each((_, element) => {
//                 const href = $(element).attr("href");
//                 // Ensures the URL matches the expected editorial article format
//                 if (
//                     href &&
//                     /^https:\/\/www\.dawn\.com\/news\/\d+\/[a-z0-9-]+$/i.test(href)
//                 ) {
//                     allLinks.push(href);
//                 }
//             });
//         } catch (error) {
//             console.error(`❌ Error fetching ${url}:`, error);
//         }
//     }
//     return allLinks;
// }

/**
 * Extracts the title and main textual content from a given article URL.
 * @param {string} url - The URL of the article to extract text from.
 * @returns {Promise<{title: string, content: string}|null>} A promise that resolves to an object
 * containing the article's title and content, or null if extraction fails.
 */
async function extractArticleText(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`⚠️ Failed to fetch article ${url}: ${response.statusText}`);
            return null;
        }
        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $("h2.story__title, h1.story__title").first().text().trim();
        let content = "";
        $(".story__content p").each((_, elem) => {
            content += $(elem).text() + "\n";
        });

        return { title, content };
    } catch (error) {
        console.error(`❌ Error extracting article ${url}:`, error);
        return null;
    }
}

/**
 * Uses Google Gemini AI to generate vocabulary words and phrases/idioms from an article's content.
 * @param {{title: string, content: string}} articleData - An object containing the article's title and content.
 * @param {GoogleGenerativeAI} genAI - An initialized GoogleGenerativeAI instance.
 * @returns {Promise<{title: string, words: string, phrases: string}|null>} A promise that resolves to an object
 * with the article title, extracted words, and phrases, or null if AI generation fails.
 */
async function generateFromArticle(articleData, genAI) {
    if (!articleData) return null;

    const { title, content } = articleData;

    const prompt = `
Read this article and provide two distinct lists based on its content, strictly following the format below:

1.  **Words:** List all good vocabulary words from the article, along with a concise meaning for each. Format each entry as "word: meaning", and place each complete entry on a new line. Do not use any bullet points, dashes, or other special formatting.
2.  **Phrases and Idioms:** List different phrases and idioms found in the article, along with a concise meaning for each. Format each entry as "phrase: meaning", and place each complete entry on a new line. Do not use any bullet points, dashes, or other special formatting.

Title: ${title}
Content: ${content}
`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`\n🔍 Gemini response for "${title}":\n${text}\n`);

        // Flexible parsing to extract sections
        const wordsSection = text.split(/##?\s*Phrases/i)[0]; // Content before "Phrases" heading
        const phrasesSection = text.split(/##?\s*Phrases/i)[1] || ""; // Content after "Phrases" heading

        const words = extractContentByLine(wordsSection);
        const phrases = extractContentByLine(phrasesSection);

        return { title, words, phrases };
    } catch (error) {
        console.error("❌ Error generating content with Gemini:", error);
        return null;
    }
}

/**
 * Generates a PDF document from an array of article data.
 * @param {Array<Object>} articlesData - An array of article objects, each containing title, words, and phrases.
 * @param {string} outputPDFPath - The file path where the generated PDF will be saved.
 * @param {string} startDate - The start date used in the PDF title.
 * @param {string} endDate - The end date used in the PDF title.
 */
function generatePDF(articlesData, outputPDFPath, startDate, endDate) {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(outputPDFPath));

    doc.font('Times-Roman'); // Set default font

    doc.fontSize(24).text("Dawn Editorial Vocabulary & Phrases", { align: "center" });
    doc.fontSize(12).text(`${startDate} to ${endDate}`, { align: "center" });
    doc.fontSize(10).fillColor('gray').text("created by csshelp.vercel.app", { align: "center" });
    doc.fillColor('black');
    doc.moveDown(2);

    articlesData.forEach((article, index) => {
        doc.fontSize(18).font('Times-Bold').text(`${index + 1}. ${article.title}`, { underline: true });
        doc.moveDown(0.5);
        doc.font('Times-Roman'); // Reset font for content

        // Words Section
        if (article.words) {
            doc.fontSize(14).font('Times-Bold').text("Words and phrases & Idioms:");
            doc.moveDown(0.2);
            doc.font('Times-Roman');
            const cleanedWords = article.words
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => line.replace(/^\s*\*\s*\d*\.\s*\*\*Words:\*\*|^[\s\*\-]+/, '').trim())
                .filter(line => line !== '');
            cleanedWords.forEach(wordEntry => {
                doc.fontSize(12).text(`  ${wordEntry}`); // Indented
            });
            doc.moveDown(0.5);
        }

        // Phrases Section
        if (article.phrases) {
            doc.fontSize(14).font('Times-Bold').text("Phrases and Idioms:");
            doc.moveDown(0.2);
            doc.font('Times-Roman');
            const cleanedPhrases = article.phrases
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => line.replace(/^\s*\*\s*\d*\.\s*\*\*Phrases and Idioms:\*\*|^[\s\*\-]+/, '').trim())
                .filter(line => line !== '');
            cleanedPhrases.forEach(phraseEntry => {
                doc.fontSize(12).text(`  ${phraseEntry}`); // Indented
            });
            doc.moveDown(1);
        }

        if (index < articlesData.length - 1) {
            doc.addPage(); // New page for subsequent articles
        }
    });

    doc.end();
    console.log(`\n🎉 PDF generated at ${outputPDFPath}`);
}

/**
 * Loads article data from a JSON file and then generates a PDF from it.
 * @param {string} jsonPath - The path to the JSON file containing the article data.
 * @param {string} outputPDFPath - The desired path for the output PDF file.
 * @param {string} startDate - The start date to be displayed on the PDF.
 * @param {string} endDate - The end date to be displayed on the PDF.
 */
function loadDataAndGeneratePDF(jsonPath, outputPDFPath, startDate, endDate) {
    try {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const articlesData = JSON.parse(raw);

        if (articlesData.length === 0) {
            console.log("❌ No article data found in JSON to generate PDF.");
            return;
        }

        generatePDF(articlesData, outputPDFPath, startDate, endDate);
    } catch (error) {
        console.error(`❌ Error loading data or generating PDF: ${error.message}`);
    }
}

/**
 * Sends a generated PDF document via email and logs the transaction to the database.
 * @param {string} pdfPath - The file path of the PDF to send.
 * @param {string} recipientEmail - The email address of the recipient.
 * @param {string} [senderName="Dawn News Bot"] - The display name for the sender.
 */
async function sendPdfByEmail(pdfPath, recipientEmail, senderName = "Dawn News Bot") {
    // Remove the MongoDB connection check since it's now handled at the start
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_CONFIG.USER,
            pass: EMAIL_CONFIG.APP_PASSWORD
        }
    });

    let mailOptions = {
        from: EMAIL_CONFIG.USER,
        to: recipientEmail,
        subject: 'Your Daily Dawn News Editorial Vocabulary & Phrases',
        text: 'Attached is your requested PDF document containing vocabulary and phrases from recent Dawn editorials.',
        attachments: [
            {
                filename: 'DawnEditorialVocabulary.pdf',
                path: pdfPath
            }
        ]
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('PDF sent successfully!');
        console.log('Message ID:', info.messageId);

        // Log the email to database
        await logSentEmail({
            recipientEmail,
            pdfFileName: 'DawnEditorialVocabulary.pdf',
            senderName,
            messageId: info.messageId
        });
    } catch (error) {
        console.error('❌ Error sending PDF or logging email:', error);
        throw error; // Rethrow the error to be handled by the caller
    }
}

/**
 * Main function to run the entire process: scrape, process, generate PDF, and optionally email.
 * @param {string} startDate - The start date for editorial scraping (YYYY-MM-DD).
 * @param {string} endDate - The end date for editorial scraping (YYYY-MM-DD).
 * @param {string} recipientEmail - The email address to send the PDF to.
 * @param {boolean} [closeDb=true] - Whether to close the DB connection after completion.
 */
// Modify the runAll function
async function runAll(startDate, endDate, recipientEmail, closeDb = true, isVercel = false) {
    try {
        console.log(`🚀 Starting process for ${startDate} to ${endDate}...`);
        
        // 1. Scrape and process articles with AI
        const articlesData = await mainScrapingAndAI(startDate, endDate);
        
        // 2. Generate PDF in memory when on Vercel
        let pdfBuffer;
        if (isVercel) {
            // Generate PDF in memory
            pdfBuffer = await generatePDFInMemory(articlesData, startDate, endDate);
        } else {
            // Generate PDF as file when running locally
            await loadDataAndGeneratePDF(FILE_PATHS.JSON_OUTPUT, FILE_PATHS.PDF_OUTPUT, startDate, endDate);
        }

        // 3. Send email
        if (recipientEmail) {
            if (isVercel) {
                // Send using buffer
                await sendPdfByEmailWithBuffer(pdfBuffer, recipientEmail);
            } else {
                // Send using file
                await sendPdfByEmail(FILE_PATHS.PDF_OUTPUT, recipientEmail);
            }
        }

        if (closeDb) {
            await closeMongo();
        }
    } catch (error) {
        console.error('Error in runAll:', error);
        throw error;
    }
}

// Add new function to generate PDF in memory
async function generatePDFInMemory(articlesData, startDate, endDate) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument();
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Your existing PDF generation logic here
        doc.font('Times-Bold').fontSize(24).text("Editorial Articles Vocabulary", {
            align: "center",
        });
        // ...rest of your PDF generation code...

        doc.end();
    });

}

// Add new function to send email with buffer
async function sendPdfByEmailWithBuffer(pdfBuffer, recipientEmail, senderName = "Dawn News Bot") {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_CONFIG.USER,
            pass: EMAIL_CONFIG.APP_PASSWORD
        }
    });

    let mailOptions = {
        from: EMAIL_CONFIG.USER,
        to: recipientEmail,
        subject: 'Your Daily Dawn News Editorial Vocabulary & Phrases',
        text: 'Attached is your requested PDF document containing vocabulary and phrases from recent Dawn editorials.',
        attachments: [
            {
                filename: 'DawnEditorialVocabulary.pdf',
                content: pdfBuffer
            }
        ]
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('PDF sent successfully!');
        console.log('Message ID:', info.messageId);

        await logSentEmail({
            recipientEmail,
            pdfFileName: 'DawnEditorialVocabulary.pdf',
            senderName,
            messageId: info.messageId
        });
    } catch (error) {
        console.error('❌ Error sending PDF:', error);
        throw error;
    }
}

// Export the functions
export { runAll };

/**
 * The core scraping and AI processing logic, separated to be called by runAll.
 * @param {string} startDate - The start date.
 * @param {string} endDate - The end date.
 */
async function mainScrapingAndAI(startDate, endDate) {
    const genAI = new GoogleGenerativeAI(API_KEYS.GEMINI);
    const links = await getEditorialLinksByDateRange(startDate, endDate);
    console.log(`\n📰 Total editorial links found: ${links.length}`);

    const articlesData = [];

    for (const [i, url] of links.entries()) {
        console.log(`\n[${i + 1}/${links.length}] Processing: ${url}`);
        const articleData = await extractArticleText(url);
        if (!articleData) continue;

        const genResult = await generateFromArticle(articleData, genAI);
        if (genResult) articlesData.push(genResult);
    }

    fs.writeFileSync(FILE_PATHS.JSON_OUTPUT, JSON.stringify(articlesData, null, 2), "utf-8");
    console.log(`\n📄 JSON saved at ${FILE_PATHS.JSON_OUTPUT}`);
}

// --- Execution ---
// Define your dates and recipient email here
// const RECIPIENT_EMAIL = 'demo.abdullah.dev@gmail.com'; // Change this to your desired recipient

// Run the full process
// runAll(DEFAULT_DATES.START_DATE, DEFAULT_DATES.END_DATE, RECIPIENT_EMAIL).catch(console.error);

// Add this line at the end of app.js
export { runAll };