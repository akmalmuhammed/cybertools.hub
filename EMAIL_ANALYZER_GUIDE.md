# Email Analyzer Tool - Technical Guide

## 1. Product Overview
The **Email Analyzer** is a client-side digital forensics tool designed to investigate email legitimacy. It combines legacy header analysis with modern content-based phishing detection, all running locally in the user's browser.

**Key Features**:
*   **100% Client-Side**: No data is uploaded to any server. All parsing happens in-memory.
*   **Hybrid Analysis**: Combines cryptographic proofs (SPF/DKIM) with behavioral signals (Urgency/Deception).
*   **Format Support**: Handles raw text headers and `.eml` files.

---

## 2. Architecture: Parallel Pipeline

The application uses a dual-track analysis engine to respect user privacy while offering deep insights.

### Track A: Header Forensics (Always On)
*   **Engine**: `HeaderParser.ts` (Custom Logic)
*   **Function**: Parses standard RFC 5322 headers.
*   **Checks**:
    *   **Authentication**: Validates SPF, DKIM, and DMARC results from `Authentication-Results` headers.
    *   **Hops Analysis**: Traces `Received` headers to visualize the delivery path and detect latency.
    *   **X-Headers**: Decodes security headers from upstream filters (e.g., Proofpoint, Mimecast).

### Track B: Phishing & Content (Opt-In)
*   **Engine**: `PhishingAnalyzer.ts` (Powered by `PostalMime`)
*   **Function**: Parses the full MIME structure (Body, HTML, Attachments).
*   **Modules**:
    1.  **`BodyAnalyzer`**: Scans for NLP patterns (Urgency, Credential Harvesting, HTML Forms).
    2.  **`AttachmentScanner`**: Checks metadata for dangerous file types and double extensions.
    3.  **`CrossContextValidator`**: Correlates Header data with Body content (e.g., "Microsoft" mentioned in body but sent from unknown domain).

---

## 3. Verdict Engine
The `VerdictEngine.ts` unifies signals from both tracks into a single **Trust Score (0-100)** and **Verdict**.

**Scoring Model**:
*   **Header Signals (60%)**: DMARC/SPF status, Domain alignment.
*   **Body Signals (30%)**: Suspicious links, Urgency keywords, Credential prompts.
*   **Cross-Context (10%)**: Brand mismatch, Reply-To deception.

**Verdict Levels**:
*   🟢 **Legitimate**: Score > 80, DMARC Pass, No critical flags.
*   🟡 **Suspicious**: Score 50-80, Soft fails, or mixed signals.
*   🔴 **Phishing**: Score < 50, Critical auth failures, or strong phishing indicators.

---

## 4. Privacy Architecture
The tool is built on a **Privacy-First** principle.

*   By default, **ONLY** headers are analyzed.
*   **Body Analysis** and **Attachment Scanning** are strictly **Opt-In**.
*   **Memory-Only**: No data is persisted to LocalStorage or Cookies.
*   **No API Dependencies**: All logic is heuristic and local. (VirusTotal/IP links are manual external references).

---

## 5. UI/UX Features

### Input Methods
*   **Paste**: Direct text input of headers.
*   **Drag & Drop**: Support for `.eml` files.
*   **Upload Button**: System file picker.

### View Modes
1.  **Analyst View** (Default):
    *   Full dashboard with Auth results, Hops visualization, and Phishing Indicators.
    *   Access to Privacy Controls.
2.  **Quick IT**:
    *   Simplified "safe/unsafe" verdict.
    *   Actionable recommendations (e.g., "Quarantine").
3.  **Raw View**:
    *   Inspect raw Headers, Body Text, and Body HTML.

### Exports
*   **PDF**: Printable report.
*   **JSON**: Full analysis object export.
*   **CSV**: Flattened summary for spreadsheets.
