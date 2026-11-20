import { describe, expect, it } from "vitest";
import { CandidateAccount, prepareTransferReview } from "./transfer-review";

const transfer = { clubId: "a", description: "TRANSF de J Pérez", amountCents: 1500000n };
const account = (id: string, overrides: Partial<CandidateAccount> = {}): CandidateAccount => ({
  accountId: id, clubId: "a", names: [], confirmedAliases: [], openDebtCents: 0n, ...overrides,
});

describe("prepareTransferReview", () => {
  it("requires human confirmation for a previously confirmed alias in this club", () => {
    const alias = { confirmedAliases: ["transf DE j-perez"] };
    expect(prepareTransferReview(transfer, [account("x", { ...alias, clubId: "b" }), account("y", alias)]))
      .toEqual({ kind: "confirm-alias", accountId: "y" });
    expect(prepareTransferReview(transfer, [account("x", alias), account("y", alias)])).toEqual({ kind: "manual" });
  });

  it("ranks name and exact amount signals and excludes other clubs", () => {
    expect(prepareTransferReview(transfer, [
      account("z", { openDebtCents: transfer.amountCents }), account("p", { names: ["José Pérez"] }),
      account("q", { names: ["Ana Perez"], openDebtCents: transfer.amountCents }),
      account("b", { clubId: "b", names: ["José Pérez"] }),
    ])).toEqual({ kind: "shortlist", candidates: [
      { accountId: "q", nameMatches: 1, exactDebt: true }, { accountId: "p", nameMatches: 1, exactDebt: false },
      { accountId: "z", nameMatches: 0, exactDebt: true },
    ] });
  });

  it("preserves manual review for no evidence, ambiguous cutoff and invalid inputs", () => {
    const six = Array.from({ length: 6 }, (_, i) => account(String(i), { openDebtCents: transfer.amountCents }));
    for (const accounts of [[], six, [six[0], six[0]]]) {
      expect(prepareTransferReview(transfer, accounts)).toEqual({ kind: "manual" });
    }
    expect(prepareTransferReview({ ...transfer, amountCents: 0n }, six)).toEqual({ kind: "manual" });
  });

  it("keeps five candidates when the cutoff distinguishes the sixth", () => {
    const first = Array.from({ length: 5 }, (_, i) => account(String(i), { names: ["Pérez"] }));
    const review = prepareTransferReview(transfer, [...first, account("6", { openDebtCents: transfer.amountCents })]);
    expect(review.kind === "shortlist" && review.candidates.map(item => item.accountId)).toEqual(["0","1","2","3","4"]);
  });
});
