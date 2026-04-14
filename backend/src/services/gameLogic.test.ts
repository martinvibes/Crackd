import { describe, expect, it } from "vitest";
import {
  CODE_LENGTH,
  checkGameOver,
  computeGuessResult,
  createInitialState,
  getGuessCount,
  getGuessesFor,
  getPlayerAddress,
  isCrack,
  otherSlot,
  redactForPlayer,
  validateCode,
} from "./gameLogic.js";
import type { GameState, Guess } from "../types/game.js";

// ------------------------------ validateCode ------------------------------

describe("validateCode", () => {
  it.each([
    ["5831", true],
    ["0123", true],
    ["9876", true],
  ])("accepts valid code %s", (code, ok) => {
    expect(validateCode(code)).toBe(ok);
  });

  it.each([
    ["", "empty"],
    ["1", "too short"],
    ["12345", "too long"],
    ["5531", "repeats"],
    ["1234a", "wrong length + non-digit"],
    ["abcd", "non-digits"],
    ["12 3", "space"],
    ["12.3", "dot"],
    ["1233", "trailing repeat"],
  ])("rejects invalid code %s (%s)", (code) => {
    expect(validateCode(code)).toBe(false);
  });

  it("rejects non-strings", () => {
    // @ts-expect-error — purposeful runtime check
    expect(validateCode(undefined)).toBe(false);
    // @ts-expect-error
    expect(validateCode(1234)).toBe(false);
    // @ts-expect-error
    expect(validateCode(null)).toBe(false);
  });
});

// ------------------------------ computeGuessResult ------------------------------

describe("computeGuessResult", () => {
  it("example from the brief: 5831 vs 5294 → 1 pot, 0 pan", () => {
    expect(computeGuessResult("5831", "5294")).toEqual({ pots: 1, pans: 0 });
  });

  it("5831 vs 5813 → 2 pots (5,1) and 2 pans (8,3)", () => {
    expect(computeGuessResult("5831", "5813")).toEqual({ pots: 2, pans: 2 });
  });

  it("crack: 5831 vs 5831 → 4 pots", () => {
    expect(computeGuessResult("5831", "5831")).toEqual({ pots: 4, pans: 0 });
  });

  it("completely wrong: 5831 vs 0246 → 0,0", () => {
    expect(computeGuessResult("5831", "0246")).toEqual({ pots: 0, pans: 0 });
  });

  it("all pans, no pots: 1234 vs 4321 → 0 pots, 4 pans", () => {
    expect(computeGuessResult("1234", "4321")).toEqual({ pots: 0, pans: 4 });
  });

  it("one repeated digit in guess — but validateCode rejects it first", () => {
    // Invalid guess (repeats) should return {0,0} not throw.
    expect(computeGuessResult("5831", "5511")).toEqual({ pots: 0, pans: 0 });
  });

  it("secret and guess totally disjoint digit sets", () => {
    expect(computeGuessResult("0123", "4567")).toEqual({ pots: 0, pans: 0 });
  });

  it("all digits present but shifted by one", () => {
    expect(computeGuessResult("1234", "2341")).toEqual({ pots: 0, pans: 4 });
  });
});

// ------------------------------ isCrack ------------------------------

describe("isCrack", () => {
  it("is true only when all positions match", () => {
    expect(isCrack({ pots: CODE_LENGTH, pans: 0 })).toBe(true);
    expect(isCrack({ pots: 3, pans: 1 })).toBe(false);
    expect(isCrack({ pots: 0, pans: 4 })).toBe(false);
  });
});

// ------------------------------ createInitialState ------------------------------

describe("createInitialState", () => {
  it("populates required fields with defaults", () => {
    const s = createInitialState({
      gameId: "abc",
      mode: "pvp_casual",
      playerOne: "G1",
    });
    expect(s.gameId).toBe("abc");
    expect(s.playerTwo).toBeNull();
    expect(s.playerOneGuesses).toEqual([]);
    expect(s.playerTwoGuesses).toEqual([]);
    expect(s.status).toBe("lobby");
    expect(s.maxGuesses).toBe(10);
    expect(s.stakeAmount).toBe(0);
    expect(s.contractGameId).toBeNull();
    expect(s.currentTurn).toBe("playerOne");
    expect(s.winner).toBeNull();
    expect(s.isDraw).toBe(false);
    expect(s.createdAt).toBeTypeOf("number");
  });

  it("carries staked fields through", () => {
    const s = createInitialState({
      gameId: "g",
      mode: "pvp_staked",
      playerOne: "G1",
      stakeAmount: 50_000_000,
      contractGameId: "abc123",
    });
    expect(s.stakeAmount).toBe(50_000_000);
    expect(s.contractGameId).toBe("abc123");
  });
});

// ------------------------------ helpers ------------------------------

