/** Phase one of IA-2. Inputs come from the calling club's authorized account projection. */
export interface CandidateAccount {
  clubId: string;
  accountId: string;
  names: readonly string[];
  confirmedAliases: readonly string[];
  openDebtCents: bigint;
}

interface Transfer {
  clubId: string;
  description: string;
  amountCents: bigint;
}

type Review =
  | { kind: "manual" }
  | { kind: "confirm-alias"; accountId: string }
  | { kind: "shortlist"; candidates: { accountId: string; nameMatches: number; exactDebt: boolean }[] };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function prepareTransferReview(transfer: Transfer, accounts: readonly CandidateAccount[]): Review {
  const description = normalize(transfer.description);
  if (!transfer.clubId.trim() || transfer.amountCents <= 0n) return { kind: "manual" };
  const local = accounts.filter(account => account.clubId === transfer.clubId);
  if (local.some(account => !account.accountId.trim()) ||
      new Set(local.map(account => account.accountId)).size !== local.length) return { kind: "manual" };

  const aliases = local.filter(account =>
    description && account.confirmedAliases.some(alias => normalize(alias) === description));
  if (aliases.length === 1) return { kind: "confirm-alias", accountId: aliases[0].accountId };
  if (aliases.length > 1) return { kind: "manual" };

  const words = new Set(description.split(" "));
  const candidates = local.map(account => {
    let nameMatches = 0;
    for (const name of account.names) {
      const tokens = new Set(normalize(name).split(" ").filter(word => word.length >= 3));
      const matches = [...tokens].filter(word => words.has(word)).length;
      nameMatches = Math.max(nameMatches, matches);
    }
    return { accountId: account.accountId, nameMatches, exactDebt: account.openDebtCents === transfer.amountCents };
  }).filter(candidate => candidate.nameMatches > 0 || candidate.exactDebt);

  type Candidate = (typeof candidates)[number];
  const compareEvidence = (a: Candidate, b: Candidate) =>
    b.nameMatches - a.nameMatches || Number(b.exactDebt) - Number(a.exactDebt);
  candidates.sort((a, b) => compareEvidence(a, b) || (a.accountId < b.accountId ? -1 : 1));
  // Truncating a tie at the boundary would conceal equally plausible accounts.
  if (!candidates.length || (candidates.length > 5 && compareEvidence(candidates[4], candidates[5]) === 0)) {
    return { kind: "manual" };
  }
  return { kind: "shortlist", candidates: candidates.slice(0, 5) };
}
