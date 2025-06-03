  // To run this script, install the SDK and other packages:
  // npm install @google/generative-ai node-fetch cheerio

  import { GoogleGenerativeAI } from "@google/generative-ai";
  import fetch from "node-fetch";
  import * as cheerio from "cheerio";

  // STEP 1: Extract article from webpage
  async function extractArticleText(url) {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("h2.story__title, h1.story__title").first().text().trim();

    let content = "";
    $(".story__content p").each((_, elem) => {
      content += $(elem).text() + "\n";
    });

    return { title, content };
  }

  // STEP 2: Generate vocabulary words using Gemini
  async function generateFromArticle(url) {
    const { title, content } = await extractArticleText(url);

    const article = `
  Read this article and give me good vocabulary words from it and also different phrases and idioms:
  Title: ${title}
  Content: ${content}
    `;

    const genAI = new GoogleGenerativeAI("AIzaSyC-sPLWeLU4e75phL02qdQicT201V1TxzY"); // Replace with your own or use env var

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(article);
    const response = await result.response;
    const text = response.text();

    console.log("🔤 Vocabulary Output:\n");
    console.log(text);
  }

  // STEP 3: Provide article URL
  // const url = "https://www.dawn.com/news/1914643/crypto-fever";
  const url = "https://www.dawn.com/news/1914007/going-cashless";
  generateFromArticle(url).catch(console.error);
