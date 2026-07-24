const manualOverrides = require('../data/manualOverrides');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function injuriesForTeams(teamCodes) {
  const codes = new Set(teamCodes.filter(Boolean));
  return manualOverrides.injuries
    .filter((injury) => codes.has(injury.team))
    .map((injury) => ({
      player: injury.player,
      team: injury.team,
      position: injury.position,
      status: injury.status,
      detail: injury.detail,
      source: injury.source,
      updatedAt: injury.updatedAt
    }));
}

function withGameOverrides(game) {
  const next = clone(game);
  const manualInjuries = injuriesForTeams([next.away?.team, next.home?.team]);
  if (manualInjuries.length) next.injuries = manualInjuries;
  return next;
}

function withOverrides(payload) {
  const next = clone(payload);
  if (Array.isArray(next.games)) next.games = next.games.map(withGameOverrides);
  if (next.game) next.game = withGameOverrides(next.game);
  next.meta = {
    ...next.meta,
    manualOverrides: {
      injuries: manualOverrides.injuries.length,
      source: 'data/manualOverrides.js'
    },
    sectionAvailability: manualOverrides.sectionAvailability.free
  };
  return next;
}

function getInjuries(options = {}) {
  const team = options.team?.toUpperCase();
  const injuries = manualOverrides.injuries
    .filter((injury) => !team || injury.team === team)
    .map(clone);

  return {
    meta: {
      source: 'manual-overrides',
      provider: 'Courtside manual overrides',
      generatedAt: new Date().toISOString(),
      dataQuality: 'manual'
    },
    injuries
  };
}

module.exports = { getInjuries, withOverrides };
