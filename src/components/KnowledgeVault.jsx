
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  Search,
  FileText,
  FileSpreadsheet,
  FileType,
  Download,
  Trash2,
  RefreshCw,
  FolderOpen,
  Database,
  CheckCircle2,
  AlertCircle,
  Clock3,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Papa from "papaparse";
import "./KnowledgeVault.css";
import KnowledgeExtraction from "./KnowledgeExtraction";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "csv"];

const CATEGORIES = [
  "General",
  "Technical",
  "Process",
  "Decision",
  "Policy",
  "Project",
  "Research",
];

function getExtension(filename) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function getFileIcon(filename) {
  const extension = getExtension(filename);

  if (extension === "csv") return FileSpreadsheet;
  if (extension === "txt") return FileType;
  return FileText;
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

async function extractDocumentText(file) {
  const extension = getExtension(file.name);

  if (extension === "txt") {
    return await file.text();
  }

  if (extension === "csv") {
    return await new Promise((resolve, reject) => {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (results) => {
          const text = results.data
            .map((row) => Array.isArray(row) ? row.join(" | ") : String(row))
            .join("\n");

          resolve(text);
        },
        error: reject,
      });
    });
  }

  if (extension === "pdf") {
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;

    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      pages.push(pageText);
    }

    return pages.join("\n\n").trim();
  }

  if (extension === "docx") {
    const mammothModule = await import("mammoth/mammoth.browser");
    const mammoth = mammothModule.default || mammothModule;

    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });

    return result.value.trim();
  }

  throw new Error("Unsupported document format.");
}

