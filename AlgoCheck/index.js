const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(cors({ origin: 'https://algochecker.onrender.com' }));
app.use(bodyParser.json());

mongoose.connect('mongodb+srv://abcd123456:Gourab98@interlink.8ugkc.mongodb.net/?retryWrites=true&w=majority&appName=Interlink', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const companySchema = new mongoose.Schema({
  companyName: String,
  questions: [String]
});

const Company = mongoose.model('Company', companySchema);

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_API_KEY = 'AIzaSyBvDe-DPQ_jTfx7IpP9X3XR2v0LlBE0SCg';

// POST /analyze - Analyze code
app.post('/analyze', async (req, res) => {
  const { questionNumber, code } = req.body;

  if (!questionNumber || isNaN(questionNumber)) {
    return res.status(400).json({ error: 'Invalid question number' });
  }
  if (!code || code.trim() === '') {
    return res.status(400).json({ error: 'Code cannot be empty' });
  }

  try {
    const prompt = `You are an expert coding assistant. Check if the code below solves LeetCode Question ${questionNumber}. If not, say: "This code does NOT solve LeetCode Question ${questionNumber}." Also return:
- Time Complexity (O(...))
- Space Complexity (O(...))
- Tags
- Whether all edge cases are covered (Yes/No)
- Code Quality Score as a percentage (0-100%).

Code:
${code}`;

    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 1,
        topP: 1
      }
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return res.status(500).json({ error: 'No response from Gemini API.' });
    }

    if (/does not solve/i.test(text)) {
      return res.status(400).json({ error: `Code does not solve LeetCode Question ${questionNumber}.`, full: text });
    }

    const edgeCaseMatch = /edge cases.*?(yes|no)/i.exec(text);
    const coversAllEdges = edgeCaseMatch ? edgeCaseMatch[1].toLowerCase() === 'yes' : false;

    const qualityMatch = /code quality score.*?(\d{1,3})%/i.exec(text);
    const qualityScore = qualityMatch ? parseInt(qualityMatch[1]) : null;

    res.json({ result: text, coversAllEdges, qualityScore });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Error analyzing code' });
  }
});

// POST /company - Store company info for question
app.post('/company', async (req, res) => {
  const { questionNumber } = req.body;

  if (!questionNumber || isNaN(questionNumber)) {
    return res.status(400).json({ error: 'Invalid question number' });
  }

  try {
    const prompt = `From this list: [Amazon, Google, Microsoft, Facebook, Netflix, Apple, Adobe, Uber, LinkedIn, Flipkart], which company frequently asks LeetCode question number ${questionNumber}? Respond with only the company name.`;

    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 1,
        topP: 1
      }
    });

    let companyName = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!companyName) {
      return res.status(400).json({ error: 'Unable to determine a valid company name.' });
    }

    companyName = companyName.replace(/[^a-zA-Z ]/g, '').split(/\s+/)[0];

    if (companyName.length < 2) {
      return res.status(400).json({ error: 'Invalid extracted company name.' });
    }

    let company = await Company.findOne({ companyName: new RegExp(`^${companyName}$`, 'i') });

    if (company) {
      if (!company.questions.includes(questionNumber)) {
        company.questions.push(questionNumber);
        await company.save();
      }
    } else {
      company = new Company({ companyName, questions: [questionNumber] });
      await company.save();
    }

    res.json({ company: company.companyName, questions: company.questions });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Error determining company' });
  }
});

app.listen(PORT, () => {
  console.log(`AlgoCheck backend running on http://localhost:${PORT}`);
});