describe("slot helpers", () => {
  it("otherSlot flips", () => {
    expect(otherSlot("playerOne")).toBe("playerTwo");
    expect(otherSlot("playerTwo")).toBe("playerOne");
  });

  it("getPlayerAddress + getGuessCount + getGuessesFor", () => {
    const base = createInitialState({
      gameId: "g",
      mode: "pvp_casual",
      playerOne: "A",
    });
    base.playerTwo = "B";
    const g: Guess = {
      code: "1234",
      result: { pots: 1, pans: 1 },
      timestamp: 1,
    };
    base.playerOneGuesses.push(g);
    expect(getPlayerAddress(base, "playerOne")).toBe("A");
    expect(getPlayerAddress(base, "playerTwo")).toBe("B");
    expect(getGuessCount(base, "playerOne")).toBe(1);
    expect(getGuessCount(base, "playerTwo")).toBe(0);
    expect(getGuessesFor(base, "playerOne")[0]).toBe(g);
  });
});

// ------------------------------ checkGameOver ------------------------------

function baseState(): GameState {
  const s = createInitialState({
    gameId: "g",
    mode: "pvp_casual",
    playerOne: "A",
  });
  s.playerTwo = "B";
  s.status = "active";
  return s;
}

describe("checkGameOver", () => {
  it("returns null when no winner and guesses remain", () => {
    const s = baseState();
    s.playerOneGuesses.push({
      code: "1234",
      result: { pots: 2, pans: 1 },
      timestamp: 1,
    });
    expect(checkGameOver(s)).toBeNull();
  });

  it("player one wins on crack", () => {
    const s = baseState();
    s.playerOneGuesses.push({
      code: "1234",
      result: { pots: 4, pans: 0 },
      timestamp: 1,
    });
    expect(checkGameOver(s)).toEqual({
      winner: "A",
      isDraw: false,
      winningSlot: "playerOne",
    });
  });

  it("player two wins on crack", () => {
    const s = baseState();
    s.playerTwoGuesses.push({
      code: "9876",
      result: { pots: 4, pans: 0 },
      timestamp: 1,
    });
    expect(checkGameOver(s)).toEqual({
      winner: "B",
      isDraw: false,
      winningSlot: "playerTwo",
    });
  });

  it("simultaneous crack is a draw", () => {
    const s = baseState();
    const crack: Guess = {
      code: "1234",
      result: { pots: 4, pans: 0 },
      timestamp: 1,
    };
    s.playerOneGuesses.push(crack);
    s.playerTwoGuesses.push(crack);
    expect(checkGameOver(s)).toEqual({
      winner: null,
      isDraw: true,
      winningSlot: null,
    });
  });

  it("both players out of guesses without cracking → draw", () => {
    const s = baseState();
    const miss: Guess = {
      code: "1234",
      result: { pots: 1, pans: 0 },
      timestamp: 1,
    };
    for (let i = 0; i < 10; i++) {
      s.playerOneGuesses.push(miss);
      s.playerTwoGuesses.push(miss);
    }
    expect(checkGameOver(s)).toEqual({
      winner: null,
      isDraw: true,
      winningSlot: null,
    });
  });

  it("one player out of guesses but the other still has some → continues", () => {
    const s = baseState();
    const miss: Guess = {
      code: "1234",
      result: { pots: 1, pans: 0 },
      timestamp: 1,
    };
    for (let i = 0; i < 10; i++) s.playerOneGuesses.push(miss);
    s.playerTwoGuesses.push(miss); // only 1
    expect(checkGameOver(s)).toBeNull();
  });
});

// ------------------------------ redactForPlayer ------------------------------

describe("redactForPlayer", () => {
  it("redacts opponent's guess codes while game is live", () => {
    const s = baseState();
    s.playerOneCode = "1234";
    s.playerTwoCode = "5678";
    s.playerOneGuesses.push({
      code: "9012",
      result: { pots: 0, pans: 1 },
      timestamp: 1,
    });
    s.playerTwoGuesses.push({
      code: "0987",
      result: { pots: 2, pans: 0 },
      timestamp: 2,
    });
    const view = redactForPlayer(s, "playerOne");
    expect(view.yourCode).toBe("1234");
    expect(view.opponentCodeSet).toBe(true);
    expect(view.yourGuesses[0]!.code).toBe("9012");
    expect((view.opponentGuesses[0] as Guess).code).toBeUndefined();
    expect(view.opponentGuesses[0]!.result.pots).toBe(2);
  });

  it("after game ends, opponent guesses include codes too", () => {
    const s = baseState();
    s.status = "finished";
    s.playerOneCode = "1234";
    s.playerTwoCode = "5678";
    s.playerTwoGuesses.push({
      code: "1234",
      result: { pots: 4, pans: 0 },
      timestamp: 1,
    });
    const view = redactForPlayer(s, "playerOne");
    expect((view.opponentGuesses[0] as Guess).code).toBe("1234");
  });

  it("opponentCodeSet reflects the opponent's secret, not own", () => {
    const s = baseState();
    s.playerOneCode = "1234";
    // player two hasn't set yet
    const view = redactForPlayer(s, "playerOne");
    expect(view.opponentCodeSet).toBe(false);
  });
});
