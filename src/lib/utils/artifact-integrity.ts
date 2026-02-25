import CryptoJS from "crypto-js";

export interface ArtifactManifestEntry {
  artifact: string;
  hashes: Record<string, string>;
  collectedAt: string;
}

export interface ArtifactIntegrityPackage {
  packageId: string;
  createdAt: string;
  chainOfCustody: string[];
  manifest: ArtifactManifestEntry[];
  summary: {
    total: number;
    withHashes: number;
    withoutHashes: number;
  };
}

export interface ArtifactIntegrityOptions {
  custodyNotes?: string;
  createdAtIso?: string;
}

function normalizeHashAlgorithm(hash: string): string {
  const normalized = hash.trim().toLowerCase();
  if (/^[a-f0-9]{32}$/i.test(normalized)) return "md5";
  if (/^[a-f0-9]{40}$/i.test(normalized)) return "sha1";
  if (/^[a-f0-9]{64}$/i.test(normalized)) return "sha256";
  if (/^[a-f0-9]{128}$/i.test(normalized)) return "sha512";
  return "unknown";
}

function parseManifestLine(line: string, collectedAt: string): ArtifactManifestEntry | null {
  const csvParts = line.split(",").map((part) => part.trim()).filter(Boolean);
  if (csvParts.length >= 2) {
    const artifact = csvParts[0];
    const hashes: Record<string, string> = {};
    for (let index = 1; index < csvParts.length; index += 1) {
      const value = csvParts[index];
      if (value.includes(":")) {
        const [algorithm, hash] = value.split(":");
        hashes[algorithm.trim().toLowerCase()] = hash.trim();
      } else {
        const algorithm = normalizeHashAlgorithm(value);
        hashes[algorithm] = value;
      }
    }
    return { artifact, hashes, collectedAt };
  }

  const whitespace = line.split(/\s+/).filter(Boolean);
  if (whitespace.length >= 2) {
    const [artifact, ...hashTokens] = whitespace;
    const hashes: Record<string, string> = {};
    hashTokens.forEach((token) => {
      const algorithm = normalizeHashAlgorithm(token);
      hashes[algorithm] = token;
    });
    return { artifact, hashes, collectedAt };
  }

  return null;
}

function normalizeCustodyNotes(notes: string | undefined): string[] {
  if (!notes) return [];
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildArtifactIntegrityPackage(
  input: string,
  options: ArtifactIntegrityOptions = {},
): ArtifactIntegrityPackage {
  const createdAt = options.createdAtIso && !Number.isNaN(new Date(options.createdAtIso).getTime())
    ? new Date(options.createdAtIso).toISOString()
    : new Date().toISOString();
  const chainOfCustody = normalizeCustodyNotes(options.custodyNotes);

  const manifest = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseManifestLine(line, createdAt))
    .filter((entry): entry is ArtifactManifestEntry => !!entry);

  const fingerprintPayload = JSON.stringify({
    createdAt,
    chainOfCustody,
    manifest,
  });
  const packageId = CryptoJS.SHA256(fingerprintPayload).toString(CryptoJS.enc.Hex).slice(0, 32);

  return {
    packageId,
    createdAt,
    chainOfCustody,
    manifest,
    summary: {
      total: manifest.length,
      withHashes: manifest.filter((entry) => Object.keys(entry.hashes).length > 0).length,
      withoutHashes: manifest.filter((entry) => Object.keys(entry.hashes).length === 0).length,
    },
  };
}
