import { baseline, turnoutMap, project2027 } from "../services/strategy.js";

export function getBaseline(_req, res) {
  res.json({
    ...baseline(),
    generatedAt: new Date().toISOString(),
  });
}

export function getTurnout(_req, res) {
  res.json({
    turnout: turnoutMap(),
    count: turnoutMap().reduce((a, w) => a + w.stations.length, 0),
    method: "top-3 candidates (Siyoi/Khatundi/Nakhumicha) over registered voters; 2027 = ward GOTV turnout target.",	
  });
}

export function getProjections(_req, res) {
  const p = project2027();
  res.json({
    scenarios: p.scenarios,
    wardProjections: p.wardProjections.map((w) => ({
      wardId: w.id,
      ward: w.name,
      constituency: w.constituency,
      category: w.projection.category,
      registered22: w.registered,
      reg27: w.projection.reg27,
      turnout27: w.projection.turnout27,
      share22: w.projection.share22,
      share27: w.projection.share27,
      siyoi2022: w.siyoi,
      target2027: w.projection.targetVotes,
      delta: w.projection.delta,
      opponent: w.opponent,
      opponentNumber: w.opponentNumber,
    })),
    byCategory: p.byCategory,
    assumed: p.assumptions,
  });
}