# Email Analyzer: Scoring System & Verdict Logic

**Version**: 2.0 (Phase 2)
**Date**: 2025-12-19

This document details the mathematical model and logic architecture used to determine the security verdict of an email. The system uses a **Unified Verdict Engine** that aggregates signals from three distinct analysis contexts: **Header Forensics**, **Body Content**, and **Cross-Context Correlation**.

---

## 1. High-Level Architecture

The Trust Score (0-100) is a weighted aggregate of three sub-scores.

### The Formula
```math
FinalScore = (S_header \times 0.6) + (S_body \times 0.3) + (S_cross \times 0.1)
```

| Component | Weight | Logic | Rationale |
| :--- | :---: | :--- | :--- |
| **Header Score** ($S_{header}$) | **60%** | Cryptographic proofs (SPF/DKIM/DMARC) & Routing. | Technical authentication is the strongest indicator of origin legitimacy. |
| **Body Score** ($S_{body}$) | **30%** | Content intent, NLP analysis, and Payload safety. | Phishing relies on social engineering (urgency, forms) even if headers pass. |
| **Cross-Context** ($S_{cross}$) | **10%** | Alignment between "Who they say they are" vs "What they say". | Detects sophisticated spoofing where headers likely pass (e.g., compromised legitimate accounts). |

> **Privacy Note**: If Body Analysis is disabled by the user, the `FinalScore` equals the `Header Score` ($S_{header}$) exactly.

---

## 2. Component Logic Breakdown

### A. Header Score ($S_{header}$)
*   **Source**: `HeaderParser.ts`
*   **Base Score**: 50 points (Neutral Start)

#### 1. Authentication (The "Big Three")
These check if the sending server is authorized by the claiming domain.
*   **DMARC** (Domain-based Message Authentication):
    *   Checks policy alignment.
    *   **Pass**: `+20 points`
    *   **Fail**: `-30 points` (Severe penalty)
*   **SPF** (Sender Policy Framework):
    *   Checks IP authorization.
    *   **Pass**: `+10 points`
    *   **Fail/Softfail**: `-10 points`
*   **DKIM** (DomainKeys Identified Mail):
    *   Checks digital signature integrity.
    *   **Pass**: `+10 points`
    *   **Fail**: `-10 points`

#### 2. Domain Alignment
*   **Positive**: `From` domain matches `Return-Path` domain (`+5 points`).
*   **Negative**: Mismatch detected AND DMARC not passing (`-5 points`).

#### 3. Routing (Hops)
*   **Positive**: Traceable route found (`+5 points`).
*   **Negative**: No `Received` headers found (`-20 points`).

> **Clamp**: Score is capped between 0 and 100.

---

### B. Body Safety Score ($S_{body}$)
*   **Source**: `BodyAnalyzer.ts`, `PhishingAnalyzer.ts`
*   **Base Score**: 100 points (Assumed Safe)

The Score is a deduction-based model. We assume content is safe until threats are found.

#### 1. NLP & Pattern Triggers
*   **Urgency & Pressure**: `-10 points` per occurrence.
    *   *Keywords*: "Immediately", "24 hours", "Suspend account", "Unauthorized access".
*   **Credential Harvesting**: `-20 points` per occurrence.
    *   *Keywords*: "Verify Password", "Click to Login", "Security Update".
*   **Suspicious Links**: `-20 points` per occurrence.
    *   *Logic*: Links to IP addresses (http://1.2.3.4), excessive subdomains (a.b.c.d.com), or abuse-prone TLDs (.xyz, .gq).
*   **HTML Forms**: `-30 points`.
    *   *Logic*: Detected `<form>` or `<input type="password">` directly in email body.

#### 2. Attachment Payload Penalties
*   **Double Extension** (e.g., `invoice.pdf.exe`): `-50 points`.
*   **Dangerous Executable** (`.exe`, `.bat`, `.scr`): `-40 points`.
*   **Suspicious Container** (`.zip` containing scripts): `-20 points`.

> **Calculation**: $S_{body} = Max(0, 100 - \sum Penalties)$

---

### C. Cross-Context Correlation ($S_{cross}$)
*   **Source**: `CrossContextValidator.ts`
*   **Base Score**: 100 points

This analyzes inconsistencies between the Header envelope and the Content payload.

#### 1. Brand Integrity Check
*   **Logic**: If Body contains high-value brand names (Microsoft, PayPal, Amazon) BUT the Sender Domain is not associated with that brand.
*   **Penalty**: High Risk (`-30 points` to deduction pool).

#### 2. Reply-To Deception
*   **Logic**: Sender is corporate/professional domain, but `Reply-To` is a free email provider (Gmail, Yahoo).
*   **Penalty**: High Risk (`-30 points`).

#### 3. Domain/Link Mismatch
*   **Logic**: Email claims to be from `bank.com` but all links go to `random-site.com` (and urgency is present).
*   **Penalty**: Medium Risk (`-15 points`).

> **Calculation**: $S_{cross} = Max(0, 100 - \sum RiskPenalties)$

---

## 3. Verdict Determination & Labels

The Final Weighted Score determines the internal state, which is then mapped to the user-facing display label.

### Score Thresholds

| Score Range | Internal State | **UI Display Label** | Definition |
| :--- | :--- | :--- | :--- |
| **80 - 100** | `Level: Legitimate` | **Likely Legitimate** | Email passed strong checks. Risk is negligible. <br>*(Green Banner)* |
| **50 - 79** | `Level: Suspicious` | **Suspicious** | Inconclusive signals. Authentication might be weak (Softfail) or content has minor flags. <br>*(Yellow Banner)* |
| **0 - 49** | `Level: Phishing` | **High Risk / Phishing** | Clear threats found. DMARC Failure, known malware extension, or active credential theft. <br>*(Red Banner)* |

### Logic Decision Tree
The system follows this specific chain of logic to arrive at a label:

1.  **Critical Failure Check** (Overrides Score)
    *   *IF* `DMARC` == `fail` AND `Action` == `Reject/Quarantine` -> **High Risk** (regardless of score).
    *   *IF* `Malware Extension` Found (e.g., .exe) -> **High Risk**.
    *   *IF* `HeaderVerdict` == `high_risk` (Legacy logic) -> **High Risk**.

2.  **Score Verification** (If no Critical Failures)
    *   *IF* `FinalScore` >= 80 -> **Likely Legitimate**.
    *   *IF* `FinalScore` < 50 -> **High Risk**.
    *   *ELSE* -> **Suspicious**.

### Why "Likely" Legitimate?
We use the term **"Likely Legitimate"** instead of "Safe" or "Guaranteed" because header analysis cannot account for 100% of scenarios (e.g., a legitimate account that has been compromised and is sending phishing emails with perfect authentication). This language manages expectations and encourages vigilance.
