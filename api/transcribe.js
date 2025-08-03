import { Readable } from 'stream';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const file = await openai.files.create({
      file: Readable.from(buffer),
      purpose: 'transcription',
    });

    const transcript = await openai.audio.transcriptions.create({
      file: file.id,
      model: 'whisper-1',
      response_format: 'text',
    });

    const summary = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Summarize this transcription clearly and concisely.' },
        { role: 'user', content: transcript },
      ],
    });

    res.status(200).json({ summary: summary.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
