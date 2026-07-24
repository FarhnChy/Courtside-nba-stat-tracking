const demoData = require('../data/demoData');
const { getInjuries, withOverrides } = require('./overrides');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDemoProvider() {
  return {
    name: 'demo',

    async getHealth() {
      return { ok: true, source: 'demo', configuredProvider: 'demo' };
    },

    async getBootstrap() {
      return withOverrides(demoData);
    },

    async getGames() {
      return withOverrides({
        meta: clone(demoData.meta),
        teams: clone(demoData.teams),
        games: clone(demoData.games)
      });
    },

    async getTeams() {
      return {
        meta: clone(demoData.meta),
        teams: clone(demoData.teams)
      };
    },

    async getPlayers() {
      return {
        meta: clone(demoData.meta),
        teams: clone(demoData.teams),
        players: clone(demoData.players)
      };
    },

    async getInjuries(options = {}) {
      return getInjuries(options);
    },

    async getGame(id) {
      const game = demoData.games.find((item) => item.id === id);
      return game
        ? withOverrides({ meta: clone(demoData.meta), teams: clone(demoData.teams), game: clone(game) })
        : null;
    },

    async getStandings() {
      return withOverrides({
        meta: clone(demoData.meta),
        teams: clone(demoData.teams),
        standings: clone(demoData.standings)
      });
    },

    async getPredictions() {
      return withOverrides({
        meta: clone(demoData.meta),
        teams: clone(demoData.teams),
        predictions: clone(demoData.predictions),
        futures: clone(demoData.futures)
      });
    }
  };
}

module.exports = { createDemoProvider };
