# Phase 2: Phishing Analysis & Privacy Architecture
**Date**: 2025-12-19
**Status**: Implemented

## 1. Feature Request Summary
The objective was to extend the existing Email Header Analyzer to support content-based phishing detection without compromising user privacy.

**Key Requirements**:
*   **Parallel Analysis**: Keep the legacy header parser (100% safe) and add a new optional body/attachment analyzer.
*   **Privacy-First**: No data sent to servers. Usage of `PostalMime` for local parsing.
*   **Unified Verdict**: Combine header signals (SPF/DKIM) with body signals (Urgency, Credential harvesting) into a single score.
*   **UX Enhancements**: Drag & Drop, File Upload Button, and Privacy Badges.

## 2. Backup Details
*   **Backup Location**: `src/components/tools/email/phase1_backup/`
*   **Contents**: Contains the original `HeaderParser.ts`, `EmailAnalyzer.tsx` (Phase 1 version), and related components before the architecture split.

## 3. Implementation Plan & Architecture

### A. Directory Structure Changes
```text
src/components/tools/email/
├── HeaderParser.ts           # (Legacy) The rock-solid header logic
├── PhishingAnalyzer.ts       # (New) Orchestrator for body/attachments
├── BodyAnalyzer.ts           # (New) Scans text/HTML for NLP patterns
├── AttachmentScanner.ts      # (New) Checks for double extensions/malware types
├── CrossContextValidator.ts  # (New) Correlates Header data vs Body data
├── VerdictEngine.ts          # (New) Math to combine separate scores
├── PrivacyControls.tsx       # (New) UI for privacy toggles
├── PhishingIndicatorsPanel.tsx # (New) UI for displaying threats
└── EmailAnalyzer.tsx         # (Updated) Controller that manages the parallel pipeline
```

### B. Logic Flow (Parallel Pipeline)
1.  **Input**: User pastes text or uploads `.eml`.
2.  **Branch 1 (Headers)**: `HeaderParser.parse()` runs immediately.
3.  **Branch 2 await (Privacy Check)**:
    *   If `Analyze Body` is OFF: `PhishingAnalyzer` treats content as null.
    *   If `Analyze Body` is ON: `PhishingAnalyzer` parses MIME, extracts text/html/attachments.
4.  **Verdict Engine**: Receives results from both branches.
    *   `FinalScore = (HeaderScore * 0.6) + (BodyScore * 0.3) + (CrossContextScore * 0.1)` (Weights adjusted dynamically based on active modes).

### C. New Features
*   **BodyAnalyzer**: Regex-based detection for:
    *   Urgency keywords ("Immediately", "24 hours").
    *   Credential prompts ("Verify your password").
    *   Suspicious URLs (IPs, excessive subdomains).
*   **CrossContextValidator**:
    *   Checks if Sender Domain matches Brand Keywords in body (e.g., "Microsoft" in text vs "gmail.com" sender).
    *   Checks Reply-To anomalies.
*   **AttachmentScanner**:
    *   Flags dangerous extensions (.exe, .scr).
    *   Detects double extensions (invoice.pdf.exe).

## 4. User Interface Updates
*   **Privacy Controls**: Added distinct toggles for Body and Attachment analysis.
*   **Upload Button**: Native file picker input.
*   **Privacy Badge**: "100% Client-Side Privacy" banner to reassure users.
*   **Dashboard**: Added "Phishing Indicators" panel to the Analyst view.

## 5. Verification
*   **Legacy Mode**: Pasting headers works exactly as before (Phase 1 behavior preserved).
*   **Phishing Mode**: Enabling body analysis correctly flags "urgent" emails and "suspicious links".
*   **Upload**: Uploading `.eml` files correctly populates both headers and body content.
