/**
 * tournaments.ts — Bracket generation & standings logic
 *
 * Uses crypto.randomUUID() for IDs to avoid uid() collision on bulk generation.
 */

import type { Tournament, TournamentMatch, TournamentParticipant } from "@/lib/supabase";

// ── Single Elimination ────────────────────────────────────────────────────────

/**
 * Generates a full single-elimination bracket.
 * - Pads participants to the next power of 2 with bye slots.
 * - Byes are auto-resolved immediately (isByeMatch = true).
 * - Returns all matches across all rounds (empty matches for future rounds).
 */
export function generateSingleEliminationBracket(
  participants: TournamentParticipant[],
): TournamentMatch[] {
  const real = participants.filter((p) => !p.isBye);
  const size = nextPowerOf2(real.length);
  const byeCount = size - real.length;

  // Build seeded list: seed 1 vs last, 2 vs second-last (standard bracket seeding)
  const seeded = [...real].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const byes: TournamentParticipant[] = Array.from({ length: byeCount }, (_, i) => ({
    id: `bye-${i + 1}`,
    name: "BYE",
    isTeam: false,
    isBye: true,
    status: "registered" as const,
    entryPaid: true,
  }));

  // Interleave: [seed1, bye, seed2, bye...] using standard bracket seeding
  const slotted = buildSeededSlots(seeded, byes, size);

  const matches: TournamentMatch[] = [];
  const totalRounds = Math.log2(size);

  // Round 1: pair slotted participants
  for (let i = 0; i < size; i += 2) {
    const p1 = slotted[i];
    const p2 = slotted[i + 1];
    const isBye = p1?.isBye || p2?.isBye;
    const winnerId = p1?.isBye ? (p2?.id ?? null) : p2?.isBye ? (p1?.id ?? null) : null;

    matches.push({
      id: crypto.randomUUID(),
      round: 1,
      matchNumber: i / 2 + 1,
      participant1Id: p1?.isBye ? null : (p1?.id ?? null),
      participant2Id: p2?.isBye ? null : (p2?.id ?? null),
      score1: null,
      score2: null,
      winnerId,
      isByeMatch: isBye,
      location: undefined,
      status: isBye ? "completed" : "pending",
      startTime: null,
      endTime: null,
    });
  }

  // Future rounds: empty placeholder matches
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round);
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: crypto.randomUUID(),
        round,
        matchNumber: i + 1,
        participant1Id: null,
        participant2Id: null,
        score1: null,
        score2: null,
        winnerId: null,
        isByeMatch: false,
        location: undefined,
        status: "pending",
        startTime: null,
        endTime: null,
      });
    }
  }

  return matches;
}

/**
 * After a match is completed, advance the winner to the next round's slot.
 * Returns the updated matches array.
 */
export function advanceWinner(
  matches: TournamentMatch[],
  completedMatchId: string,
): TournamentMatch[] {
  const completed = matches.find((m) => m.id === completedMatchId);
  if (!completed || !completed.winnerId) return matches;

  const nextRound = completed.round + 1;
  // Which slot in the next round? Odd matchNumber → slot 1, Even → slot 2
  const nextMatchNumber = Math.ceil(completed.matchNumber / 2);
  const isFirstSlot = completed.matchNumber % 2 !== 0;

  return matches.map((m) => {
    if (m.round === nextRound && m.matchNumber === nextMatchNumber) {
      return {
        ...m,
        participant1Id: isFirstSlot ? completed.winnerId : m.participant1Id,
        participant2Id: isFirstSlot ? m.participant2Id : completed.winnerId,
      };
    }
    return m;
  });
}

// ── Round Robin ───────────────────────────────────────────────────────────────

/**
 * Generates a full round-robin schedule using the circle (berger) method.
 * Each participant plays against every other participant exactly once.
 */
