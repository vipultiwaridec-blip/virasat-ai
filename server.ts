import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));
app.use('/images', express.static(path.resolve('public/images'), { maxAge: '1d' }));
app.use(express.static(path.resolve('public'), { maxAge: '1d' }));

// Initialize GoogleGenAI client if API key is present
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

let ai: GoogleGenAI | null = null;
if (hasGeminiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

// Status endpoint
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    hasGeminiKey: Boolean(ai),
    serverTime: new Date().toISOString(),
    primaryDestination: 'Udaipur & Rajasthan Heritage Circuit',
    version: '1.0.0-hackathon',
  });
});

// Chat endpoint with Gemini 3.8 Flash
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const { message, history = [], language = 'English', tripContext } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // System instruction for VIRASAT Heritage Companion
  const systemInstruction = `You are "VIRASAT Heritage Companion", the official AI heritage scholar, cultural guide, and sustainable travel architect for Rajasthan, India (with deep expertise in Udaipur, Mewar history, Jaipur, Jodhpur, and Jaisalmer).
Role & Personality:
- Warm, respectful, deeply knowledgeable in Rajasthani Rajput history, Mewari resistance, architecture (Indo-Saracenic, Haveli Jharokhas, Chatris, Baoris/stepwells), miniature paintings, and local crafts.
- Greet visitors warmly (use authentic Rajasthani phrasing like "खम्मा घणी" / "Khammaghani - Welcome to Rajasthan" when appropriate).
- Always promote sustainable travel: encourage walking heritage walks, electric boats on Lake Pichola, hiring local verified artisans, visiting less-crowded gems (Bagore Ki Haveli, Ahar Cenotaphs, Sajjangarh) during peak rush.
- Format responses clearly with readable paragraphs, bullet points when listing tips or stops.
- Distinguish verified history from popular folk legends.
- Respond in the user's requested language (${language || 'English'}). If the query is in Hindi, respond fluently and gracefully in Hindi.
${tripContext ? `Current Trip Context from Platform:\n${JSON.stringify(tripContext, null, 2)}` : ''}`;

  if (ai) {
    try {
      // Build conversation contents
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Add recent history if provided
      if (Array.isArray(history)) {
        for (const item of history.slice(-6)) {
          if (item.sender === 'user') {
            contents.push({ role: 'user', parts: [{ text: item.text }] });
          } else if (item.sender === 'bot') {
            contents.push({ role: 'model', parts: [{ text: item.text }] });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const text = response.text || 'Khammaghani. Welcome to Rajasthan. How may I assist your heritage journey today?';
      res.json({ text, isSimulated: false, model: 'gemini-3.8-flash' });
      return;
    } catch (error: any) {
      console.warn('Gemini API call failed, falling back to curated intelligence:', error?.message);
    }
  }

  // Intelligent Curated Fallback if API key is not configured or rate limited
  const lowerMsg = message.toLowerCase();
  let fallbackReply = '';

  if (language === 'Hindi' || /[\u0900-\u097F]/.test(message) || lowerMsg.includes('hindi') || lowerMsg.includes('नमस्ते')) {
    if (lowerMsg.includes('city palace') || lowerMsg.includes('उदयपुर') || lowerMsg.includes('महल')) {
      fallbackReply = `खम्मा घणी! उदयपुर का **सिटी पैलेस** राजस्थान के सबसे भव्य महलों में से एक है।\n\n- **इतिहास:** इसका निर्माण 1559 ईस्वी में महाराणा उदय सिंह द्वितीय द्वारा पिछोला झील के किनारे शुरू कराया गया था।\n- **वास्तुकला:** यह राजस्थानी और मुग़ल शैलियों का अनुपम संगम है। यहाँ का 'मोर चौक' और 'शीश महल' कांच की बारीक नक्काशी के लिए विख्यात हैं।\n- **सतत पर्यटन सलाह (Green Travel):** सुबह 9:00 बजे से 11:00 बजे के बीच जाएँ जब भीड़ न्यूनतम होती है। पुराने शहर में पैदल चलें या इलेक्ट्रिक ऑटोरिक्शा का उपयोग करें!`;
    } else if (lowerMsg.includes('भीड़') || lowerMsg.includes('crowd') || lowerMsg.includes('रूट') || lowerMsg.includes('itinerary')) {
      fallbackReply = `खम्मा घणी! यदि सिटी पैलेस या जगदीश मंदिर में अधिक भीड़ हो, तो विरासात आपको **बागोर की हवेली** या **आहाड़ की छतरियाँ** देखने की सलाह देता है।\n\nयहाँ आप शांति से 400 साल पुरानी वास्तुकला और सांयकालीन 'धरोहर' लोकनृत्य का आनंद ले सकते हैं। इससे आपका ग्रीन ट्रैवल स्कोर भी 92% तक बना रहेगा!`;
    } else {
      fallbackReply = `खम्मा घणी सा! विरासात हेरिटेज कंपैनियन में आपका स्वागत है। आप उदयपुर, जयपुर के महलों, हवेलियों, पारंपरिक पिछवाई कलाकारी या टिकाऊ यात्रा विकल्पों के बारे में मुझसे कोई भी प्रश्न पूछ सकते हैं।`;
    }
  } else {
    if (lowerMsg.includes('city palace') || lowerMsg.includes('pichola') || lowerMsg.includes('udaipur')) {
      fallbackReply = `**Khammaghani! Welcome to Udaipur's Royal Legacy.**\n\n- **Historical Roots:** The City Palace was founded in 1559 by Maharana Udai Singh II on the banks of Lake Pichola. Built in granite and marble over 400 years by successive Mewar Maharanas, it features 11 majestic palaces within the complex.\n- **Architectural Highlight:** Look for the *Mor Chowk* (Peacock Courtyard) adorned with over 5,000 glass mosaic tiles depicting three peacocks symbolizing summer, monsoon, and winter.\n- **Sustainability & Crowd Tip:** During midday peak hours (12 PM - 3 PM), footfall exceeds 800 visitors/hr. We recommend visiting between 9:00 AM - 10:30 AM, followed by a walk across the historic Daiji Bridge to support local silver and miniature art artisans in Jagdish Chowk.`;
    } else if (lowerMsg.includes('crowd') || lowerMsg.includes('alternative') || lowerMsg.includes('busy')) {
      fallbackReply = `**VIRASAT Crowd Intelligence Recommendation:**\n\nWhen flagship monuments like City Palace or Amber Fort experience high visitor density:\n1. **Alternative Gem:** Switch to *Bagore Ki Haveli* (just 500m walking distance) or the contemplative *Ahar Cenotaphs*.\n2. **Cultural Experience:** Visit an authentic Mewar Miniature Painting workshop in Lal Ghat where master artisans preserve 500-year-old natural stone pigment techniques.\n3. **Benefit:** Reduces your queue wait by ~65 minutes and improves your Green Travel Score through zero-emission pedestrian navigation!`;
    } else if (lowerMsg.includes('green') || lowerMsg.includes('sustainable') || lowerMsg.includes('score')) {
      fallbackReply = `**The VIRASAT Green Travel Score Explained:**\n\nOur platform calculates sustainability using 4 transparent pillars:\n- **Low-Emission Mobility (40 pts):** Prioritizing pedestrian heritage circuits and electric e-rickshaws through Udaipur's historic pols (gates).\n- **Decentralized Tourism (25 pts):** Redistributing tourist footfall away from congested corridors toward heritage conservation zones.\n- **Local Artisan Patronage (20 pts):** Direct engagement with verified local handicraft and block-printing guilds.\n- **Responsible Hospitality (15 pts):** Staying in solar-powered heritage havelis and eco-certified stays.`;
    } else {
      fallbackReply = `**Khammaghani! Welcome to VIRASAT Heritage Companion.**\n\nI am your dedicated digital historian for Rajasthan. I can help you with:\n- Architectural analysis of Mewar and Rajput fortifications\n- Optimizing your daily route around current crowd levels\n- Connecting with authentic local crafts (Pichwai art, Blue Pottery, Hand block printing)\n- Eco-conscious transport modes across Udaipur, Jaipur, and Jodhpur.\n\n*What aspect of your Rajasthan journey would you like to explore?*`;
    }
  }

  res.json({
    text: fallbackReply,
    isSimulated: true,
    note: 'Curated heritage intelligence active. Connect a valid GEMINI_API_KEY in environment variables for live Gemini 3.8 Flash generation.',
  });
});

// Vision analysis endpoint
app.post('/api/gemini/vision', async (req: Request, res: Response) => {
  const { imageBase64, mimeType = 'image/jpeg', prompt, monumentHint, language = 'English' } = req.body;

  if (!imageBase64) {
    res.status(400).json({ error: 'Image data is required' });
    return;
  }

  const analysisPrompt = `You are the VIRASAT Architectural & Heritage Vision Identifier for Rajasthan, India.
Analyze this photo of a monument, architectural element, cultural craft, or historic artifact in Rajasthan.
Provide your response in structured JSON with the following exact keys:
{
  "monumentName": "Name of monument / artifact",
  "location": "City, Rajasthan (e.g. Udaipur, Jaipur)",
  "dynastyPeriod": "Dynasty / Century / Patron (e.g., Sisodia Rajputs, 16th Century)",
  "architecturalStyle": "Architectural features (e.g. Mewar Rajput, Jharokhas, Marble inlay)",
  "culturalStory": "Compelling 2-3 sentence historical background and lore",
  "sustainableVisitorTip": "1-2 practical tips on best time to visit and eco-friendly nearby exploration",
  "confidenceScore": 0.95,
  "tags": ["Architecture", "Mewar", "Heritage"]
}
If uncertain, express calibrated uncertainty in the text while providing the closest matching heritage style. Respond in ${language}.`;

  if (ai) {
    try {
      // Clean base64 string
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt || analysisPrompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({ analysis: parsed, isSimulated: false, model: 'gemini-3.8-flash' });
      return;
    } catch (err: any) {
      console.warn('Gemini vision API error, falling back to curated visual identification:', err?.message);
    }
  }

  // Curated heritage identification fallback
  let fallbackData = {
    monumentName: 'City Palace Complex & Badi Mahal',
    location: 'Udaipur, Rajasthan',
    dynastyPeriod: 'Mewar Sisodia Dynasty (1559–18th Century)',
    architecturalStyle: 'Mewar Rajput style with Mughal influences, marble cupolas, ornate jharokhas, and mirrored glass mosaic',
    culturalStory: 'Founded by Maharana Udai Singh II on the eastern shore of Lake Pichola, the City Palace is the largest palace complex in Rajasthan. The palace stands as a symbol of Mewar resilience, having resisted multiple imperial sieges through elevated fortresses and tactical lake fortifications.',
    sustainableVisitorTip: 'Visit before 10:00 AM to avoid high midday queues. Walk across the Gangaur Ghat promenade on foot rather than hailing motorized transport through the narrow heritage pols.',
    confidenceScore: 0.94,
    tags: ['Architecture', 'Lakes', 'Mewar Royalty', 'UNESCO Heritage Tentative List'],
  };

  if (monumentHint === 'hawa-mahal' || (prompt && prompt.toLowerCase().includes('hawa mahal'))) {
    fallbackData = {
      monumentName: 'Hawa Mahal (Palace of Winds)',
      location: 'Jaipur, Rajasthan',
      dynastyPeriod: 'Kachwaha Rajputs (1799, Maharaja Sawai Pratap Singh)',
      architecturalStyle: 'Red and pink sandstone facade designed in the crown form of Lord Krishna with 953 honeycomb jharokhas (latticed windows)',
      culturalStory: 'Constructed to allow royal ladies of the court to observe bustling street festivities in Badi Chaupar without being observed from outside, utilizing natural venturi airflow that naturally cools the interior chambers.',
      sustainableVisitorTip: 'View the facade in morning golden hour sunlight. Combine your visit with a walking walk to nearby Johari Bazaar textile artisans.',
      confidenceScore: 0.98,
      tags: ['Architecture', 'Pink City', 'Sandstone', 'Wind Engineering'],
    };
  } else if (monumentHint === 'jagdish-temple' || (prompt && prompt.toLowerCase().includes('jagdish'))) {
    fallbackData = {
      monumentName: 'Shree Jagdish Temple',
      location: 'Udaipur, Rajasthan',
      dynastyPeriod: 'Maharana Jagat Singh I (1651 CE)',
      architecturalStyle: 'Indo-Aryan Nagara architecture with a 79-foot high decorated Shikhara and hand-carved friezes of celestial dancers and elephants',
      culturalStory: 'Dedicated to Lord Vishnu (Jagannath), this continuous living temple sits on a 32-step plinth in the heart of Udaipur. It survived multiple invasions and continues to feature traditional temple bell ceremonies twice daily.',
      sustainableVisitorTip: 'Preserve temple decorum by keeping silence during morning aarti. Support the local flower growers along the temple steps.',
      confidenceScore: 0.96,
      tags: ['Temple', 'Nagara Style', 'Carvings', 'Living Heritage'],
    };
  } else if (monumentHint === 'miniature-painting' || (prompt && prompt.toLowerCase().includes('painting'))) {
    fallbackData = {
      monumentName: 'Mewar Miniature Painting & Pichwai Art',
      location: 'Udaipur Craft Guilds',
      dynastyPeriod: 'Traditional Artisanal Heritage (17th Century to Present)',
      architecturalStyle: 'Fine squirrel-hair brushwork on antique paper or silk, utilizing ground semi-precious stone pigments and 24K gold leaf',
      culturalStory: 'Pichwai paintings originated in Nathdwara and Udaipur to depict Shrinathji and natural elements of Rajasthan. Master craftsmen spend weeks layering minerals like lapis lazuli and malachite.',
      sustainableVisitorTip: 'Always purchase directly from verified artisan co-operatives in Old Udaipur to ensure master artists receive 100% fair trade value.',
      confidenceScore: 0.92,
      tags: ['Pichwai Art', 'Artisan Guild', 'Natural Pigments', 'Living Heritage'],
    };
  } else if (monumentHint === 'mehrangarh-fort-jodhpur' || (prompt && (prompt.toLowerCase().includes('mehrangarh') || prompt.toLowerCase().includes('jodhpur')))) {
    fallbackData = {
      monumentName: 'Mehrangarh Fort & Ramparts',
      location: 'Jodhpur, Rajasthan',
      dynastyPeriod: 'Rathore Clan of Marwar (Founded 1459 by Rao Jodha)',
      architecturalStyle: 'Massive cliffside Rajput fortification with burnished red sandstone battlements, Sheesh Mahal, and intricate Jharokha stone filigree',
      culturalStory: 'Towering 400 feet above the Sun City, Mehrangarh successfully withstood numerous imperial sieges. Cannon ball marks from battles with Jaipur forces remain visible at Dedh Kamgra Pol.',
      sustainableVisitorTip: 'Explore the adjacent Rao Jodha Desert Rock Park, a pioneering ecological project that rehabilitated native Thar Desert scrub vegetation.',
      confidenceScore: 0.97,
      tags: ['Architecture', 'Marwar Rathores', 'Citadel', 'Desert Ecology'],
    };
  } else if (monumentHint === 'toorji-ka-jhalra-jodhpur' || (prompt && prompt.toLowerCase().includes('toorji'))) {
    fallbackData = {
      monumentName: 'Toorji Ka Jhalra Stepwell',
      location: 'Jodhpur, Rajasthan',
      dynastyPeriod: '1740s CE by Maharani Toorji',
      architecturalStyle: 'Subterranean stepwell with interlocking red sandstone staircases, carved dancing elephants, and historic lions',
      culturalStory: 'Commissioned by the queen consort of Jodhpur, this stepwell is a triumph of traditional desert hydrology and community water governance.',
      sustainableVisitorTip: 'Support the pedestrian revitalization around Toorji Ka Jhalra by exploring local cafes and artisan shops on foot.',
      confidenceScore: 0.95,
      tags: ['Water Architecture', 'Stepwells', 'Stepwell Heritage', 'Jodhpur Old City'],
    };
  } else if (monumentHint === 'jaswant-thada-jodhpur' || (prompt && prompt.toLowerCase().includes('jaswant'))) {
    fallbackData = {
      monumentName: 'Jaswant Thada (Taj Mahal of Marwar)',
      location: 'Jodhpur, Rajasthan',
      dynastyPeriod: 'Maharaja Sardar Singh (1899 CE)',
      architecturalStyle: 'Translucent Makrana marble cenotaph with carved jaalis, polished marble domes, and tier gardens overlooking Devkund lake',
      culturalStory: 'Constructed in memory of Maharaja Jaswant Singh II, this white marble memorial radiates a warm golden glow when struck by desert sunbeams.',
      sustainableVisitorTip: 'Combine with a contemplative morning birdwatching walk along Devkund lake sanctuary.',
      confidenceScore: 0.96,
      tags: ['Marble Cenotaph', 'Marwar History', 'Low Crowd Sanctuary', 'Architecture'],
    };
  } else if (monumentHint === 'amber-fort' || (prompt && prompt.toLowerCase().includes('amber'))) {
    fallbackData = {
      monumentName: 'Amber (Amer) Fort & Sheesh Mahal',
      location: 'Jaipur, Rajasthan',
      dynastyPeriod: 'Raja Man Singh I (1592 CE), Kachwaha Dynasty',
      architecturalStyle: 'UNESCO World Heritage Rajput hill fortress blending red sandstone and white marble with mirror-mosaic Sheesh Mahal and Sukh Niwas cooling channels',
      culturalStory: 'Overlooking Maota Lake, Amber Fort served as the fortified citadel of the Kachwaha clan prior to the founding of Jaipur. Its mirror palace (Sheesh Mahal) was designed so a single candle would illuminate the entire ceiling.',
      sustainableVisitorTip: 'Ascend the cobbled ramp on foot rather than using animal transport, supporting ethical tourism practices.',
      confidenceScore: 0.98,
      tags: ['UNESCO Heritage', 'Hill Forts', 'Sheesh Mahal', 'Rajput Architecture'],
    };
  } else if (monumentHint === 'jaisalmer-fort' || (prompt && (prompt.toLowerCase().includes('jaisalmer') || prompt.toLowerCase().includes('sonar qila')))) {
    fallbackData = {
      monumentName: 'Jaisalmer Fort (Sonar Qila)',
      location: 'Jaisalmer, Thar Desert, Rajasthan',
      dynastyPeriod: 'Rawal Jaisal (1156 CE), Bhati Rajput Dynasty',
      architecturalStyle: 'Golden yellow sandstone hill fortress with 99 curved bastions, delicate jali stone screens, and intricately carved royal and Jain temples',
      culturalStory: 'One of the world’s rare living forts, Sonar Qila rises like a golden mirage from the sandy plains of the Thar. A UNESCO World Heritage Site with vibrant artisan families residing within.',
      sustainableVisitorTip: 'Explore fort alleys strictly on foot to prevent foundation erosion on the medieval clay and sandstone mound.',
      confidenceScore: 0.98,
      tags: ['Living Fort', 'UNESCO World Heritage', 'Golden Sandstone', 'Thar Desert'],
    };
  }

  res.json({
    analysis: fallbackData,
    isSimulated: true,
    note: 'Visual heritage recognition provided by VIRASAT Curated Repository. Live multimodal inference will activate automatically when a Gemini API key is configured.',
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIRASAT server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
