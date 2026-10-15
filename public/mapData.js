// Knowledge Map world data — original terrain, generated once by a small
// procedural script (not copied from any game) and then frozen here as
// static authored data: a 24x20 tile grid per island, a winding walking
// path carved through each, and 12 stop tile-coordinates per island
// sampled evenly along that path. Four islands arranged clockwise around
// a central landmark (see KM_WORLD below), joined by two rope bridges and
// one ferry crossing. Content (topic titles/objectives/progress) comes
// from GET /api/knowledge-map at render time — this file is terrain
// geometry only.

const KM_TILE_SIZE = 16;

// Single-character tile codes used in each island's grid rows. The 12
// stop markers ('1'-'9','A'-'C', in that order) sit directly on top of
// path tiles in the grid itself — the single source of truth for a
// stop's position, so pixel coordinates can never drift from the
// terrain actually drawn on the path. They render identically to plain
// path tiles ('p'); getIslandStops() below is the only thing that reads
// them.
const KM_STOP_MARKERS = '123456789ABC';

const KM_TILE_LEGEND = {
  '.': 'water',
  's': 'sand',
  'g': 'grass',
  'e': 'grassEdge',
  't': 'tree',
  'p': 'path',
  'c': 'cliffTop',
  'f': 'cliffFace',
  'r': 'rock',
  'n': 'snow',
  'l': 'cloud',
  'o': 'platform'
};
for (const ch of KM_STOP_MARKERS) KM_TILE_LEGEND[ch] = 'path';

// Scans an island's grid for the stop markers and returns them in order
// (index 0 = '1', ... index 11 = 'C') as {col,row} tile coordinates.
// This is the only place stop positions come from — callers must not
// keep their own copy, so a stop's position can never fall out of sync
// with the path tile it actually sits on.
function getIslandStops(islandData) {
  const found = new Array(KM_STOP_MARKERS.length).fill(null);
  islandData.grid.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const idx = KM_STOP_MARKERS.indexOf(row[c]);
      if (idx !== -1) found[idx] = { col: c, row: r };
    }
  });
  return found.filter(Boolean);
}

// World layout: islands placed clockwise from bottom-left — algebra1
// (bottom-left) -> geometry (top-left) -> algebra2 (top-right) -> precalc
// (bottom-right) — each island is 24x20 tiles (384x320px at 16px/tile),
// with a 220px open-water gap between them for bridges/ferry and the
// central gate. worldX/worldY are each island's top-left corner in this
// shared coordinate space.
const KM_WORLD = {
  width: 988,
  height: 860,
  gateX: 494,
  gateY: 430
};

