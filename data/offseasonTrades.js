const source = 'https://www.espn.com/nba/story/_/id/48957844/nba-trade-tracker-details-every-deal-2026-offseason-draft-free-agency';

// Completed/reported trades from ESPN's 2026 offseason tracker. Each deal is
// represented once at the primary destination to avoid duplicate team cards.
module.exports = [
  { date:'2026-07-19', team:'ATL', player:{id:'1629652',name:'Luguentz Dort'}, description:'Atlanta acquired Luguentz Dort and Ryan Nembhard in a three-team deal; Dallas acquired Zaccharie Risacher, and Oklahoma City received three second-round picks.' },
  { date:'2026-07-12', team:'PHI', player:{id:'1627759',name:'Jaylen Brown'}, description:'Philadelphia acquired Jaylen Brown from Boston in exchange for Paul George and draft picks.' },
  { date:'2026-07-07', team:'MIL', player:{id:'1627747',name:'Caris LeVert'}, description:'Milwaukee acquired Caris LeVert and two second-round picks from Detroit for Taurean Prince and Gary Harris.' },
  { date:'2026-07-03', team:'WAS', player:{id:'1629028',name:'Deandre Ayton'}, description:'Washington acquired Deandre Ayton from the Lakers for Jaden Hardy and second-round picks in 2031 and 2032.' },
  { date:'2026-07-03', team:'CHA', player:{id:'1627827',name:'Dorian Finney-Smith'}, description:'Charlotte acquired Dorian Finney-Smith and three second-round picks from Houston.' },
  { date:'2026-06-28', team:'PHX', player:{id:'1628970',name:'Miles Bridges'}, description:'Phoenix acquired Miles Bridges and 2029 first- and second-round picks from Charlotte for Grayson Allen, Royce O’Neale and a 2033 first-round pick.' },
  { date:'2026-06-26', team:'DET', player:{id:'1630198',name:'Isaiah Joe'}, description:'Detroit acquired Isaiah Joe from Oklahoma City for two future second-round picks.' },
  { date:'2026-06-25', team:'MIN', player:{id:'1630163',name:'LaMelo Ball'}, description:'Minnesota acquired LaMelo Ball and Josh Green from Charlotte for Naz Reid, a 2033 first-round pick, three first-round swaps and three second-round picks.' },
  { date:'2026-06-24', team:'MEM', player:{id:'1630191',name:'Isaiah Stewart'}, description:'Memphis acquired Isaiah Stewart from Detroit for three future second-round picks.' },
  { date:'2026-06-22', team:'MIA', player:{id:'203507',name:'Giannis Antetokounmpo'}, description:'Miami acquired Giannis Antetokounmpo and Bobby Portis from Milwaukee for Tyler Herro, Kel’el Ware, Jaime Jaquez Jr., Kasparas Jakučionis, three first-round picks, a pick swap and a second-round pick.' },
  { date:'2026-06-22', team:'BKN', player:{id:'203944',name:'Julius Randle'}, description:'Brooklyn acquired Julius Randle and pick No. 28 in a three-team trade; Chicago acquired Nic Claxton, and Minnesota acquired pick No. 33.' },
  { date:'2026-06-21', team:'ATL', player:{id:'1630598',name:'Aaron Wiggins'}, description:'Atlanta acquired Aaron Wiggins from Oklahoma City for two second-round picks.' }
].map(trade=>({...trade,type:'Trade',source}));
