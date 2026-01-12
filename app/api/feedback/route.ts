import { NextResponse } from 'next/server';
import Papa from 'papaparse';

const SHEET_ID = '1kbOoBSrI1yHj0yEtexhFA6H_QuJL2IkzXFh9uaCSKsQ';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

export async function GET() {
    try {
        const response = await fetch(CSV_URL, { cache: 'no-store' }); // Ensure fresh data
        const csvText = await response.text();

        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
        });

        // Map the CSV columns to our internal structure
        // Expected CSV Headers: 대분류, 문제점, 솔루션 (버전1), 솔루션 (버전2)
        const data = parsed.data.map((row: any) => ({
            category: row['대분류'] || '기타',
            problem: row['문제점'] || '',
            solution1: row['솔루션 (버전1)'] || row['솔루션'] || '',
            solution2: row['솔루션 (버전2)'] || '',
        })).filter((item: any) => item.problem && (item.solution1 || item.solution2)); // Filter out empty rows

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching Google Sheet:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
