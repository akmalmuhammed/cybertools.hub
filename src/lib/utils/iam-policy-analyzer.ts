interface GenericObject {
  [key: string]: unknown;
}

export interface IamFinding {
  severity: "low" | "medium" | "high" | "critical";
  platform: "aws" | "azure" | "gcp" | "generic";
  issue: string;
  evidence: string;
  recommendation: string;
}

export interface IamPolicyAnalysisResult {
  findings: IamFinding[];
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  notes: string[];
}

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeActionList(value: unknown): string[] {
  return asArray(value).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

function analyzeAwsPolicy(payload: GenericObject, findings: IamFinding[]) {
  const statements = asArray(payload.Statement).filter((item) => isObject(item)) as GenericObject[];
  statements.forEach((statement, index) => {
    const effect = String(statement.Effect ?? "").toLowerCase();
    const actions = normalizeActionList(statement.Action);
    const resources = normalizeActionList(statement.Resource);
    const principal = statement.Principal;
    const line = `Statement[${index}]`;

    if (effect === "allow" && actions.includes("*") && resources.includes("*")) {
      findings.push({
        severity: "critical",
        platform: "aws",
        issue: "Full admin wildcard permission detected.",
        evidence: `${line} allows Action=* on Resource=*`,
        recommendation: "Replace wildcard grants with scoped actions and resource ARNs.",
      });
    }
    if (actions.some((action) => action.startsWith("iam:*") || action.startsWith("sts:*"))) {
      findings.push({
        severity: "high",
        platform: "aws",
        issue: "Broad IAM/STS privilege grant.",
        evidence: `${line} includes ${actions.join(", ")}`,
        recommendation: "Limit IAM/STS permissions to exact operations and approved resources.",
      });
    }
    if (isObject(principal) && normalizeActionList(principal.AWS).includes("*")) {
      findings.push({
        severity: "high",
        platform: "aws",
        issue: "Wildcard principal trust relationship.",
        evidence: `${line} Principal.AWS=*`,
        recommendation: "Restrict trust policy principals to explicit account or role ARNs.",
      });
    }
  });
}

function analyzeAzurePolicy(payload: GenericObject, findings: IamFinding[]) {
  const permissions = asArray(payload.permissions).filter((item) => isObject(item)) as GenericObject[];
  permissions.forEach((permission, index) => {
    const actions = normalizeActionList(permission.actions);
    if (actions.some((action) => action === "*" || action.endsWith("/*"))) {
      findings.push({
        severity: "high",
        platform: "azure",
        issue: "Wildcard Azure action grant.",
        evidence: `permissions[${index}].actions includes wildcard.`,
        recommendation: "Scope Azure actions to least-privilege operation sets.",
      });
    }
  });

  const roleName = String(payload.roleName ?? payload.name ?? "").toLowerCase();
  if (roleName.includes("owner") || roleName.includes("contributor")) {
    findings.push({
      severity: "medium",
      platform: "azure",
      issue: "High-privilege role template detected.",
      evidence: `Role name: ${roleName || "unknown"}`,
      recommendation: "Prefer custom roles with only required actions.",
    });
  }
}

function analyzeGcpPolicy(payload: GenericObject, findings: IamFinding[]) {
  const bindings = asArray(payload.bindings).filter((item) => isObject(item)) as GenericObject[];
  bindings.forEach((binding, index) => {
    const role = String(binding.role ?? "").toLowerCase();
    if (role === "roles/owner") {
      findings.push({
        severity: "critical",
        platform: "gcp",
        issue: "GCP owner role detected.",
        evidence: `bindings[${index}].role=roles/owner`,
        recommendation: "Replace owner with scoped predefined or custom roles.",
      });
    } else if (role === "roles/editor") {
      findings.push({
        severity: "high",
        platform: "gcp",
        issue: "GCP editor role detected.",
        evidence: `bindings[${index}].role=roles/editor`,
        recommendation: "Use least-privilege role composition instead of editor.",
      });
    }

    const members = normalizeActionList(binding.members);
    if (members.includes("allusers") || members.includes("allauthenticatedusers")) {
      findings.push({
        severity: "high",
        platform: "gcp",
        issue: "Public member binding detected.",
        evidence: `bindings[${index}] includes public principal member.`,
        recommendation: "Remove public principals unless explicitly required and documented.",
      });
    }
  });
}

export function analyzeIamPolicy(input: string): IamPolicyAnalysisResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("IAM policy input must be valid JSON.");
  }
  if (!isObject(parsed)) {
    throw new Error("IAM policy root must be an object.");
  }

  const findings: IamFinding[] = [];

  if ("Statement" in parsed) {
    analyzeAwsPolicy(parsed, findings);
  }
  if ("permissions" in parsed || "roleName" in parsed) {
    analyzeAzurePolicy(parsed, findings);
  }
  if ("bindings" in parsed) {
    analyzeGcpPolicy(parsed, findings);
  }

  if (findings.length === 0) {
    findings.push({
      severity: "low",
      platform: "generic",
      issue: "No high-confidence risky patterns matched.",
      evidence: "Policy parsed successfully but no wildcard/admin anti-patterns were found.",
      recommendation: "Continue with manual least-privilege validation for context-specific access paths.",
    });
  }

  return {
    findings,
    summary: {
      totalFindings: findings.length,
      critical: findings.filter((finding) => finding.severity === "critical").length,
      high: findings.filter((finding) => finding.severity === "high").length,
      medium: findings.filter((finding) => finding.severity === "medium").length,
      low: findings.filter((finding) => finding.severity === "low").length,
    },
    notes: [
      "Analyzer checks common wildcard and over-privilege anti-patterns for AWS, Azure, and GCP policy styles.",
      "Use as a pre-review lint step, not a replacement for provider-native policy simulation.",
    ],
  };
}
