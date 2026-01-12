import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SHEET_ID = '1kbOoBSrI1yHj0yEtexhFA6H_QuJL2IkzXFh9uaCSKsQ';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Initialize Gemini API
// Note: verify the key is loaded in the POST handler to ensure environment is ready
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { query } = body;

        console.log(`[AI-SEARCH] Received request. Query: "${query?.substring(0, 50)}..."`);

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error('[AI-SEARCH] ERROR: GEMINI_API_KEY is missing in process.env');
            return NextResponse.json({ error: 'API Key missing on server' }, { status: 503 });
        }

        // 1. Fetch Data
        console.log('[AI-SEARCH] Fetching Google Sheet data...');
        const response = await fetch(CSV_URL, { cache: 'no-store' });
        if (!response.ok) {
            console.error(`[AI-SEARCH] Failed to fetch CSV. Status: ${response.status}`);
            throw new Error('Failed to fetch data source');
        }
        const csvText = await response.text();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

        const data = parsed.data.map((row: any, index: number) => ({
            id: index, // Use index as ID for simplicity
            category: row['대분류'] || '기타',
            problem: row['문제점'] || '',
            solution1: row['솔루션 (버전1)'] || row['솔루션'] || '',
            solution2: row['솔루션 (버전2)'] || '',
        })).filter((item: any) => item.problem && (item.solution1 || item.solution2));

        console.log(`[AI-SEARCH] Loaded ${data.length} feedback items.`);

        // 2. Prepare Prompt for Gemini
        // We will send the list of problems and ask for the top 5 most relevant ones.
        // To save tokens, we only send IDs and Problems.
        const problemsList = data.map((item: any) => `ID: ${item.id}, Problem: ${item.problem}`).join('\n');

        const prompt = `
        You are a helpful assistant for a feedback encyclopedia.
        The user has provided a problem description or a draft text: "${query}"
        
        Here is a list of known problem categories and descriptions:
        ${problemsList}

        Task: Identify the top 5 most relevant problems from the list that match the user's input.
        If the input is a draft text, find the problems that this text likely suffers from.
        Return ONLY a JSON array of the top 5 relevant IDs, sorted by relevance.
        Example output: [12, 4, 0, 15, 8]
        DO NOT include any explanation, markdown formatting, or code blocks. Just the JSON array.
        `;

        console.log("[AI-SEARCH] Sending prompt to Gemini...");

        // Use gemini-2.0-flash as confirmed by curl list
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        console.log("[AI-SEARCH] Raw Gemini Response:", responseText);

        // 3. Parse Gemini Response
        let sortedIds: number[] = [];
        try {
            // Clean up code blocks if generic model wraps it
            let cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            // Sometimes it adds "json" at the start without backticks
            if (cleanedText.startsWith('json')) cleanedText = cleanedText.slice(4).trim();

            sortedIds = JSON.parse(cleanedText);
            console.log(`[AI-SEARCH] Parsed IDs: ${JSON.stringify(sortedIds)}`);
        } catch (e) {
            console.error("[AI-SEARCH] JSON Parse Error. Raw text was:", responseText);
            // Verify if response was blocked
            if (result.response.promptFeedback) {
                console.error("[AI-SEARCH] Prompt Feedback:", result.response.promptFeedback);
            }
            throw new Error("Failed to parse AI response");
        }

        // 4. Return sorted data
        const sortedData = sortedIds
            .map(id => data.find((item: any) => item.id === id))
            .filter(Boolean);

        return NextResponse.json(sortedData);

    } catch (error: any) {
        console.error('[AI-SEARCH] Critical Error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message
        }, { status: 500 });
    }
}
