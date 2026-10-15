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

// Single-character tile codes used in each island's grid rows.
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
    '.......s.sspssgsss......',
    '.......ssgggpgggggs.....',
    '....ssstgtgetpggggs.....',
    '.....stggggggpgtgptss...',
    '....spppppgggpgeppggs...',
    '...sggpeggpggpgptpgggs..',
    '..sgegpggggpgpptgpgggs..',
    '..sgegpggggpppgggpggggs.',
    '..sggepggggptpgggptggs..',
    '...sggpggggpgggggpgggs..',
    '...sggpgggepgggggpggs...',
    '...sggpggegpgtgegpggs...',
    '....sgpppppppppppppggs..',
    '.....spsgggptgtgggsss...',
    '......s.sggpgggses......',
    '........ssspegs.s.......',
    '...........sss..........',
    '........................'
    ],
    stops: [{ col: 11, row: 17 }, { col: 11, row: 12 }, { col: 13, row: 9 }, { col: 17, row: 7 }, { col: 17, row: 12 }, { col: 15, row: 14 }, { col: 9, row: 14 }, { col: 6, row: 13 }, { col: 6, row: 8 }, { col: 9, row: 6 }, { col: 13, row: 7 }, { col: 11, row: 2 }]
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
    '....rffcfffcccfffpfrp...',
    '....rpppppffcffcppfpcr..',
    '....rfpfffpffffpfppfcr..',
    '....rrpffcfpffpcfpfcffr.',
    '..rrfcpffffpppffppfrfcfr',
    '..rfccpcfffpfpppfpcfcffr',
    '..rfffpffffpfffffpfcfcfr',
    '...rcfpffffpfffffpfffcr.',
    '...rffpfffcpffffcpfcfr..',
    '....rrpppppppppppppffr..',
    '....r.pccfcpcfffffrrr...',
    '.......rcffpfrffcfr.r...',
    '.......rrrrprffrrr......',
    '...........r.rr.........',
    '........................'
    ],
    stops: [{ col: 11, row: 17 }, { col: 11, row: 12 }, { col: 13, row: 9 }, { col: 17, row: 6 }, { col: 17, row: 11 }, { col: 16, row: 14 }, { col: 9, row: 14 }, { col: 6, row: 13 }, { col: 6, row: 8 }, { col: 8, row: 6 }, { col: 14, row: 10 }, { col: 20, row: 5 }]
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
    '....ppppppllloooppol....',
    '...llopooppooloplpolll..',
    '..loolpoooppoopoopool...',
    '.loooopoooopppooopoool..',
    '.loloopoooooopolopooll..',
    '.looolpooloolpooopooll..',
    '.loooopoooolopooopoool..',
    '..looopoooooopolopolol..',
    '.llooopppppppppppppol...',
    '...llopoooooopollooll...',
    '...llooooooooplooll.....',
    '.....llooolopooll.......',
    '.......llolllol.........',
    '.......l.l...l..........'
    ],
    stops: [{ col: 4, row: 6 }, { col: 9, row: 7 }, { col: 13, row: 9 }, { col: 17, row: 6 }, { col: 17, row: 11 }, { col: 16, row: 14 }, { col: 12, row: 14 }, { col: 7, row: 14 }, { col: 6, row: 11 }, { col: 9, row: 6 }, { col: 13, row: 11 }, { col: 12, row: 17 }]
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
    '..........rrprr.r.......',
    '......rrrrnnpfnrnr......',
    '......rnrnnnpnfnnnrr....',
    '...rrrfnnnnnpnrnrpfnr...',
    '....rpppppnrpnnnppnnr...',
    '...rrfpnnnpnpnnpnpnnrr..',
    '...rrnprnnnppnprrpnnnr..',
    '...rnnpnnnnpppnnnpnnnr..',
    '...rfrpnnnnnnpnrnpnnnr..',
    '...rfnpnnnnnfprnnpnfnr..',
    '...rnnpnnnnnrpnnnpnnnnr.',
    '....rnpnnnffnpnfnpnrrr..',
    '...rrfppppppppppppprrr..',
    '.....rpnnnnpnnnnnnrr....',
    '.......rfnpnrnrnrr......',
    '........rprrfnrr........',
    '............rr..........',
    '........................'
    ],
    stops: [{ col: 12, row: 2 }, { col: 12, row: 7 }, { col: 14, row: 8 }, { col: 17, row: 7 }, { col: 17, row: 12 }, { col: 15, row: 14 }, { col: 9, row: 14 }, { col: 6, row: 13 }, { col: 6, row: 8 }, { col: 8, row: 6 }, { col: 13, row: 11 }, { col: 9, row: 17 }]
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
  module.exports = { KM_TILE_SIZE, KM_TILE_LEGEND, KM_WORLD, KM_ISLANDS, KM_CONNECTIONS };
}
