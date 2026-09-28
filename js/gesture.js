(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AvritGesture = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function resist(deltaPx, dimensionPx) {
    var mag = Math.abs(deltaPx);
    if (mag === 0) return 0;
    var dim = dimensionPx > 0 ? dimensionPx : 1;
    var sign = deltaPx < 0 ? -1 : 1;
    return sign * ((mag * dim) / (mag + dim));
  }

  function dragOffset(offset, fingerDelta, bounds) {
    bounds = bounds || {};
    var min = bounds.min == null ? -Infinity : bounds.min;
    var max = bounds.max == null ? Infinity : bounds.max;
    var dim = bounds.dimension || 240;
    var raw = offset + fingerDelta;
    if (raw > max) return max + resist(raw - max, dim);
    if (raw < min) return min - resist(min - raw, dim);
    return raw;
  }

  function stepMotion(state, dt, opts) {
    opts = opts || {};
    var y = state.y;
    var v = state.v;
    var friction = opts.friction == null ? 0 : opts.friction;
    var spring = opts.spring == null ? 0 : opts.spring;
    var rest = opts.rest == null ? 0 : opts.rest;
    var min = opts.min == null ? -Infinity : opts.min;
    var max = opts.max == null ? Infinity : opts.max;
    var restitution = opts.restitution == null ? 0.5 : opts.restitution;
    var step = dt > 0 ? dt : 0;
    v = v * Math.exp(-friction * step);
    v = v + (rest - y) * spring * step;
    y = y + v * step;
    var bounced = false;
    if (y > max) {
      y = max;
      v = -Math.abs(v) * restitution;
      bounced = true;
    } else if (y < min) {
      y = min;
      v = Math.abs(v) * restitution;
      bounced = true;
    }
    return { y: y, v: v, bounced: bounced };
  }

  function settle(state, opts) {
    opts = opts || {};
    var rest = opts.rest == null ? 0 : opts.rest;
    var dt = opts.dt || 0.016;
    var s = { y: state.y, v: state.v || 0 };
    var guard = 0;
    while (guard < 8000 && (Math.abs(s.y - rest) > 0.4 || Math.abs(s.v) > 0.4)) {
      s = stepMotion(s, dt, opts);
      guard += 1;
    }
    if (Math.abs(s.y - rest) <= 0.5) {
      s.y = rest;
      s.v = 0;
    }
    s.steps = guard;
    return s;
  }

  function reorder(ids, fromIndex, toIndex) {
    var next = ids.slice();
    if (fromIndex < 0 || fromIndex >= next.length) return next;
    var moved = next.splice(fromIndex, 1)[0];
    var target = toIndex;
    if (target < 0) target = 0;
    if (target > next.length) target = next.length;
    next.splice(target, 0, moved);
    return next;
  }

  function commitMove(ids, fromIndex, toIndex) {
    return reorder(ids, fromIndex, toIndex);
  }

  function flingIndex(index, velocityPx, slotPx, count, opts) {
    opts = opts || {};
    var friction = opts.friction == null ? 3 : opts.friction;
    var restitution = opts.restitution == null ? 0.45 : opts.restitution;
    var slot = slotPx > 0 ? slotPx : 1;
    var last = Math.max(0, count - 1);
    var s = { y: index * slot, v: velocityPx };
    var bounced = false;
    var guard = 0;
    while (guard < 500 && Math.abs(s.v) > 8) {
      var next = stepMotion(s, 0.016, {
        friction: friction,
        spring: 0,
        rest: 0,
        min: 0,
        max: last * slot,
        restitution: restitution
      });
      if (next.bounced) bounced = true;
      s = next;
      guard += 1;
    }
    var landed = Math.round(s.y / slot);
    if (landed < 0) landed = 0;
    if (landed > last) landed = last;
    return { index: landed, bounced: bounced, y: s.y, v: s.v, steps: guard };
  }

  return {
    resist: resist,
    dragOffset: dragOffset,
    stepMotion: stepMotion,
    settle: settle,
    reorder: reorder,
    commitMove: commitMove,
    flingIndex: flingIndex
  };
});
