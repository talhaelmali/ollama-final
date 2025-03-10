import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import multer from 'multer';
import fs from 'fs';
import pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3001;
const apiUrl = process.env.OLLAMA_API_URL || 'http://ollama-service:11434';

// Configuration
const config = {
  model: 'llama3.1:8b',
  temperature: 0.7,
  num_ctx: 20480,
  uploadDir: '/uploads'
};

// Store PDF content in memory
let storedPDFContent = null;

// Configure middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: config.uploadDir });

// PDF text extraction function
const extractTextFromPDF = async (filePath) => {
  const pdfBuffer = fs.readFileSync(filePath);
  const pdfData = new Uint8Array(pdfBuffer); // Buffer -> Uint8Array dönüştürme

  const pdfDoc = await pdfjs.getDocument({ data: pdfData }).promise;

  let extractedText = "";
  for (let i = 0; i < pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i + 1);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    extractedText += pageText + "\n";
  }

  return extractedText;
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Express server is working!',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/uploadTest', (req, res) => {
  res.json({
    status: 'success',
    message: 'Upload server is working!',
    timestamp: new Date().toISOString()
  });
});

// Test POST endpoint for uploads - simple version
app.post('/api/uploadTest', async (req, res) => {
  try {
    // Log received data
    console.log("POST test data received:", req.body);
    
    // Return success response with received data
    res.json({
      status: 'success',
      message: 'POST test successful!',
      receivedData: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('POST test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'POST test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Presigned URL endpoint for direct uploads
app.post("/api/upload/presigned", async (req, res) => {
  try {
    console.log("Presigned URL isteği alındı:", req.body);
    const { fileName, fileType, fileSize } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ error: "fileName zorunludur" });
    }
    
    // Benzersiz bir dosya adı oluştur
    const uniqueFilename = `${Date.now()}-${fileName}`;
    const filePath = `${config.uploadDir}${uniqueFilename}`;
    
    // Gerçek bir presigned URL yerine, dosyayı doğrudan sunucuya yüklemek için sahte bir URL döndür
    // Gerçek bir S3 entegrasyonunda burada AWS SDK kullanılacaktır
    const mockPresignedUrl = {
      url: `${req.protocol}://${req.get('host')}/api/upload/direct`,
      key: uniqueFilename,
      fields: {
        key: uniqueFilename,
        fileName
      }
    };
    
    console.log("Presigned URL oluşturuldu:", mockPresignedUrl);
    res.json(mockPresignedUrl);
  } catch (error) {
    console.error("Presigned URL hatası:", error);
    res.status(500).json({ error: error.message });
  }
});

// Direct file upload endpoint (simulates S3 direct upload)
app.post("/api/upload/direct", upload.single("file"), async (req, res) => {
  try {
    console.log("Doğrudan dosya yükleme isteği alındı:", req.file);
    if (!req.file) {
      return res.status(400).json({ error: "Dosya eksik" });
    }
    
    res.json({ 
      success: true, 
      key: req.body.key || req.file.filename,
      message: "Dosya başarıyla yüklendi"
    });
  } catch (error) {
    console.error("Doğrudan yükleme hatası:", error);
    res.status(500).json({ error: error.message });
  }
});

// Finalize file upload after presigned URL upload
app.post("/api/upload/finalize", async (req, res) => {
  try {
    console.log("Finalize isteği alındı:", req.body);
    const { key, fileName, fileType, fileSize } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: "key zorunludur" });
    }
    
    // Bu aşamada normalde yüklenen dosya doğrulanır ve işlenir
    // Simüle edilmiş bir presigned URL kullanıyoruz, bu yüzden dosya zaten sunucumuzda
    const filePath = `${config.uploadDir}${key}`;
    
    // Dosyanın varlığını kontrol et
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Dosya bulunamadı" });
    }
    
    // PDF metnini çıkar (eğer PDF ise)
    let pdfText = "";
    if (fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      try {
        pdfText = await extractTextFromPDF(filePath);
        storedPDFContent = pdfText;
      } catch (error) {
        console.error("PDF metin çıkarma hatası:", error);
        return res.status(500).json({ error: "PDF işleme hatası: " + error.message });
      }
    }
    
    res.json({ 
      success: true, 
      message: "Dosya işleme tamamlandı",
      key,
      hasText: pdfText.length > 0
    });
  } catch (error) {
    console.error("Finalize hatası:", error);
    res.status(500).json({ error: error.message });
  }
});

// Clear stored PDF content
app.post("/clear", (req, res) => {
  storedPDFContent = null;
  res.json({ message: "Temizlendi" });
});