const KM_ISLANDS = {
  'algebra1': {
    label: 'Algebra I',
    terrain: 'meadow',
    worldX: 0, worldY: 540,
    entry: { col: 11, row: 17 },
    exit: { col: 11, row: 2 },
    grid: [
    '........................',
    '...........s..s.........',
    '.......s.ssCssgsss......',
    '.......ssgggpgggggs.....',
    '....ssstgtgetpggggs.....',
    '.....stggggggpgtgptss...',
    '....sppppAgggpgeppggs...',
    '...sggpeggpggBgpt4gggs..',
    '..sgeg9ggggpgpptgpgggs..',
    '..sgegpggggpp3gggpggggs.',
    '..sggepggggptpgggptggs..',
    '...sggpggggpgggggpgggs..',
    '...sggpggge2ggggg5ggs...',
    '...sgg8ggegpgtgegpggs...',
    '....sgppp7ppppp6pppggs..',
    '.....spsgggptgtgggsss...',
    '......s.sggpgggses......',
    '........sss1egs.s.......',
    '...........sss..........',
    '........................'
    ]
  },
  'geometry': {
    label: 'Geometry',
    terrain: 'canyon',
    worldX: 0, worldY: 0,
    entry: { col: 11, row: 17 },
    exit: { col: 20, row: 5 },
    grid: [
    '........................',
    '........................',
    '.............r..........',
    '........rrrrrfrrrr......',
    '.....rrrcfffffffffr.....',
    '....rffcfffcccfffpfrC...',
    '....rpppApffcffcp4fpcr..',
    '....rfpfffpffffpfppfcr..',
    '....rr9ffcfpffpcfpfcffr.',
    '..rrfcpffffpp3ffppfrfcfr',
    '..rfccpcfffpfpBpfpcfcffr',
    '..rfffpffffpfffff5fcfcfr',
    '...rcfpffff2fffffpfffcr.',
    '...rff8fffcpffffcpfcfr..',
    '....rrppp7pppppp6ppffr..',
    '....r.pccfcpcfffffrrr...',
    '.......rcffpfrffcfr.r...',
    '.......rrrr1rffrrr......',
    '...........r.rr.........',
    '........................'
    ]
  },
  'algebra2': {
    label: 'Algebra II',
    terrain: 'sky',
    worldX: 604, worldY: 0,
    entry: { col: 4, row: 6 },
    exit: { col: 12, row: 17 },
    grid: [
    '........................',
    '........................',
    '............ll..........',
    '.......llllloollll......',
    '......lloloooolool......',
    '......loooooooooopl.....',
    '....1ppppAlllooop4ol....',
    '...llopoo2pooloplpolll..',
    '..loolpoooppoopoopool...',
    '.loooopoooopp3ooopoool..',
    '.loloopoooooopolopooll..',
    '.loool9ooloolBooo5ooll..',
    '.loooopoooolopooopoool..',
    '..looopoooooopolopolol..',
    '.llooop8pppp7ppp6ppol...',
    '...llopoooooopollooll...',
    '...llooooooooplooll.....',
    '.....lloooloCooll.......',
    '.......llolllol.........',
    '.......l.l...l..........'
    ]
  },
  'precalc': {
    label: 'Pre-Calculus',
    terrain: 'snow',
    worldX: 604, worldY: 540,
    entry: { col: 12, row: 2 },
    exit: { col: 9, row: 17 },
    grid: [
    '........................',
    '........................',
    '..........rr1rr.r.......',
    '......rrrrnnpfnrnr......',
    '......rnrnnnpnfnnnrr....',
    '...rrrfnnnnnpnrnrpfnr...',
    '....rpppApnrpnnnppnnr...',
    '...rrfpnnnpn2nnpn4nnrr..',
    '...rrn9rnnnppn3rrpnnnr..',
    '...rnnpnnnnpppnnnpnnnr..',
    '...rfrpnnnnnnpnrnpnnnr..',
    '...rfnpnnnnnfBrnnpnfnr..',
    '...rnnpnnnnnrpnnn5nnnnr.',
    '....rn8nnnffnpnfnpnrrr..',
    '...rrfppp7ppppp6ppprrr..',
    '.....rpnnnnpnnnnnnrr....',
    '.......rfnpnrnrnrr......',
    '........rCrrfnrr........',
    '............rr..........',
    '........................'
    ]
  }
};

// Two rope bridges + one ferry, each joining one island's exit anchor to
// the next island's entry anchor (consecutive in curriculum order:
// algebra1 -> geometry -> algebra2 -> precalc). Anchor tile coordinates
// match each island's own entry/exit above exactly, so bridges/ferry line
// up with real edge-of-island path endpoints rather than floating.
const KM_CONNECTIONS = [
  { id: 'bridge-a1-geo', type: 'bridge', from: { island: 'algebra1', col: 11, row: 2 }, to: { island: 'geometry', col: 11, row: 17 } },
  { id: 'ferry-geo-a2', type: 'ferry', from: { island: 'geometry', col: 20, row: 5 }, to: { island: 'algebra2', col: 4, row: 6 } },
  { id: 'bridge-a2-pre', type: 'bridge', from: { island: 'algebra2', col: 12, row: 17 }, to: { island: 'precalc', col: 12, row: 2 } }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KM_TILE_SIZE, KM_STOP_MARKERS, KM_TILE_LEGEND, KM_WORLD, KM_ISLANDS, KM_CONNECTIONS, getIslandStops };
}