export function generateRoundRobinSchedule(
  participants: TournamentParticipant[],
): TournamentMatch[] {
  const real = participants.filter((p) => !p.isBye);
  const n = real.length;
  if (n < 2) return [];

  // Add ghost if odd number (ghost never appears in UI)
  const list = n % 2 === 0 ? [...real] : [...real, { id: "__ghost__", name: "BYE", isTeam: false, isBye: true, status: "registered" as const, entryPaid: true }];
  const total = list.length; // always even now
  const rounds = total - 1;
  const matchesPerRound = total / 2;

  const matches: TournamentMatch[] = [];
  let matchNumber = 1;

  // Circle method: fix first element, rotate the rest
  const circle = [...list];

  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const p1 = circle[i];
      const p2 = circle[total - 1 - i];
      const isBye = p1.isBye || p2.isBye || p1.id === "__ghost__" || p2.id === "__ghost__";

      matches.push({
        id: crypto.randomUUID(),
        round,
        matchNumber: matchNumber++,
        participant1Id: (p1.isBye || p1.id === "__ghost__") ? null : p1.id,
        participant2Id: (p2.isBye || p2.id === "__ghost__") ? null : p2.id,
        score1: null,
        score2: null,
        winnerId: null,
        isByeMatch: isBye,
        location: undefined,
        status: isBye ? "completed" : "pending",
        startTime: null,
        endTime: null,
      });
    }

    // Rotate: keep circle[0] fixed, rotate the rest
    const last = circle[circle.length - 1];
    circle.splice(1, 0, last);
    circle.pop();
  }

  return matches;
}

// ── Standings ─────────────────────────────────────────────────────────────────

export interface StandingsRow {
  participantId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

export function calcRoundRobinStandings(tournament: Tournament): StandingsRow[] {
  const { participants, matches } = tournament;
  const real = participants.filter((p) => !p.isBye);

  const rows: Record<string, StandingsRow> = {};
  for (const p of real) {
    rows[p.id] = {
      participantId: p.id,
      name: p.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
    };
  }

  for (const m of matches) {
    if (m.status !== "completed" || m.isByeMatch) continue;
    if (!m.participant1Id || !m.participant2Id) continue;
    const r1 = rows[m.participant1Id];
    const r2 = rows[m.participant2Id];
    if (!r1 || !r2) continue;

    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;

    r1.played++;
    r2.played++;
    r1.goalsFor += s1;
    r1.goalsAgainst += s2;
    r2.goalsFor += s2;
    r2.goalsAgainst += s1;

    if (s1 > s2) {
      r1.wins++;
      r1.points += 3;
      r2.losses++;
    } else if (s2 > s1) {
      r2.wins++;
      r2.points += 3;
      r1.losses++;
    } else {
      r1.draws++;
      r1.points += 1;
      r2.draws++;
      r2.points += 1;
    }
  }

  for (const row of Object.values(rows)) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  return Object.values(rows).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard bracket seeding: places top seeds so they meet as late as possible.
 * Seat 1 vs last, 2 vs second-last, etc.
 */
function buildSeededSlots(
  seeded: TournamentParticipant[],
  byes: TournamentParticipant[],
  size: number,
): TournamentParticipant[] {
  // Place byes at the bottom of the bracket (last positions)
  const slots: TournamentParticipant[] = new Array(size);
  const byePositions = new Set<number>();

  // Last `byeCount` positions get byes
  for (let i = size - byes.length; i < size; i++) {
    byePositions.add(i);
  }

  let seedIdx = 0;
  let byeIdx = 0;
  for (let i = 0; i < size; i++) {
    if (byePositions.has(i)) {
      slots[i] = byes[byeIdx++];
    } else {
      slots[i] = seeded[seedIdx++];
    }
  }

  return slots;
}

export function getRoundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "النهائي";
  if (fromEnd === 1) return "نصف النهائي";
  if (fromEnd === 2) return "ربع النهائي";
  return `الجولة ${round}`;
}
