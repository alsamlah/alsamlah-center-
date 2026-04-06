"use client";

import React, { useState } from "react";
import type { Tournament, TournamentParticipant, TournamentMatch, TournamentType, TournamentFormat, UserRole } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import {
  generateSingleEliminationBracket,
  generateRoundRobinSchedule,
  advanceWinner,
  calcRoundRobinStandings,
  getRoundName,
} from "@/lib/tournaments";
import SarSymbol from "@/components/SarSymbol";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  tournaments: Tournament[];
  onUpsert: (t: Tournament) => void;
  onCancel: (id: string) => void;
  settings: SystemSettings;
  role: UserRole;
  notify: (msg: string) => void;
}

const TYPE_ICONS: Record<TournamentType, string> = {
  ps: "🎮", billiard: "🎱", chess: "♟️", tennis: "🏓", baloot: "🃏", other: "🏆",
};

const STATUS_COLORS: Record<string, string> = {
  registration: "var(--blue)",
  active: "var(--green)",
  completed: "var(--text2)",
  cancelled: "var(--red)",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function TournamentsView({ tournaments, onUpsert, onCancel, settings, role, notify }: Props) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";

  const [tab, setTab] = useState<"active" | "completed" | "all">("active");
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Keep selected in sync with the latest data from parent
  const liveSelected = selected ? tournaments.find((tr) => tr.id === selected.id) ?? selected : null;

  const filtered = tournaments.filter((tr) => {
    if (tab === "active") return tr.status === "registration" || tr.status === "active";
    if (tab === "completed") return tr.status === "completed" || tr.status === "cancelled";
    return true;
  });

  if (liveSelected) {
    return (
      <TournamentDetail
        tournament={liveSelected}
        onUpdate={onUpsert}
        onCancel={(id) => { onCancel(id); setSelected(null); }}
        onBack={() => setSelected(null)}
        settings={settings}
        role={role}
        notify={notify}
      />
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ padding: "1rem", maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>🏆 {t.tournaments}</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + {t.addTournament}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["active", "completed", "all"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: 8,
              border: "1.5px solid",
              borderColor: tab === tb ? "var(--accent)" : "var(--border)",
              background: tab === tb ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
              color: tab === tb ? "var(--accent)" : "var(--text2)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: tab === tb ? 600 : 400,
            }}
          >
            {tb === "active" ? t.activeTournaments : tb === "completed" ? t.completedTournaments : t.allTournaments}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text2)", padding: "3rem 0" }}>
          🏆 {t.noTournaments}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map((tour) => (
            <TournamentCard
              key={tour.id}
              tournament={tour}
              onClick={() => setSelected(tour)}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateTournamentModal
          onClose={() => setShowCreate(false)}
          onCreate={(tour) => { onUpsert(tour); setShowCreate(false); setSelected(tour); notify(t.addTournament); }}
          settings={settings}
          role={role}
        />
      )}
    </div>
  );
}

// ── Tournament Card ───────────────────────────────────────────────────────────

