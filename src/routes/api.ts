import express, { Request, Response, Router, RequestHandler } from 'express';
import { AIRequest, AIResponse, GoogleResult } from '../types';

const router: Router = express.Router();

const searchHandler: RequestHandler = async (req: Request, res: Response) => {
  console.log('Received request:', req.body);

  const body: Partial<AIRequest> = req.body || {};
  const { platform, query }: AIRequest = {
    platform: body.platform || '',
    query: body.query || '',
  };

  if (!platform || !query) {
    res.status(400).json({ message: 'Platform and query are required' });
    return;
  }

  if (platform.toLowerCase() === 'google') {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cseId) {
      res.status(500).json({ message: 'Google API keys missing' });
      return;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error(`Google API request failed with status ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      const results: GoogleResult[] = data.items?.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
      })) || [];
      res.json({ results });
    } catch (error) {
      console.error('Error fetching Google results:', error);
      res.status(500).json({ message: 'Google search failed' });
    }
    return;
  }

  const apiKeys: { [key: string]: string } = {
    chatgpt: process.env.CHATGPT_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    mistral: process.env.MISTRAL_API_KEY || '',
  };

  const apiKey = apiKeys[platform.toLowerCase()];
  if (!apiKey) {
    res.status(500).json({ message: 'API key missing' });
    return;
  }

  const apiConfigs: { [key: string]: { url: string; body: any; useBearer?: boolean } } = {
    chatgpt: {
      url: 'https://api.mistral.ai/v1/chat/completions',
      body: { model: 'mistral-large-latest', messages: [{ role: 'user', content: query }] },
      useBearer: true,
    },
    deepseek: {
      url: 'https://openrouter.ai/api/v1/chat/completions', // OpenRouter endpoint
      body: {
        model: 'deepseek-chat', // Correct model name for DeepSeek via OpenRouter
        messages: [{ role: 'user', content: query }],
      },
      useBearer: true,
    },
    gemini: {
      url: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent',
      body: { contents: [{ parts: [{ text: query }] }] },
      useBearer: false,
    },
    mistral: {
      url: 'https://api.mistral.ai/v1/chat/completions',
      body: { model: 'mistral-large-latest', messages: [{ role: 'user', content: query }] },
      useBearer: true,
    },
  };

  const config = apiConfigs[platform.toLowerCase()];
  if (!config) {
    res.status(400).json({ message: 'Invalid platform' });
    return;
  }

  try {
    const url = config.useBearer ? config.url : `${config.url}?key=${apiKey}`;

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config.body),
    };

    if (config.useBearer) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${apiKey}`,
      };
    }

    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('API response:', data);

    const message = platform.toLowerCase() === 'gemini'
      ? data.candidates?.[0]?.content?.parts?.[0]?.text
      : data.choices?.[0]?.message?.content || 'No response';

    if (!message) throw new Error('No valid response from API');

    res.json({ message });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error fetching data from ${platform}:`, error);
      res.status(500).json({ message: `API request failed for ${platform}: ${error.message}` });
    } else {
      console.error(`Unexpected error from ${platform}:`, error);
      res.status(500).json({ message: `High Demand. Try usinga different platform :` });
    }
  }
};

router.post('/search', searchHandler);
export default router;
