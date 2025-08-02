import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { OpenAI } from 'openai';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = '/tmp';
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'File parsing error' });
    }

    const file = files.audio;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(file.filepath),
        model: 'whisper-1',
      });

      const summaryPrompt = `Summarize this voice note clearly and concisely:\n\n"${transcription.text}"`;

      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: summaryPrompt }],
      });

      return res.status(200).json({
        transcription: transcription.text,
        summary: summaryResponse.choices[0].message.content,
      });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Processing failed' });
    }
  });
}
