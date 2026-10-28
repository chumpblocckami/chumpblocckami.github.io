/**
 * Interactive 3D point-cloud sculpture: knowledge graph / neural field / latent space.
 * Canvas 2D projection with pointer influence, drag rotate, mode morphing.
 */
(function () {
  "use strict";

  var NODE_COUNT = 960;
  var MODES = ["Knowledge graph", "Neural field", "Latent space"];
  var CAPTIONS = [
    "Relationships turn information into understanding.",
    "Simple connections. Emergent intelligence.",
    "Finding structure in a world of possibilities.",
  ];
  var LABELS = [
    ["knowledge", "reasoning", "connection"],
    ["learning", "emergence", "adaptation"],
    ["patterns", "discovery", "structure"],
  ];

  function nodePosition(index, mode) {
    var row = Math.floor(index / 15);
    var col = index % 15;
    var a = (row / 64) * Math.PI * 2;
    var b = (col / 15) * Math.PI * 2 + 0.45 * a;

    if (mode === 1) {
      // Neural field — fibonacci sphere with soft warping
      var y = 1 - (2 * (index + 0.5)) / NODE_COUNT;
      var r = Math.sqrt(1 - y * y);
      var theta = index * Math.PI * (3 - Math.sqrt(5));
      var radius = 1.35 + 0.12 * Math.sin(3 * theta) * Math.sin(9 * y);
      return {
        x: Math.cos(theta) * r * radius,
        y: 1.5 * y,
        z: Math.sin(theta) * r * radius,
      };
    }

    if (mode === 2) {
      // Latent space — stacked rings / cylinder of possibilities
      var angle = 2.5 * a + (index % 5) * Math.PI * 0.4;
      var rad = 0.22 + (col / 15) * 1.05;
      return {
        x: Math.cos(angle) * rad,
        y: (row / 64 - 0.5) * 2.8,
        z: Math.sin(angle) * rad,
      };
    }

    // Knowledge graph — torus of connected nodes
    var tube = 0.44 + 0.08 * Math.cos(3 * a);
    return {
      x: (1.04 + tube * Math.cos(b)) * Math.cos(a),
      y: tube * Math.sin(b),
      z: (1.04 + tube * Math.cos(b)) * Math.sin(a),
    };
  }

  function init(root) {
    var canvas = root.querySelector(".sculpture-canvas");
    var caption = root.querySelector(".sculpture-caption");
    var pauseBtn = root.querySelector(".sculpture-pause");
    var modeButtons = root.querySelectorAll(".sculpture-modes button");
    var labelEls = [
      root.querySelector(".graph-label-one"),
      root.querySelector(".graph-label-two"),
      root.querySelector(".graph-label-three"),
    ];
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var mode = 0;
    var paused = false;
    var ready = false;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var motionOff = reducedMotion.matches;
    if (motionOff) paused = true;

    var rotation = { yaw: -0.3, pitch: 0.72 };
    var drag = null;
    var pointer = { x: 0, y: 0, active: false };
    var needsDraw = true;
    var visible = true;
    var width = 0;
    var height = 0;
    var lastTs = 0;
    var currentMode = 0;
    var raf = 0;
    var nodes = Array.from({ length: NODE_COUNT }, function (_, i) {
      return nodePosition(i, 0);
    });
    var targets = nodes.map(function (n) {
      return { x: n.x, y: n.y, z: n.z };
    });
    var edges = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      edges.push([i, (i + 1) % NODE_COUNT]);
      edges.push([i, (i + 15) % NODE_COUNT]);
      if (i % 3 === 0) edges.push([i, (i + 16) % NODE_COUNT]);
    }

    function setMode(next) {
      mode = next;
      modeButtons.forEach(function (btn, idx) {
        var on = idx === mode;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (caption) caption.textContent = CAPTIONS[mode];
      LABELS[mode].forEach(function (text, idx) {
        if (!labelEls[idx]) return;
        var dot = labelEls[idx].querySelector("span");
        labelEls[idx].textContent = "";
        if (dot) labelEls[idx].appendChild(dot);
        else {
          var s = document.createElement("span");
          labelEls[idx].appendChild(s);
        }
        labelEls[idx].appendChild(document.createTextNode(text));
      });
      canvas.setAttribute(
        "aria-label",
        MODES[mode] +
          ": an abstract interactive 3D point cloud. Drag horizontally or use arrow keys to rotate."
      );
      needsDraw = true;
    }

    function setPaused(value) {
      paused = value;
      if (!pauseBtn) return;
      pauseBtn.setAttribute(
        "aria-label",
        paused ? "Play animation" : "Pause animation"
      );
      pauseBtn.innerHTML = paused
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5v14l12-7z"></path></svg>'
        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5v14M15 5v14"></path></svg>';
    }

    modeButtons.forEach(function (btn, idx) {
      btn.addEventListener("click", function () {
        setMode(idx);
      });
    });
    if (pauseBtn) {
      pauseBtn.addEventListener("click", function () {
        setPaused(!paused);
      });
    }

    var resizeObserver = new ResizeObserver(function (entries) {
      var rect = entries[0].contentRect;
      width = rect.width;
      height = rect.height;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsDraw = true;
    });
    resizeObserver.observe(canvas);

    var intersection = new IntersectionObserver(
      function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) needsDraw = true;
      },
      { threshold: 0, rootMargin: "40px" }
    );
    intersection.observe(canvas);

    function onMotionChange(e) {
      motionOff = e.matches;
      pointer.active = false;
      setPaused(e.matches);
      needsDraw = true;
    }
    reducedMotion.addEventListener("change", onMotionChange);

    canvas.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse" && !motionOff) {
        var rect = canvas.getBoundingClientRect();
        pointer = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          active: true,
        };
        needsDraw = true;
      }
      if (!drag) return;
      rotation.yaw += (e.clientX - drag.x) * 0.007;
      rotation.pitch += (e.clientY - drag.y) * 0.005;
      drag = { x: e.clientX, y: e.clientY };
      needsDraw = true;
    });
    canvas.addEventListener("pointerleave", function () {
      pointer.active = false;
      needsDraw = true;
    });
    function endDrag() {
      drag = null;
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("lostpointercapture", endDrag);
    canvas.addEventListener("keydown", function (e) {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      if (e.key === "ArrowLeft") rotation.yaw -= 0.15;
      if (e.key === "ArrowRight") rotation.yaw += 0.15;
      if (e.key === "ArrowUp") rotation.pitch -= 0.15;
      if (e.key === "ArrowDown") rotation.pitch += 0.15;
      needsDraw = true;
    });
    canvas.addEventListener("blur", endDrag);

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!ctx || !width || !height) return;
      // Skip work off-screen / in background tabs, but always allow the first paint
      if (ready && (!visible || document.hidden)) return;
      if (ts - lastTs < 30) return;
      var dt = Math.min(ts - lastTs || 16, 60);
      lastTs = ts;

      if (currentMode !== mode) {
        currentMode = mode;
        targets = Array.from({ length: NODE_COUNT }, function (_, i) {
          return nodePosition(i, currentMode);
        });
        needsDraw = true;
      }

      var animating = !paused && !motionOff;
      if (!animating && !drag && !needsDraw) return;

      if (animating && !drag) rotation.yaw += 0.000075 * dt;

      var morphing = false;
      var ease = motionOff ? 1 : 0.085;
      for (var i = 0; i < NODE_COUNT; i++) {
        var n = nodes[i];
        var t = targets[i];
        for (var ki = 0; ki < 3; ki++) {
          var k = ["x", "y", "z"][ki];
          var d = t[k] - n[k];
          if (Math.abs(d) > 0.001) morphing = true;
          n[k] += d * ease;
        }
      }
      needsDraw = morphing || animating || !!drag;

      ctx.setTransform(
        Math.min(window.devicePixelRatio || 1, 2),
        0,
        0,
        Math.min(window.devicePixelRatio || 1, 2),
        0,
        0
      );
      ctx.clearRect(0, 0, width, height);

      // Keep the whole torus inside the canvas (model radius ~1.56)
      var scale = Math.min(0.25 * width, 0.3 * height);
      var cy = Math.cos(rotation.yaw);
      var sy = Math.sin(rotation.yaw);
      var cp = Math.cos(rotation.pitch);
      var sp = Math.sin(rotation.pitch);

      var projected = nodes.map(function (n) {
        var x1 = n.x * cy - n.z * sy;
        var z1 = n.x * sy + n.z * cy;
        var y1 = n.y * cp - z1 * sp;
        var z2 = n.y * sp + z1 * cp;
        var persp = 4.8 / (4.8 + z2);
        var sx = 0.5 * width + x1 * scale * persp;
        var sy2 = 0.5 * height + y1 * scale * persp;
        var dx = sx - pointer.x;
        var dy = sy2 - pointer.y;
        var dist = Math.hypot(dx, dy);
        var influence =
          !pointer.active || motionOff || paused
            ? 0
            : Math.max(0, 1 - dist / 55);
        var push = influence * influence * 6;
        return {
          x: sx + (dx / Math.max(1, dist)) * push,
          y: sy2 + (dy / Math.max(1, dist)) * push,
          z: z2,
          scale: persp,
          influence: influence,
        };
      });

      ctx.lineWidth = 0.65;
      var maxEdge = scale * (currentMode === 1 ? 0.42 : 0.65);
      for (var e = 0; e < edges.length; e++) {
        var a = projected[edges[e][0]];
        var b = projected[edges[e][1]];
        if (Math.hypot(a.x - b.x, a.y - b.y) > maxEdge) continue;
        var alpha = Math.min(
          0.85,
          Math.max(0.18, 0.35 - (a.z + b.z) * 0.04) +
            (a.influence + b.influence) * 0.3
        );
        // Resting navy; hover restores mint / lilac from the original viz
        ctx.strokeStyle =
          a.influence > 0.2
            ? "rgba(168, 140, 255, " + Math.min(0.95, alpha + 0.15) + ")"
            : "rgba(31, 78, 121, " + alpha + ")";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      projected
        .map(function (p, index) {
          return Object.assign({}, p, { index: index });
        })
        .sort(function (a, b) {
          return b.z - a.z;
        })
        .forEach(function (p) {
          var highlight = p.index % 97 === 0;
          var alpha = Math.min(1, Math.max(0.4, 0.85 - 0.22 * p.z));
          if (p.influence > 0.7) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.2 * p.scale, 0, Math.PI * 2);
            ctx.fillStyle =
              "rgba(91, 224, 201, " + (0.05 + 0.1 * p.influence) + ")";
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(
            p.x,
            p.y,
            (highlight ? 2.4 : 1.2 + 0.9 * p.influence) * p.scale,
            0,
            Math.PI * 2
          );
          ctx.fillStyle =
            p.influence > 0.45
              ? "rgba(184, 165, 255, " + Math.min(1, alpha + 0.08) + ")"
              : p.index % 7 === 0
                ? "rgba(70, 78, 140, " + alpha + ")"
                : "rgba(31, 78, 121, " + alpha + ")";
          ctx.fill();
        });

      if (!ready) {
        ready = true;
        root.classList.add("is-ready");
      }
    }

    setMode(0);
    setPaused(paused);
    raf = requestAnimationFrame(frame);

    return function destroy() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }

  function boot() {
    document.querySelectorAll("[data-intelligence-sculpture]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