function TournamentCard({ tournament: tour, onClick, t }: {
  tournament: Tournament;
  onClick: () => void;
  t: Record<string, string>;
}) {
  const real = tour.participants.filter((p) => !p.isBye);
  const paid = real.filter((p) => p.entryPaid).length;
  const statusColor = STATUS_COLORS[tour.status] ?? "var(--text2)";

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: "pointer", padding: "1rem", transition: "opacity 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.6rem" }}>{TYPE_ICONS[tour.type]}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{tour.name}</div>
            <div style={{ color: "var(--text2)", fontSize: "0.8rem", marginTop: 2 }}>
              {tour.format === "single-elimination" ? t.singleElim : t.roundRobin}
              {tour.entryFee > 0 && (
                <span style={{ marginInlineStart: "0.5rem" }}>
                  · {tour.entryFee} <SarSymbol size={11} />
                </span>
              )}
              {tour.prizePool && <span style={{ marginInlineStart: "0.5rem" }}>· 🏅 {tour.prizePool}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="badge" style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor, border: `1px solid ${statusColor}` }}>
            {tour.status === "registration" ? t.registrationOpen
              : tour.status === "active" ? t.activeTournaments
              : tour.status === "completed" ? t.completedTournaments
              : t.cancelTournament}
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
            {real.length}/{tour.maxParticipants} {t.participantCount}
            {tour.entryFee > 0 && ` · ${paid} ${t.paidCount}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Tournament Detail ─────────────────────────────────────────────────────────

function TournamentDetail({ tournament, onUpdate, onCancel, onBack, settings, role, notify }: {
  tournament: Tournament;
  onUpdate: (t: Tournament) => void;
  onCancel: (id: string) => void;
  onBack: () => void;
  settings: SystemSettings;
  role: UserRole;
  notify: (msg: string) => void;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const [detailTab, setDetailTab] = useState<"participants" | "matches" | "results">("participants");

  const real = tournament.participants.filter((p) => !p.isBye);
  const canStart = tournament.status === "registration" && real.length >= 2;
  const isActive = tournament.status === "active";
  const isCompleted = tournament.status === "completed";
  const statusColor = STATUS_COLORS[tournament.status] ?? "var(--text2)";

  function startTournament() {
    const matches = tournament.format === "single-elimination"
      ? generateSingleEliminationBracket(real)
      : generateRoundRobinSchedule(real);
    onUpdate({ ...tournament, status: "active", startedAt: Date.now(), matches });
    notify(t.startTournament);
    setDetailTab("matches");
  }

  function completeTournament() {
    // Determine winner from last round (single-elim) or standings (round-robin)
    let winnerId = tournament.winnerId;
    if (!winnerId && tournament.format === "round-robin") {
      const standings = calcRoundRobinStandings(tournament);
      winnerId = standings[0]?.participantId ?? null;
    }
    onUpdate({ ...tournament, status: "completed", completedAt: Date.now(), winnerId: winnerId ?? null });
    notify(t.completeTournament);
    setDetailTab("results");
  }

  function updateMatch(updated: TournamentMatch) {
    let matches = tournament.matches.map((m) => m.id === updated.id ? updated : m);
    if (updated.winnerId && tournament.format === "single-elimination") {
      matches = advanceWinner(matches, updated.id);
    }
    // Check if all real matches are done — auto-set winner for single-elim
    let winnerId = tournament.winnerId;
    if (tournament.format === "single-elimination" && updated.winnerId) {
      const maxRound = Math.max(...matches.map((m) => m.round));
      const finalMatch = matches.find((m) => m.round === maxRound && !m.isByeMatch);
      if (finalMatch?.winnerId) winnerId = finalMatch.winnerId;
    }
    onUpdate({ ...tournament, matches, winnerId: winnerId ?? null });
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ padding: "1rem", maxWidth: 700, margin: "0 auto" }}>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: "0.3rem 0.7rem" }}>
          {isRTL ? "→" : "←"} {t.back}
        </button>
        <span style={{ fontSize: "1.4rem" }}>{TYPE_ICONS[tournament.type]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{tournament.name}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
            {tournament.format === "single-elimination" ? t.singleElim : t.roundRobin}
            {tournament.prizePool ? ` · 🏅 ${tournament.prizePool}` : ""}
          </div>
        </div>
        <span className="badge" style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor, border: `1px solid ${statusColor}` }}>
          {tournament.status === "registration" ? t.registrationOpen
            : tournament.status === "active" ? t.activeTournaments
            : tournament.status === "completed" ? t.completedTournaments
            : t.cancelTournament}
        </span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1.5px solid var(--border)", paddingBottom: "0.5rem" }}>
        {(["participants", "matches", "results"] as const).map((tb) => (
          <button key={tb} onClick={() => setDetailTab(tb)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "0.35rem 0.75rem", borderRadius: 8,
            fontWeight: detailTab === tb ? 700 : 400,
            color: detailTab === tb ? "var(--accent)" : "var(--text2)",
            borderBottom: detailTab === tb ? "2px solid var(--accent)" : "2px solid transparent",
            fontSize: "0.9rem",
          }}>
            {tb === "participants" ? `👥 ${t.participantCount}` : tb === "matches" ? `⚔️ ${t.matchWord}` : `🏆 ${t.standings}`}
          </button>
        ))}
      </div>

      {detailTab === "participants" && (
        <ParticipantsTab
          tournament={tournament}
          onUpdate={onUpdate}
          settings={settings}
          onStart={canStart ? startTournament : undefined}
          notify={notify}
        />
      )}

      {detailTab === "matches" && (
        <MatchesTab
          tournament={tournament}
          onUpdateMatch={updateMatch}
          settings={settings}
        />
      )}

      {detailTab === "results" && (
        <ResultsTab tournament={tournament} settings={settings} />
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
        {isActive && (
          <button className="btn btn-success" onClick={completeTournament}>
            ✅ {t.completeTournament}
          </button>
        )}
        {tournament.status !== "completed" && tournament.status !== "cancelled" && role === "manager" && (
          <button
            className="btn btn-danger"
            style={{ fontSize: "0.82rem" }}
            onClick={() => { if (confirm(t.confirmCancel)) onCancel(tournament.id); }}
          >
            ✕ {t.cancelTournament}
          </button>
        )}
        {isCompleted && (
          <button className="btn" onClick={() => printBracket(tournament, settings)}>
            🖨️ {t.printBracket}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Participants Tab ──────────────────────────────────────────────────────────

function ParticipantsTab({ tournament, onUpdate, settings, onStart, notify }: {
  tournament: Tournament;
  onUpdate: (t: Tournament) => void;
  settings: SystemSettings;
  onStart?: () => void;
  notify: (msg: string) => void;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isTeam, setIsTeam] = useState(false);
  const [teamMembers, setTeamMembers] = useState("");
  const [entryPaid, setEntryPaid] = useState(tournament.entryFee === 0);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "transfer">("cash");

  const real = tournament.participants.filter((p) => !p.isBye);
  const isFull = real.length >= tournament.maxParticipants;
  const isRegistration = tournament.status === "registration";

  function addParticipant() {
    if (!name.trim()) return;
    const p: TournamentParticipant = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim() || undefined,
      isTeam,
      teamMembers: isTeam ? teamMembers.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      status: "registered",
      entryPaid,
      entryPayMethod: (entryPaid && tournament.entryFee > 0) ? payMethod : undefined,
      entryPaidAt: (entryPaid && tournament.entryFee > 0) ? Date.now() : undefined,
    };
    onUpdate({ ...tournament, participants: [...tournament.participants, p] });
    setName(""); setPhone(""); setTeamMembers(""); setIsTeam(false); setEntryPaid(tournament.entryFee === 0);
    notify(t.addParticipant);
  }

  function toggleCheckIn(id: string) {
    onUpdate({
      ...tournament,
      participants: tournament.participants.map((p) =>
        p.id === id ? { ...p, status: p.status === "checked-in" ? "registered" : "checked-in" } : p
      ),
    });
  }

  function togglePaid(id: string) {
    onUpdate({
      ...tournament,
      participants: tournament.participants.map((p) =>
        p.id === id ? { ...p, entryPaid: !p.entryPaid, entryPaidAt: Date.now() } : p
      ),
    });
  }

  function removeParticipant(id: string) {
    if (!isRegistration) return;
    onUpdate({ ...tournament, participants: tournament.participants.filter((p) => p.id !== id) });
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Add form */}
      {isRegistration && !isFull && (
        <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <input
              className="input"
              placeholder={isTeam ? t.teamName : t.custName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addParticipant()}
            />
            <input
              className="input"
              placeholder={t.phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.6rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={isTeam} onChange={(e) => setIsTeam(e.target.checked)} />
              {t.isTeam}
            </label>
            {tournament.entryFee > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={entryPaid} onChange={(e) => setEntryPaid(e.target.checked)} />
                {t.entryPaid} ({tournament.entryFee} <SarSymbol size={11} />)
              </label>
            )}
            {entryPaid && tournament.entryFee > 0 && (
              <select className="input" style={{ width: "auto" }} value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}>
                <option value="cash">{t.cash}</option>
                <option value="card">{t.card}</option>
                <option value="transfer">{t.transfer}</option>
              </select>
            )}
          </div>

          {isTeam && (
            <input
              className="input"
              style={{ marginTop: "0.6rem" }}
              placeholder={`${t.teamMembers} (${isRTL ? "مفصولة بفاصلة" : "comma separated"})`}
              value={teamMembers}
              onChange={(e) => setTeamMembers(e.target.value)}
            />
          )}

          <button className="btn btn-primary" style={{ marginTop: "0.75rem", width: "100%" }} onClick={addParticipant} disabled={!name.trim()}>
            + {t.addParticipant}
          </button>
        </div>
      )}

      {isFull && isRegistration && (
        <div style={{ background: "color-mix(in srgb, var(--yellow) 12%, transparent)", border: "1px solid var(--yellow)", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "0.75rem", fontSize: "0.85rem", color: "var(--yellow)" }}>
          {t.maxParticipants}: {tournament.maxParticipants}
        </div>
      )}

      {/* Stats row */}
      {real.length > 0 && tournament.entryFee > 0 && (
        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", fontSize: "0.82rem", color: "var(--text2)" }}>
          <span>✅ {real.filter((p) => p.entryPaid).length} {t.paidCount}</span>
          <span>❌ {real.filter((p) => !p.entryPaid).length} {t.unpaidCount}</span>
          <span>💰 {real.filter((p) => p.entryPaid).length * tournament.entryFee} <SarSymbol size={10} /></span>
        </div>
      )}

      {/* Participant list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {real.map((p, i) => (
          <div key={p.id} className="card" style={{ padding: "0.6rem 0.85rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ color: "var(--text2)", fontSize: "0.8rem", minWidth: 20 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                {p.isTeam ? "👥 " : ""}{p.name}
              </div>
              {p.teamMembers && p.teamMembers.length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{p.teamMembers.join(" · ")}</div>
              )}
              {p.phone && <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{p.phone}</div>}
            </div>

            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              {tournament.entryFee > 0 && (
                <button
                  onClick={() => togglePaid(p.id)}
                  style={{
                    fontSize: "0.72rem", padding: "0.2rem 0.5rem", borderRadius: 6, border: "none",
                    background: p.entryPaid ? "color-mix(in srgb, var(--green) 15%, transparent)" : "color-mix(in srgb, var(--red) 12%, transparent)",
                    color: p.entryPaid ? "var(--green)" : "var(--red)",
                    cursor: "pointer",
                  }}
                >
                  {p.entryPaid ? `✓ ${t.entryPaid}` : t.entryUnpaid}
                </button>
              )}
              {isRegistration && (
                <button
                  onClick={() => toggleCheckIn(p.id)}
                  style={{
                    fontSize: "0.72rem", padding: "0.2rem 0.5rem", borderRadius: 6, cursor: "pointer",
                    background: p.status === "checked-in" ? "color-mix(in srgb, var(--green) 15%, transparent)" : "var(--surface)",
                    color: p.status === "checked-in" ? "var(--green)" : "var(--text2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {p.status === "checked-in" ? `✓ ${t.checkedIn}` : t.checkedIn}
                </button>
              )}
              {isRegistration && (
                <button onClick={() => removeParticipant(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "1rem", lineHeight: 1 }}>
                  ×
                </button>
              )}
              {!isRegistration && (
                <span className="badge" style={{ fontSize: "0.7rem" }}>
                  {p.status === "winner" ? "🏆" : p.status === "eliminated" ? "❌" : p.status === "disqualified" ? "🚫" : p.status === "checked-in" ? "✓" : ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {onStart && (
        <button className="btn btn-success" style={{ width: "100%", marginTop: "1.25rem", padding: "0.75rem" }} onClick={onStart}>
          ⚡ {t.generateBracket}
        </button>
      )}
    </div>
  );
}

// ── Matches Tab ───────────────────────────────────────────────────────────────

function MatchesTab({ tournament, onUpdateMatch, settings }: {
  tournament: Tournament;
  onUpdateMatch: (m: TournamentMatch) => void;
  settings: SystemSettings;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";

  if (tournament.status === "registration") {
    return (
      <div style={{ textAlign: "center", color: "var(--text2)", padding: "2rem 0" }}>
        {t.generateBracket}
      </div>
    );
  }

  const visibleMatches = tournament.matches.filter((m) => !m.isByeMatch);
  const rounds = [...new Set(visibleMatches.map((m) => m.round))].sort((a, b) => a - b);
  const totalRounds = rounds.length > 0 ? Math.max(...rounds) : 1;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {rounds.map((round) => (
        <div key={round}>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text2)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {tournament.format === "single-elimination"
              ? getRoundName(round, totalRounds)
              : `${t.round} ${round}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {visibleMatches.filter((m) => m.round === round).map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                tournament={tournament}
                onUpdate={onUpdateMatch}
                settings={settings}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

function MatchCard({ match, tournament, onUpdate, settings }: {
  match: TournamentMatch;
  tournament: Tournament;
  onUpdate: (m: TournamentMatch) => void;
  settings: SystemSettings;
}) {
  const t = T[settings.lang];
  const [score1, setScore1] = useState(match.score1?.toString() ?? "");
  const [score2, setScore2] = useState(match.score2?.toString() ?? "");
  const [location, setLocation] = useState(match.location ?? "");
  const [editing, setEditing] = useState(false);

  const p1 = tournament.participants.find((p) => p.id === match.participant1Id);
  const p2 = tournament.participants.find((p) => p.id === match.participant2Id);
  const isCompleted = match.status === "completed";
  const noPlayers = !match.participant1Id || !match.participant2Id;

  function saveScore(winnerId: string) {
    const s1 = parseInt(score1) || 0;
    const s2 = parseInt(score2) || 0;
    onUpdate({
      ...match,
      score1: s1,
      score2: s2,
      winnerId,
      status: "completed",
      startTime: match.startTime ?? Date.now(),
      endTime: Date.now(),
      location: location || undefined,
    });
    setEditing(false);
  }

  return (
    <div className="card" style={{
      padding: "0.75rem 1rem",
      opacity: noPlayers ? 0.5 : 1,
      borderColor: !noPlayers && !isCompleted ? "var(--accent)" : "var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: match.winnerId === p1?.id ? 700 : 400, color: match.winnerId === p1?.id ? "var(--green)" : "var(--text)" }}>
            {p1?.name ?? "—"}{match.winnerId === p1?.id ? " 🏆" : ""}
          </span>
        </div>
        <div style={{ textAlign: "center", minWidth: 60 }}>
          {isCompleted
            ? <span style={{ fontWeight: 700 }}>{match.score1 ?? 0} — {match.score2 ?? 0}</span>
            : <span style={{ color: "var(--text2)", fontSize: "0.85rem" }}>VS</span>}
        </div>
        <div style={{ flex: 1, textAlign: "end" }}>
          <span style={{ fontWeight: match.winnerId === p2?.id ? 700 : 400, color: match.winnerId === p2?.id ? "var(--green)" : "var(--text)" }}>
            {match.winnerId === p2?.id ? "🏆 " : ""}{p2?.name ?? "—"}
          </span>
        </div>
        {!noPlayers && (
          <button
            className="btn btn-ghost"
            style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
            onClick={() => { setScore1(match.score1?.toString() ?? ""); setScore2(match.score2?.toString() ?? ""); setEditing(!editing); }}
          >
            ✏️
          </button>
        )}
      </div>

      {match.location && !editing && (
        <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 4 }}>📍 {match.location}</div>
      )}

      {editing && !noPlayers && (
        <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <input className="input" placeholder={`📍 ${t.tLocation}`} value={location} onChange={(e) => setLocation(e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input className="input" type="number" min={0} placeholder={t.scoreP1} value={score1} onChange={(e) => setScore1(e.target.value)} style={{ flex: 1, textAlign: "center" }} />
            <span style={{ color: "var(--text2)" }}>—</span>
            <input className="input" type="number" min={0} placeholder={t.scoreP2} value={score2} onChange={(e) => setScore2(e.target.value)} style={{ flex: 1, textAlign: "center" }} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {p1 && <button className="btn btn-success" style={{ flex: 1, fontSize: "0.82rem" }} onClick={() => saveScore(p1.id)}>🏆 {p1.name}</button>}
            {p2 && <button className="btn btn-success" style={{ flex: 1, fontSize: "0.82rem" }} onClick={() => saveScore(p2.id)}>🏆 {p2.name}</button>}
          </div>
          <button className="btn btn-ghost" style={{ fontSize: "0.8rem" }} onClick={() => setEditing(false)}>{t.cancel}</button>
        </div>
      )}
    </div>
  );
}

// ── Results Tab ───────────────────────────────────────────────────────────────

function ResultsTab({ tournament, settings }: { tournament: Tournament; settings: SystemSettings }) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const winnerParticipant = tournament.participants.find((p) => p.id === tournament.winnerId);
  const isRoundRobin = tournament.format === "round-robin";
  const standings = isRoundRobin ? calcRoundRobinStandings(tournament) : null;
  const displayWinner = winnerParticipant ?? (standings?.[0] ? { name: standings[0].name } : null);

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {displayWinner && (
        <div style={{ background: "color-mix(in srgb, var(--yellow) 12%, transparent)", border: "2px solid var(--yellow)", borderRadius: 12, padding: "1.25rem", textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "2.5rem" }}>🏆</div>
          <div style={{ fontWeight: 800, fontSize: "1.3rem", marginTop: 4 }}>{displayWinner.name}</div>
          <div style={{ color: "var(--text2)", fontSize: "0.85rem", marginTop: 2 }}>{t.tournamentWinner}</div>
        </div>
      )}

      {isRoundRobin && standings && standings.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, marginBottom: "0.6rem" }}>📊 {t.standings}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "var(--surface)", color: "var(--text2)" }}>
                  <th style={{ padding: "0.5rem", textAlign: isRTL ? "right" : "left" }}>#</th>
                  <th style={{ padding: "0.5rem", textAlign: isRTL ? "right" : "left" }}>{t.custName}</th>
                  <th style={{ padding: "0.5rem", textAlign: "center" }}>م</th>
                  <th style={{ padding: "0.5rem", textAlign: "center" }}>ف</th>
                  <th style={{ padding: "0.5rem", textAlign: "center" }}>ت</th>
                  <th style={{ padding: "0.5rem", textAlign: "center" }}>خ</th>
                  <th style={{ padding: "0.5rem", textAlign: "center" }}>+/-</th>
                  <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 700 }}>نقاط</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.participantId} style={{ borderTop: "1px solid var(--border)", background: i === 0 ? "color-mix(in srgb, var(--yellow) 8%, transparent)" : "transparent" }}>
                    <td style={{ padding: "0.5rem", color: "var(--text2)" }}>{i + 1}</td>
                    <td style={{ padding: "0.5rem", fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? "🏆 " : ""}{row.name}</td>
                    <td style={{ padding: "0.5rem", textAlign: "center" }}>{row.played}</td>
                    <td style={{ padding: "0.5rem", textAlign: "center", color: "var(--green)" }}>{row.wins}</td>
                    <td style={{ padding: "0.5rem", textAlign: "center" }}>{row.draws}</td>
                    <td style={{ padding: "0.5rem", textAlign: "center", color: "var(--red)" }}>{row.losses}</td>
                    <td style={{ padding: "0.5rem", textAlign: "center", color: row.goalDiff >= 0 ? "var(--green)" : "var(--red)" }}>{row.goalDiff > 0 ? "+" : ""}{row.goalDiff}</td>
                    <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: 700 }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isRoundRobin && (
        <div>
          <div style={{ fontWeight: 700, marginBottom: "0.6rem" }}>⚔️ {t.matchWord}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {tournament.matches.filter((m) => !m.isByeMatch && m.status === "completed").map((m) => {
              const p1 = tournament.participants.find((p) => p.id === m.participant1Id);
              const p2 = tournament.participants.find((p) => p.id === m.participant2Id);
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0.6rem", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text2)", minWidth: 20 }}>{m.round}</span>
                  <span style={{ flex: 1, fontWeight: m.winnerId === p1?.id ? 700 : 400, color: m.winnerId === p1?.id ? "var(--green)" : "var(--text)" }}>{p1?.name ?? "—"}</span>
                  <span style={{ color: "var(--text2)", fontSize: "0.8rem" }}>{m.score1 ?? 0} — {m.score2 ?? 0}</span>
                  <span style={{ flex: 1, textAlign: "end", fontWeight: m.winnerId === p2?.id ? 700 : 400, color: m.winnerId === p2?.id ? "var(--green)" : "var(--text)" }}>{p2?.name ?? "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Tournament Modal ───────────────────────────────────────────────────

function CreateTournamentModal({ onClose, onCreate, settings, role }: {
  onClose: () => void;
  onCreate: (t: Tournament) => void;
  settings: SystemSettings;
  role: UserRole;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";

  const [name, setName] = useState("");
  const [type, setType] = useState<TournamentType>("ps");
  const [format, setFormat] = useState<TournamentFormat>("single-elimination");
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [maxPart, setMaxPart] = useState<number>(8);
  const [entryFee, setEntryFee] = useState(0);
  const [prizePool, setPrizePool] = useState("");
  const [notes, setNotes] = useState("");

  const typeOptions: { value: TournamentType; label: string; icon: string }[] = [
    { value: "ps", label: t.tps, icon: "🎮" },
    { value: "billiard", label: t.tbilliard, icon: "🎱" },
    { value: "chess", label: t.tchess, icon: "♟️" },
    { value: "tennis", label: t.ttennis, icon: "🏓" },
    { value: "baloot", label: t.tbaloot, icon: "🃏" },
    { value: "other", label: t.tother, icon: "🏆" },
  ];

  function handleCreate() {
    if (!name.trim()) return;
    const tour: Tournament = {
      id: crypto.randomUUID(),
      name: name.trim(),
      type,
      format,
      status: "registration",
      maxParticipants: maxPart,
      teamSize: isTeamMode ? 2 : undefined,
      entryFee,
      prizePool: prizePool.trim() || undefined,
      notes: notes.trim() || undefined,
      participants: [],
      matches: [],
      createdAt: Date.now(),
      createdBy: role,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      winnerId: null,
    };
    onCreate(tour);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div
        dir={isRTL ? "rtl" : "ltr"}
        style={{ background: "var(--surface)", borderRadius: 16, padding: "1.5rem", width: "min(95vw, 480px)", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.85rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>🏆 {t.addTournament}</h3>

        <div>
          <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>{t.tournamentName}</label>
          <input className="input" style={{ width: "100%" }} placeholder={t.tournamentName} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div>
          <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 6 }}>{t.tournamentType}</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {typeOptions.map((opt) => (
              <button key={opt.value} onClick={() => setType(opt.value)} style={{
                padding: "0.4rem 0.8rem", borderRadius: 8, border: "1.5px solid",
                borderColor: type === opt.value ? "var(--accent)" : "var(--border)",
                background: type === opt.value ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                color: type === opt.value ? "var(--accent)" : "var(--text)", cursor: "pointer", fontSize: "0.85rem",
              }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 6 }}>{t.tournamentFormat}</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["single-elimination", "round-robin"] as TournamentFormat[]).map((f) => (
              <button key={f} onClick={() => setFormat(f)} style={{
                flex: 1, padding: "0.5rem", borderRadius: 8, border: "1.5px solid",
                borderColor: format === f ? "var(--accent)" : "var(--border)",
                background: format === f ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                color: format === f ? "var(--accent)" : "var(--text)", cursor: "pointer", fontSize: "0.85rem", fontWeight: format === f ? 600 : 400,
              }}>
                {f === "single-elimination" ? `⚡ ${t.singleElim}` : `🔄 ${t.roundRobin}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 6 }}>{t.isTeam} / {t.individual}</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => setIsTeamMode(false)} style={{ flex: 1, padding: "0.4rem", borderRadius: 8, border: `1.5px solid ${!isTeamMode ? "var(--accent)" : "var(--border)"}`, background: !isTeamMode ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent", color: !isTeamMode ? "var(--accent)" : "var(--text)", cursor: "pointer", fontSize: "0.82rem" }}>
                👤 {t.individual}
              </button>
              <button onClick={() => setIsTeamMode(true)} style={{ flex: 1, padding: "0.4rem", borderRadius: 8, border: `1.5px solid ${isTeamMode ? "var(--accent)" : "var(--border)"}`, background: isTeamMode ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent", color: isTeamMode ? "var(--accent)" : "var(--text)", cursor: "pointer", fontSize: "0.82rem" }}>
                👥 {t.isTeam}
              </button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>{t.maxParticipants}</label>
            <select className="input" style={{ width: "100%" }} value={maxPart} onChange={(e) => setMaxPart(Number(e.target.value))}>
              {[4, 8, 16, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>
              {t.entryFee} (<SarSymbol size={11} />)
            </label>
            <input className="input" type="number" min={0} style={{ width: "100%" }} value={entryFee} onChange={(e) => setEntryFee(Number(e.target.value))} />
          </div>
          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>{t.prizePool}</label>
            <input className="input" style={{ width: "100%" }} placeholder="500 ريال + كوبون" value={prizePool} onChange={(e) => setPrizePool(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: "0.82rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>{t.note}</label>
          <textarea className="input" style={{ width: "100%", height: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{t.cancel}</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={!name.trim()}>
            ✓ {t.addTournament}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Print ─────────────────────────────────────────────────────────────────────

function printBracket(tournament: Tournament, settings: SystemSettings) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const standings = tournament.format === "round-robin" ? calcRoundRobinStandings(tournament) : null;
  const visibleMatches = tournament.matches.filter((m) => !m.isByeMatch && m.status === "completed");
  const winner = tournament.participants.find((p) => p.id === tournament.winnerId)
    ?? (standings?.[0] ? { name: standings[0].name } : null);

  const matchRows = visibleMatches.map((m) => {
    const p1 = tournament.participants.find((p) => p.id === m.participant1Id);
    const p2 = tournament.participants.find((p) => p.id === m.participant2Id);
    const w1 = m.winnerId === p1?.id;
    const w2 = m.winnerId === p2?.id;
    return `<tr>
      <td>${m.round}</td>
      <td style="font-weight:${w1 ? 700 : 400};color:${w1 ? "#16a34a" : "#111"}">${p1?.name ?? "—"}</td>
      <td style="text-align:center;font-weight:700">${m.score1 ?? 0} — ${m.score2 ?? 0}</td>
      <td style="font-weight:${w2 ? 700 : 400};color:${w2 ? "#16a34a" : "#111"};text-align:end">${p2?.name ?? "—"}</td>
    </tr>`;
  }).join("");

  const standingsRows = (standings ?? []).map((row, i) =>
    `<tr style="background:${i === 0 ? "#fffbeb" : "transparent"}">
      <td>${i + 1}</td><td>${i === 0 ? "🏆 " : ""}${row.name}</td>
      <td>${row.played}</td><td style="color:#16a34a">${row.wins}</td>
      <td>${row.draws}</td><td style="color:#dc2626">${row.losses}</td>
      <td style="color:${row.goalDiff >= 0 ? "#16a34a" : "#dc2626"}">${row.goalDiff > 0 ? "+" : ""}${row.goalDiff}</td>
      <td><b>${row.points}</b></td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html><html dir="${isRTL ? "rtl" : "ltr"}">
<head><meta charset="utf-8"/><title>${tournament.name}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:2rem;color:#111;direction:${isRTL ? "rtl" : "ltr"}}
  h1{font-size:1.6rem;margin-bottom:0.25rem}
  .sub{color:#666;font-size:0.9rem;margin-bottom:1.5rem}
  .winner-box{border:2px solid #e6a817;background:#fffbeb;border-radius:10px;padding:1rem;text-align:center;margin-bottom:1.5rem}
  .winner-box .name{font-size:1.4rem;font-weight:800;margin-top:0.25rem}
  table{width:100%;border-collapse:collapse;font-size:0.9rem}
  th{background:#f3f4f6;padding:0.5rem;text-align:start}
  td{padding:0.5rem;border-bottom:1px solid #e5e7eb}
  @media print{body{padding:0.5rem}}
</style></head><body>
<h1>🏆 ${tournament.name}</h1>
<div class="sub">${TYPE_ICONS[tournament.type]} · ${tournament.format === "single-elimination" ? t.singleElim : t.roundRobin}${tournament.prizePool ? ` · 🏅 ${tournament.prizePool}` : ""}</div>
${winner ? `<div class="winner-box"><div style="font-size:2rem">🏆</div><div class="name">${winner.name}</div><div style="color:#666;font-size:0.85rem">${t.tournamentWinner}</div></div>` : ""}
${standings ? `
  <table><thead><tr><th>#</th><th>${t.custName}</th><th>م</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>نقاط</th></tr></thead>
  <tbody>${standingsRows}</tbody></table>
` : `
  <table><thead><tr><th>${t.round}</th><th></th><th style="text-align:center">${t.enterScore}</th><th></th></tr></thead>
  <tbody>${matchRows}</tbody></table>
`}
<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=800,height=900");
  if (!win) alert("يرجى السماح بالنوافذ المنبثقة");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