// PDF upload and analysis endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const pdfPath = req.file.path;
    const documentType = req.body.documentType;
    const pdfText = await extractTextFromPDF(pdfPath);

    storedPDFContent = pdfText;

    if (documentType === "signature") {
      const firstPromptJson = {
        model: config.model,
        system: "Extract only signatories in 'Name - Position' format, one per line.",
        prompt: `List signatories from this document: ${pdfText}`,
        stream: false,
        options: {
          temperature: config.temperature,
          num_ctx: config.num_ctx,
        },
      };

      const secondPromptJson = {
        model: config.model,
        system: `You are analyzing a signature circular (İmza Sirküleri). Create a valid JSON array containing signature authorities.
        Keep responses concise and ensure the JSON is complete. Format:
        
        [{
        "yetkili_kişi": "Full name of the authorized person",
        "işlem_tipi": "List all transaction types they are authorized for",
        "yetkisi_olduğu_hesap": "Account numbers they have authority over, or 'Bilgi Bulunamadı'",
        "tutar_limit": number or "Bilgi Bulunamadı",
        "para_birimi": "TL", "USD", "EUR" or "Bilgi Bulunamadı",
        "temsil_şekli": "Münferit" or "Müşterek"
        }]
        
        For Müşterek (joint) signatures:
        - "gerekli_ortak_sayısı": "Number of required joint signatures"
        - "temsil_ortakları": ["Name1", "Name2"]
        
        Rules:
        1. Keep responses brief
        2. Return ONLY valid JSON array
        3. No explanations or text outside JSON
        4. Ensure JSON is complete for all people`,
        prompt: `Return ONLY a JSON array for: ${pdfText}`,
        stream: false,
        options: {
          temperature: config.temperature,
          num_ctx: config.num_ctx,
        },
      };

      const firstResponsePromise = axios.post(
        `${apiUrl}/api/generate`,
        firstPromptJson,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const secondResponsePromise = axios.post(
        `${apiUrl}/api/generate`,
        secondPromptJson,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const [firstResponse, secondResponse] = await Promise.all([
        firstResponsePromise,
        secondResponsePromise,
      ]);

      res.json({
        analysis: firstResponse.data,
        secondAnalysis: secondResponse.data,
        type: "signature",
      });
    } else {
      const firstPromptJson = {
        model: config.model,
        system: "Analyze the provided legal document in detail. Identify the type of document, summarize its main topic, and highlight the key legal points and clauses. Outline potential risks or issues for the bank. Provide legal recommendations or actions that may be necessary. Respond in Turkish in a professional and concise manner without mentioning the lack of a document or any hypothetical scenarios.",
        prompt: `Analyze this legal document and provide a detailed summary: ${pdfText}`,
        stream: false,
        options: {
          temperature: config.temperature,
          num_ctx: config.num_ctx,
        },
      };

      const response = await axios.post(
        `${apiUrl}/api/generate`,
        firstPromptJson,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      res.json({ analysis: response.data, type: "normal" });
    }
  } catch (error) {
    console.log("Upload file:", req.file);
    console.log("req.body:", req.body);
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Birleştirilmiş Chat API endpoint'i
app.post('/api/chat', async (req, res) => {
  const { message, documentType } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // PDF içeriği varsa PDF analiz işlevselliğini kullan
  if (storedPDFContent) {
    try {
      let systemPrompt = "";
      if (documentType === "signature") {
        systemPrompt = `You are an assistant specialized in analyzing signature circulars. 
        You have access to a signature circular document with the following content: ${storedPDFContent}
        Please provide accurate information about the signatories, their authorities, and any specific details about their signing powers.
        Focus on answering questions about who can sign, their positions, and their authorization limits.`;
      } else {
        systemPrompt = `You are a legal document analysis assistant with expertise in Turkish law.
        You have access to a legal document with the following content: ${storedPDFContent}
        Provide detailed analysis and explanations about the document's content, legal implications, and specific clauses.
        Focus on explaining legal terms, requirements, and implications in clear, understandable terms.`;
      }

      const apiRequestJson = {
        model: config.model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: message,
          },
        ],
        stream: false,
        options: {
          temperature: config.temperature,
          num_ctx: config.num_ctx,
        },
      };

      const response = await axios.post(
        `${apiUrl}/api/chat`,
        apiRequestJson,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return res.json({ response: response.data.response || response.data });
    } catch (error) {
      console.error("Error:", error.message);
      return res.status(500).json({
        error: error.message,
      });
    }
  } 
  
  // PDF içeriği yoksa normal chat işlevselliğini kullan
  try {
    const response = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: message,
        stream: false
      })
    });

    const data = await response.json();
    res.json({ response: data.response });
    
  } catch (error) {
    console.error('Error calling Ollama:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:3000`);
});