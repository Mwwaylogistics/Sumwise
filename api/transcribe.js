export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OpenAI API Key');
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Upload to OpenAI Whisper (transcription)
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: (() => {
        const form = new FormData();
        form.append('file', new Blob([audioBuffer]), 'audio.webm');
        form.append('model', 'whisper-1');
        return form;
      })(),
    });

    const whisperData = await whisperRes.json();
    if (!whisperData.text) {
      throw new Error('Transcription failed');
    }

    // Send transcription to GPT-4 for summarization
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Summarize the following in clear bullet points:' },
          { role: 'user', content: whisperData.text },
        ],
      }),
    });

    const gptData = await gptRes.json();
    const summary = gptData.choices?.[0]?.message?.content || 'No summary generated.';

    res.status(200).json({ summary });
  } catch (error) {
    console.error('Error in API route:', error);
    res.status(500).json({ error: error.message });
  }
}