export default function KnowledgeVault({ organizationId, userId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    if (!organizationId) {
      setError("No active organisation was provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("knowledge_documents")
      .select(
        "id, title, original_filename, mime_type, file_size_bytes, category, description, processing_status, processing_error, created_at, storage_path"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setDocuments([]);
    } else {
      setDocuments(data || []);
    }

    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesSearch = [
        document.title,
        document.original_filename,
        document.description,
        document.category,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        categoryFilter === "All" ||
        document.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [documents, search, categoryFilter]);

  async function handleUpload(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedFile) {
      setError("Please select a document first.");
      return;
    }

    const extension = getExtension(selectedFile.name);

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setError("Only PDF, DOCX, TXT and CSV documents are supported.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("The maximum file size is 10 MB.");
      return;
    }

    if (!organizationId || !userId) {
      setError("Your organisation session could not be verified.");
      return;
    }

    setUploading(true);

    let storagePath = null;
    let storageUploaded = false;

    try {
      // Extract readable content from the original document.
      let extractedText = "";
      let extractionError = "";

      try {
        extractedText = await extractDocumentText(selectedFile);
        extractedText = extractedText.slice(0, 200000);
      } catch (err) {
        extractionError = err.message || "Text extraction failed.";
        console.warn("Document extraction:", err);
      }

      // Use an organisation/user-specific private storage path.
      const safeFilename = selectedFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const uniqueFilename =
        `${crypto.randomUUID()}-${safeFilename}`;

      storagePath = `${organizationId}/${userId}/${uniqueFilename}`;

      const { error: storageError } = await supabase.storage
        .from("loom-documents")
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type || "application/octet-stream",
          upsert: false,
        });

      if (storageError) throw storageError;

      storageUploaded = true;

      // Save document metadata and extracted content in PostgreSQL.
      const { error: insertError } = await supabase
        .from("knowledge_documents")
        .insert({
          organization_id: organizationId,
          uploaded_by: userId,
          title: title.trim() || selectedFile.name.replace(/\.[^/.]+$/, ""),
          original_filename: selectedFile.name,
          storage_path: storagePath,
          mime_type: selectedFile.type || null,
          file_size_bytes: selectedFile.size,
          category,
          description: description.trim() || null,
          extracted_text: extractedText || null,
          processing_status: extractedText ? "completed" : "failed",
          processing_error: extractionError || (
            extractedText
              ? null
              : "No readable text was extracted. The original file is still stored."
          ),
          processed_at: extractedText ? new Date().toISOString() : null,
        });

      if (insertError) throw insertError;

      // Record a meaningful workspace event.
      await supabase.from("activity_events").insert({
        organization_id: organizationId,
        actor_id: userId,
        action: "document_uploaded",
        entity_type: "document",
        summary: `Uploaded ${selectedFile.name}`,
      });

      setNotice(
        extractedText
          ? "Document uploaded and text extracted successfully."
          : "Document uploaded. Text extraction needs attention."
      );

      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setCategory("General");
      setShowUpload(false);

      if (fileInputRef.current) fileInputRef.current.value = "";

      await loadDocuments();
    } catch (err) {
      console.error("Knowledge Vault upload error:", err);

      // Remove an orphaned storage object if database insertion failed.
      if (storageUploaded && storagePath) {
        await supabase.storage
          .from("loom-documents")
          .remove([storagePath]);
      }

      setError(err.message || "The document could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(document) {
    setError("");

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("loom-documents")
        .createSignedUrl(document.storage_path, 60);

      if (signedUrlError) throw signedUrlError;

      const link = window.open(data.signedUrl, "_blank");

      if (!link) {
        setNotice("Your browser blocked the new tab. Allow pop-ups and try again.");
      }
    } catch (err) {
      setError(err.message || "Unable to open this document.");
    }
  }

  async function handleDelete(document) {
    const confirmed = window.confirm(
      `Delete "${document.original_filename}" permanently?`
    );

    if (!confirmed) return;

    setDeletingId(document.id);
    setError("");
    setNotice("");

    try {
      const { error: storageError } = await supabase.storage
        .from("loom-documents")
        .remove([document.storage_path]);

      if (storageError) throw storageError;

      const { error: databaseError } = await supabase
        .from("knowledge_documents")
        .delete()
        .eq("id", document.id)
        .eq("organization_id", organizationId);

      if (databaseError) throw databaseError;

      await supabase.from("activity_events").insert({
        organization_id: organizationId,
        actor_id: userId,
        action: "document_deleted",
        entity_type: "document",
        summary: `Deleted ${document.original_filename}`,
      });

      setNotice("Document deleted successfully.");
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Unable to delete this document.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalStorage = documents.reduce(
    (total, document) => total + (document.file_size_bytes || 0),
    0
  );

  return (
    <div className="vault-page">
      <header className="vault-header">
        <div>
          <span className="vault-eyebrow">
            <Database size={14} /> ORGANISATIONAL KNOWLEDGE
          </span>
          <h1>Knowledge Vault</h1>
          <p>
            Collect, organise and preserve the documents that hold
            your organisation's operational knowledge.
          </p>
        </div>

        <button
          className="vault-primary-button"
          onClick={() => {
            setShowUpload(!showUpload);
            setError("");
            setNotice("");
          }}
          type="button"
        >
          {showUpload ? <X size={17} /> : <UploadCloud size={17} />}
          {showUpload ? "Close upload" : "Upload document"}
        </button>
      </header>

      {error && (
        <div className="vault-message vault-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="vault-message vault-success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}

      {showUpload && (
        <section className="vault-upload-panel">
          <div className="vault-panel-title">
            <div>
              <h2>Add knowledge to your vault</h2>
              <p>Upload an authorised organisational document.</p>
            </div>
          </div>

          <form onSubmit={handleUpload}>
            <label className="vault-file-picker">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.csv"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file && !title) {
                    setTitle(file.name.replace(/\.[^/.]+$/, ""));
                  }
                }}
              />
              <UploadCloud size={25} />
              <strong>
                {selectedFile ? selectedFile.name : "Choose a document"}
              </strong>
              <span>PDF, DOCX, TXT or CSV · Maximum 10 MB</span>
            </label>

            <div className="vault-form-grid">
              <label>
                Document title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Payment system architecture"
                  maxLength={200}
                />
              </label>

              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="vault-description-label">
              Description (optional)
              <textarea
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this document contains..."
                maxLength={1000}
              />
            </label>

            <div className="vault-upload-actions">
              <span>Files are stored in your private organisation bucket.</span>
              <button
                className="vault-primary-button"
                disabled={!selectedFile || uploading}
                type="submit"
              >
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="vault-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    Upload to vault
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="vault-stats">
        <div className="vault-stat">
          <span>Total documents</span>
          <strong>{documents.length}</strong>
          <FileText size={19} />
        </div>
        <div className="vault-stat">
          <span>Successfully extracted</span>
          <strong>
            {documents.filter((doc) => doc.processing_status === "completed").length}
          </strong>
          <CheckCircle2 size={19} />
        </div>
        <div className="vault-stat">
          <span>Storage used</span>
          <strong>{formatSize(totalStorage)}</strong>
          <Database size={19} />
        </div>
      </section>

      <section className="vault-library">
        <div className="vault-library-heading">
          <div>
            <h2>Document library</h2>
            <p>
              {documents.length} {documents.length === 1 ? "document" : "documents"} in this organisation
            </p>
          </div>

          <button
            className="vault-refresh"
            type="button"
            onClick={loadDocuments}
            disabled={loading}
            title="Refresh documents"
          >
            <RefreshCw size={16} className={loading ? "vault-spin" : ""} />
          </button>
        </div>

        <div className="vault-filters">
          <div className="vault-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              aria-label="Search documents"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filter by category"
          >
            <option>All</option>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="vault-empty">
            <RefreshCw className="vault-spin" size={25} />
            <strong>Loading documents...</strong>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="vault-empty">
            <div className="vault-empty-icon">
              <FolderOpen size={29} />
            </div>
            <strong>
              {documents.length === 0
                ? "Your knowledge vault is empty"
                : "No matching documents"}
            </strong>
            <p>
              {documents.length === 0
                ? "Upload your first authorised document to start building your organisation's knowledge base."
                : "Try another search term or category."}
            </p>
            {documents.length === 0 && (
              <button
                className="vault-text-button"
                onClick={() => setShowUpload(true)}
                type="button"
              >
                Upload your first document <UploadCloud size={15} />
              </button>
            )}
          </div>
        ) : (
          <div className="vault-document-list">
            {filteredDocuments.map((document) => {
              const FileIcon = getFileIcon(document.original_filename);

              return (
                <article className="vault-document" key={document.id}>
                  <div className="vault-document-icon">
                    <FileIcon size={22} />
                  </div>

                  <div className="vault-document-details">
                    <strong>{document.title}</strong>
                    <span>{document.original_filename}</span>
                    <div className="vault-document-meta">
                      <span>{document.category}</span>
                      <span>{formatSize(document.file_size_bytes)}</span>
                      <span>{formatDate(document.created_at)}</span>
                    </div>
                    {document.processing_error && (
                      <small className="vault-processing-error">
                        {document.processing_error}
                      </small>
                    )}
                  </div>

                  <div className="vault-document-status">
                    {document.processing_status === "completed" ? (
                      <span className="vault-status complete">
                        <CheckCircle2 size={13} /> Extracted
                      </span>
                    ) : (
                      <span className="vault-status failed">
                        <AlertCircle size={13} /> Needs review
                      </span>
                    )}
                  </div>
                   <KnowledgeExtraction
  document={document}
  organizationId={organizationId}
  userId={userId}
/>
                  <div className="vault-document-actions">
                    <button
                      type="button"
                      onClick={() => handleDownload(document)}
                      title="Open document"
                      aria-label={`Open ${document.title}`}
                    >
                      <Download size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(document)}
                      title="Delete document"
                      aria-label={`Delete ${document.title}`}
                      disabled={deletingId === document.id}
                    >
                      {deletingId === document.id ? (
                        <RefreshCw size={16} className="vault-spin" />
                      ) : (
                        <Trash2 size={17} />
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
