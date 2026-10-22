// Clicking a visible body part always plays its ordinary reaction, regardless of click frequency.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./appendage-motion'));
  else root.lunaBodyShortcuts = factory(root.claudeAppendages);
})(globalThis, appendages => {
  const regions = Object.freeze({
    head: '脑袋',
    chest: '胸部',
    arms: '手臂',
    'ear-left': '左侧耳朵',
    'ear-right': '右侧耳朵',
    tail: '尾巴'
  });
  // Polygon coordinates follow the 384 x 292 half-body portrait. The resting hands take priority over
  // the cheek and chest. Ears and tail have separate local motions; cropped lower body has no reaction.
  const hitAreas = [
    [
      'arms',
      [
        [163, 173],
        [193, 177],
        [201, 193],
        [193, 225],
        [182, 245],
        [154, 267],
        [104, 267],
        [104, 253],
        [143, 223],
        [161, 209]
      ]
    ],
    [
      'arms',
      [
        [219, 228],
        [284, 222],
        [319, 234],
        [319, 271],
        [233, 271],
        [188, 266],
        [193, 252],
        [207, 252]
      ]
    ],
    [
      'head',
      [
        [92, 63],
        [138, 54],
        [161, 37],
        [213, 35],
        [250, 9],
        [279, 88],
        [283, 143],
        [262, 187],
        [218, 204],
        [177, 187],
        [133, 175],
        [114, 148]
      ]
    ],
    [
      'chest',
      [
        [208, 189],
        [247, 184],
        [272, 216],
        [255, 241],
        [206, 240],
        [199, 219]
      ]
    ]
  ];
  function contains(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i],
        [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function regionAt(x, y, center = 228) {
    if (![x, y, center].every(Number.isFinite) || x < 0 || x >= 384 || y < 0 || y >= 292) return null;
    const localX = x - (center - 228);
    const appendage = appendages.regionAt(localX, y);
    if (appendage) return appendage;
    return hitAreas.find(([, points]) => contains(points, localX, y))?.[0] || null;
  }
  function createReactions() {
    return {
      click(region) {
        if (!Object.hasOwn(regions, region)) return null;
        return {
          expression: Object.hasOwn(appendages.durations, region)
            ? region
            : { head: 'smile', chest: 'shy', arms: 'wink' }[region]
        };
      }
    };
  }
  return Object.freeze({ regions, regionAt, createReactions });
});
