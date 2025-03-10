'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";

interface ServicePort {
  port: number;
  targetPort: number | string;
  protocol: string;
}

interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: ServicePort[];
  externalUrls: string[];
}

interface K8sResponse {
  services: K8sService[];
  count: number;
  error?: string;
}

interface ChatMessage {
  type: 'question' | 'answer' | 'error';
  text: string;
}

export default function Home() {
  // K8s services state
  const [data, setData] = useState<K8sResponse>({ services: [], count: 0 });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [serverResponse, setServerResponse] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  
  // PDF analysis state
  const [baseUrl, setBaseUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [documentType, setDocumentType] = useState("signature");
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // File handling functions
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const file = files[0];
    if (!file) return;
  
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      // ELB sınırlamaları nedeniyle tüm dosyaları presigned URL ile yükle
      console.log("Tüm dosyalar için presigned URL upload kullanılıyor - dosya boyutu:", file.size);
      await presignedUrlUpload(file);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Dosya yükleme hatası: " + (error as Error).message);
    }
  };

  const presignedUrlUpload = async (file: File) => {
    console.log("Presigned URL upload kullanılıyor, dosya boyutu:", file.size);
    try {
      // 1. Önce API'den presigned URL iste
      console.log("Presigned URL isteniyor...");
      const presignedUrlResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }),
      });

      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json();
        console.error("Presigned URL hatası:", errorData);
        throw new Error(errorData.error || "Presigned URL alma hatası");
      }

      const presignedData = await presignedUrlResponse.json();
      console.log("Presigned URL alındı:", presignedData);
      
      if (presignedData.strategy !== 'direct-upload' || !presignedData.url) {
        throw new Error("Beklenen upload stratejisi alınamadı");
      }

      // 2. Dosyayı doğrudan upload URL'ine yükle
      const uploadFormData = new FormData();
      
      // Gerekli diğer alanları ekle (form fields)
      if (presignedData.fields) {
        Object.entries(presignedData.fields).forEach(([fieldName, fieldValue]) => {
          uploadFormData.append(fieldName, fieldValue as string);
        });
      }
      
      // Dosyayı ekle (file nesnesi en son eklenmeli)
      uploadFormData.append('file', file);

      console.log("Dosya yükleniyor...");
      const uploadResponse = await fetch(presignedData.url, {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Upload hatası:", uploadResponse.status, errorText);
        throw new Error(`Dosya yükleme hatası: ${uploadResponse.status}`);
      }

      console.log("Dosya başarıyla yüklendi!");
      const uploadResult = await uploadResponse.json();
      console.log("Upload sonucu:", uploadResult);
      
      // 3. Yükleme işlemini backend'e bildir
      console.log("Finalize isteği gönderiliyor...");
      const finalizeResponse = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: presignedData.key,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        }),
      });

      if (!finalizeResponse.ok) {
        const errorData = await finalizeResponse.json();
        console.error("Finalize hatası:", errorData);
        throw new Error(errorData.error || "Yükleme işlemi tamamlanamadı");
      }

      const finalizeResult = await finalizeResponse.json();
      console.log("Upload finalize sonucu:", finalizeResult);
      return finalizeResult;
    } catch (error) {
      console.error("Presigned URL upload hatası:", error);
      throw error;
    }
  };

  const handleClear = async () => {
    try {
      if (apiUrl) {
        await fetch(apiUrl + "/clear", { method: "POST" });
      }
      setFile(null);
      setResponse(null);
      setChatHistory([]);
    } catch (error) {
      console.error("Temizleme hatası:", error);
    }
  };

  const handleDownloadJSON = () => {
    if (response?.secondAnalysis?.response) {
      const jsonString = JSON.stringify(
        response.secondAnalysis.response,
        null,
        2
      );
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "analysis_result.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

    
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Lütfen bir dosya seçin.");
    if (!apiUrl) return alert("API URL bulunamadı.");

    setAnalysisLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);

    try {
      const res = await fetch(apiUrl + "/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error("Error uploading file:", error);
      setResponse("Error processing the file.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !apiUrl) return;

    const userQuestion = question.trim();
    setChatHistory([
      ...chatHistory,
      { type: "question", text: userQuestion },
    ]);
    setQuestion("");

    try {
      const res = await fetch(apiUrl + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userQuestion, documentType }),
      });
      const data = await res.json();
      
      // Server yanıtını doğru şekilde işle
      const responseText = data.response || (data.reply && data.reply.message && data.reply.message.content) || "Yanıt alınamadı.";
      
      setChatHistory([
        ...chatHistory,
        { type: "answer", text: responseText },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory([
        ...chatHistory,
        { type: "error", text: "Bir hata oluştu." },
      ]);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        // Input alanını da güncelle
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(droppedFile);
          fileInput.files = dataTransfer.files;
        }
        
        // Dosyayı yükle
        await uploadFile(droppedFile);
      } else {
        alert("Lütfen sadece PDF dosyası yükleyin.");
      }
    }
  };

  // Signatory table component
  const signatoryTable = (content: string | null) => {
    if (!content) return null;
    
    const parseContent = (text: string) => {
      return text
        .split("\n")
        .filter((line) => line.trim() && line.includes("-"))
        .map((line) => {
          const [name, fullPosition] = line
            .split(/-(.+)/)
            .map((part) => part?.trim())
            .filter(Boolean);
          return {
            name: name.replace(/^\d+\.\s*/, ""),
            position: fullPosition,
          };
        });
    };

    const signatories = parseContent(content);

    const tableStyle = {
      width: "100%",
      borderCollapse: "collapse" as const,
      backgroundColor: "#F6F6F6",
      border: "1px solid #e0e0e0",
    };

    const headerStyle = {
      backgroundColor: "#fff",
      color: "#333",
      padding: "15px",
      textAlign: "left" as const,
      borderBottom: "1px solid #e0e0e0",
      fontSize: "14px",
      fontWeight: "500",
    };

    const cellStyle = {
      padding: "15px",
      borderBottom: "1px solid #e0e0e0",
      color: "#666",
      fontSize: "14px",
    };

    const numberCellStyle = {
      ...cellStyle,
      width: "40px",
      textAlign: "center" as const,
      color: "#333",
      fontWeight: "500",
      backgroundColor: "#fff",
    };

    return (
      <div style={{ overflowX: "hidden", height: "100%" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, width: "40px" }}>#</th>
              <th style={headerStyle}>Ad-Soyad</th>
              <th style={headerStyle}>Pozisyon/Yetki</th>
            </tr>
          </thead>
          <tbody>
            {signatories.map((person, index) => (
              <tr key={index}>
                <td style={numberCellStyle}>{index + 1}</td>
                <td style={cellStyle}>{person.name}</td>
                <td style={cellStyle}>{person.position}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Analysis result renderer
  const renderAnalysisResult = () => {
    const emptyTable = (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "#F6F6F6",
          border: "1px solid #e0e0e0",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                backgroundColor: "#fff",
                color: "#333",
                padding: "15px",
                textAlign: "left",
                borderBottom: "1px solid #e0e0e0",
                fontSize: "14px",
                fontWeight: "500",
                width: "40px",
              }}
            >
              #
            </th>
            <th
              style={{
                backgroundColor: "#fff",
                color: "#333",
                padding: "15px",
                textAlign: "left",
                borderBottom: "1px solid #e0e0e0",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Ad-Soyad
            </th>
            <th
              style={{
                backgroundColor: "#fff",
                color: "#333",
                padding: "15px",
                textAlign: "left",
                borderBottom: "1px solid #e0e0e0",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Pozisyon/Yetki
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              colSpan={3}
              style={{
                padding: "30px",
                textAlign: "center",
                color: "#666",
              }}
            >
              Henüz analiz yapılmadı
            </td>
          </tr>
        </tbody>
      </table>
    );

    const emptyAnalysis = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "15px",
          color: "#666",
        }}
      >
        <Image
          src="/nomessage.png"
          alt="No Analysis"
          width={150}
          height={150}
        />
        <p
          style={{
            fontSize: "15px",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Henüz dosya analizi yapılmadı
        </p>
      </div>
    );

    if (!response || !response.analysis) {
      if (documentType === "signature") {
        return (
          <div
            style={{
              height: "100%",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {emptyTable}
          </div>
        );
      }
      return emptyAnalysis;
    }

    if (response.type === "signature") {
      return (
        <div
          style={{
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {signatoryTable(response.analysis.response)}
        </div>
      );
    } else {
      const analysis = response.analysis.response;
      return (
        <div
          style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
            height: "100%",
            overflow: "auto",
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#333",
          }}
        >
          {analysis}
        </div>
      );
    }
  };

  // Set up API URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const base = window.location.origin;
      setBaseUrl(base.split(":3000")[0]);
    }
  }, []);

  useEffect(() => {
    if (baseUrl) {
      setApiUrl(baseUrl + ":3001");
    }
  }, [baseUrl]);

  // Fetch K8s services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/k8s/services');
        const result: K8sResponse = await response.json();
        
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err) {
        setError('Failed to fetch Kubernetes services');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const testServer = async () => {
    setTestLoading(true);
    setServerResponse('');
    try {
      const response = await fetch('/api/test');
      const result = await response.json();
      setServerResponse(JSON.stringify(result, null, 2));
    } catch (err) {
      setServerResponse('Failed to connect to the server: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTestLoading(false);
    }
  };

  const handleChat = async () => {
    if (!message.trim()) return;
    
    setChatLoading(true);
    setAiResponse('');
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setAiResponse(data.response);
    } catch (err) {
      setAiResponse('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setChatLoading(false);
    }
  };

  // Dosya yükleme alanı için stil değişkeni
  const dropAreaStyle = {
    flex: 1,
    border: dragActive ? `2px dashed #2B5A24` : `2px solid #E0E0E0`,
    borderRadius: "8px",
    padding: "15px",
    textAlign: "center" as const,
    backgroundColor: dragActive ? "#F0F7F0" : "#F9F9F9",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    transition: "all 0.2s ease-in-out",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-primary">Loading services...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-destructive/10 p-4 rounded-md mb-4">
            <p className="text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-card-foreground">
            Kubernetes Services ({data.count})
          </h1>
          <Button 
            onClick={testServer}
            disabled={testLoading}
          >
            {testLoading ? 'Testing...' : 'Test Server'}
          </Button>
        </div>

        {/* PDF Analysis Interface */}
        <div
          style={{
            display: "flex",
            fontFamily: "Arial, sans-serif",
            backgroundColor: "#fff",
            overflow: "hidden",
            gap: "20px",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            marginBottom: "2rem"
          }}
        >
          {/* Left Section */}
          <div
            style={{
              width: "32%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              height: "calc(100vh)",
            }}
          >
            {/* File Upload Area */}
            <div
              style={{
                height: "30%",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#F9F9F9",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <h3
                style={{
                  color: "#19710B",
                  fontSize: "18px",
                  fontWeight: "bold",
                  marginBottom: "12px",
                }}
              >
                Dosya Seçiniz
              </h3>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() =>
                  document.getElementById("fileInput")?.click()
                }
                style={dropAreaStyle}
              >
                <Image
                  src="/arrow.png"
                  alt="Arrow"
                  width={80}
                  height={50}
                />
                <p
                  style={{
                    margin: "0",
                    color: "#666",
                    fontSize: "13px",
                    fontFamily: "Helvetica",
                    fontStyle: "italic",
                  }}
                >
                  {file
                    ? file.name
                    : "Yalnızca pdf formatlı dosya yükleyiniz"}
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  id="fileInput"
                />
                <button
                  style={{
                    color: "#2B5A24",
                    border: "none",
                    backgroundColor: "white",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {file ? "Dosyayı Değiştir" : "Buraya Yükleyiniz"}
                  <Image
                    src="/send.png"
                    alt="Upload"
                    width={24}
                    height={24}
                  />
                </button>
              </div>
            </div>

            {/* Document Type Selection */}
            <div
              style={{
                height: "10%",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <h3
              className='mt-20'
                style={{
                  color: "#2B5A24",
                  fontSize: "16px",
                  fontWeight: "bold",
                  fontFamily: "Helvetica",
                  margin: 0,
                }}
              >
                Döküman Tipi:
              </h3>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                style={{
                  width: "100%",
                  height: "45px",
                  padding: "0 15px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  fontFamily: "Helvetica",
                  color: "black",
                }}
              >
                <option value="signature">İmza Sirküleri</option>
                <option value="normal">Normal Dosya</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                height: "7%",
                marginBottom: "4px",
              }}
            >
              <button
                onClick={handleSubmit}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "#2B5A24",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Analiz Et
              </button>
              <button
                onClick={handleClear}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "#19710B",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Temizle
              </button>
            </div>

            {/* Q&A Section */}
            <div
              style={{
                flex: 1,
                backgroundColor: "#F9F9F9",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                height: "calc(53% - 16px)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 15px 0",
                  color: "#2B5A24",
                  fontSize: "16px",
                  fontWeight: "bold",
                  fontFamily: "Helvetica",
                }}
              >
                Soru&Cevap
              </h3>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  marginBottom: "15px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent:
                    chatHistory.length === 0
                      ? "center"
                      : "flex-start",
                  alignItems: "center",
                }}
              >
                {chatHistory.length === 0 ? (
                  <Image
                    src="/nomessage.png"
                    alt="No Messages"
                    width={200}
                    height={200}
                  />
                ) : (
                  chatHistory.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        margin: "5px 0",
                        padding: "10px 15px",
                        backgroundColor:
                          msg.type === "question"
                            ? "#4CAF50"
                            : "#f5f5f5",
                        color:
                          msg.type === "question"
                            ? "white"
                            : "#333",
                        borderRadius: "5px",
                        maxWidth: "80%",
                        alignSelf:
                          msg.type === "question"
                            ? "flex-end"
                            : "flex-start",
                        width: "fit-content",
                      }}
                    >
                      {msg.text}
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={handleQuestionSubmit}
                style={{
                  display: "flex",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Soru sorun..."
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                    fontSize: "14px",
                    color: "black",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#2B5A24",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  Gönder
                </button>
              </form>
            </div>
          </div>

          {/* Right Section */}
          <div
            style={{
              width: "68%",
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "20px 25px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  color: "#2B5A24",
                  fontWeight: "500",
                }}
              >
                {documentType === "signature"
                  ? "İmza Yetkilileri"
                  : "Dosya Analizi"}
              </h2>
              {response?.secondAnalysis && (
                <button
                  onClick={handleDownloadJSON}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#2B5A24",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  JSON İNDİR
                </button>
              )}
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                backgroundColor:
                  documentType !== "signature"
                    ? "#F9F9F9"
                    : "transparent",
                borderRadius: "8px",
                padding: documentType !== "signature" ? "15px" : "0",
              }}
            >
              {analysisLoading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "#666",
                  }}
                >
                  Dosya Analiz Ediliyor...
                </div>
              ) : (
                renderAnalysisResult()
              )}
            </div>
          </div>
        </div>

        {/* Original K8s Services Section */}
        {serverResponse && (
          <div className="bg-card p-4 rounded-lg shadow-lg mb-6">
            <h2 className="text-xl font-semibold text-card-foreground mb-2">Server Response:</h2>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto">
              {serverResponse}
            </pre>
          </div>
        )}
        
        {/* <div className="grid gap-6">
          {data.services.map((service) => (
            <div key={`${service.namespace}-${service.name}`} className="bg-card p-6 rounded-lg shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-card-foreground">
                  {service.name}
                </h2>
                <span className="px-3 py-1 bg-primary/10 rounded-full text-sm text-primary">
                  {service.type}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Namespace: {service.namespace}</p>
                <p>Cluster IP: {service.clusterIP}</p>
                
                <div>
                  <p className="font-medium text-card-foreground">Ports:</p>
                  <ul className="ml-4 space-y-1">
                    {service.ports.map((port, idx) => (
                      <li key={idx}>
                        {port.port} → {port.targetPort} ({port.protocol})
                      </li>
                    ))}
                  </ul>
                </div>

                {service.externalUrls.length > 0 && (
                  <div>
                    <p className="font-medium text-card-foreground">External URLs:</p>
                    <ul className="ml-4 space-y-1">
                      {service.externalUrls.map((url, idx) => (
                        <li key={idx}>{url}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div> */}
      </div>
    </div>
  );
}