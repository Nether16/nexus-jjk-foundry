const managers = new WeakMap();
const edges = ["top", "right", "bottom", "left"];
const between = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
const pulseFrames = [
  { opacity: 0, offset: 0 }, { opacity: 1, offset: .06 },
  { opacity: .85, offset: .42 }, { opacity: .12, offset: .55 },
  { opacity: 1, offset: .67 }, { opacity: 0, offset: 1 }
].map(frame => ({ ...frame, easing: "steps(1, end)" }));

function boltPath(vertical) {
  const point = (along, across) => (vertical ? [across, along] : [along, across])
    .map(value => Number(value).toFixed(1)).join(" ");
  const points = [point(0, 12)];
  for (let index = 1; index <= 6; index++) {
    points.push(point(index * 20, between(5, 19).toFixed(1)));
    if (index < 6) points.push(point(index * 20 - between(5, 10), between(6, 18).toFixed(1)));
  }
  return `M${points.join(" L")} M${point(40, 12)} L${point(49, 2)} L${point(62, 4)}` +
    ` M${point(82, 13)} L${point(91, 23)} L${point(105, 20)}`;
}

function managerFor(document) {
  if (managers.has(document)) return managers.get(document);
  const view = document.defaultView;
  const states = new Set();
  const byLayer = new WeakMap();
  const byTarget = new WeakMap();
  const media = view.matchMedia("(prefers-reduced-motion: reduce)");
  let attachmentTimer;
  const stop = state => {
    view.clearTimeout(state.timer);
    state.timer = undefined;
    state.running = false;
    for (const animation of state.animations) animation.cancel();
    state.animations = [];
    delete state.layer.dataset.nexusKokusenRunning;
    delete state.layer.dataset.nexusKokusenPair;
  };
  const eligible = state => state.target.isConnected && state.layer.parentElement === state.target &&
    state.inView && !document.hidden && !media.matches && !state.target.disabled &&
    !state.target.closest("[hidden]") && (!state.button || state.target.matches(":hover, :focus-visible"));
  const strike = state => {
    if (!eligible(state)) return stop(state);
    for (const animation of state.animations) animation.cancel();
    const horizontal = Math.random() < .5;
    state.layer.dataset.nexusKokusenPair = horizontal ? "horizontal" : "vertical";
    const duration = between(110, 165);
    state.animations = (horizontal ? [0, 2] : [1, 3]).map(index => {
      const svg = state.layer.children[index];
      svg.style.setProperty("--nexus-kokusen-start", Math.random().toFixed(3));
      svg.style.setProperty("--nexus-kokusen-length", between(.28, .62).toFixed(3));
      svg.style.setProperty("--nexus-kokusen-offset", `${between(-2, 3).toFixed(1)}px`);
      const path = boltPath(!horizontal);
      for (const element of svg.querySelectorAll("path")) element.setAttribute("d", path);
      return svg.querySelector("g").animate(pulseFrames, { duration, easing: "linear" });
    });
    state.timer = view.setTimeout(() => strike(state), duration + between(65, 170));
  };
  const sync = state => {
    if (state.target.isConnected) state.everConnected = true;
    if (!eligible(state)) return stop(state);
    if (state.running) return;
    state.running = true;
    state.layer.dataset.nexusKokusenRunning = "";
    strike(state);
  };
  const dispose = state => {
    stop(state);
    intersection?.unobserve(state.target);
    for (const name of ["pointerenter", "pointerleave", "focusin", "focusout"]) {
      state.target.removeEventListener(name, state.sync);
    }
    byLayer.delete(state.layer);
    byTarget.delete(state.target);
    states.delete(state);
  };
  const sweep = () => {
    for (const state of states) {
      if (state.everConnected && (!state.target.isConnected || state.layer.parentElement !== state.target)) dispose(state);
      else sync(state);
    }
  };
  const intersection = typeof view.IntersectionObserver === "function" ? new view.IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = byTarget.get(entry.target);
      if (state) {
        state.inView = entry.isIntersecting;
        sync(state);
      }
    }
  }) : null;
  const mutations = new view.MutationObserver(sweep);
  mutations.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
  document.addEventListener("visibilitychange", sweep);
  media.addEventListener("change", sweep);
  const expirePending = () => {
    attachmentTimer = undefined;
    for (const state of states) {
      if (!state.everConnected && !state.target.isConnected && Date.now() - state.createdAt >= 2000) dispose(state);
    }
    if ([...states].some(state => !state.everConnected)) attachmentTimer = view.setTimeout(expirePending, 2000);
  };
  const manager = {
    attach(target, layer) {
      if (byLayer.has(layer)) return;
      const previous = byTarget.get(target);
      if (previous) dispose(previous);
      const state = { target, layer, button: target.matches("button"), animations: [], inView: !intersection,
        everConnected: false, running: false, createdAt: Date.now() };
      state.sync = () => sync(state);
      byLayer.set(layer, state);
      byTarget.set(target, state);
      states.add(state);
      for (const name of ["pointerenter", "pointerleave", "focusin", "focusout"]) target.addEventListener(name, state.sync);
      intersection?.observe(target);
      sync(state);
      // Foundry calls the render hook before inserting the message into the DOM.
      if (!state.everConnected && !attachmentTimer) attachmentTimer = view.setTimeout(expirePending, 2000);
    },
    remove(layer) {
      const state = byLayer.get(layer);
      if (state) dispose(state);
    }
  };
  managers.set(document, manager);
  return manager;
}

function addLightning(target) {
  const document = target.ownerDocument;
  let layer = [...target.children].find(child => child.classList.contains("nexus-kokusen-fx"));
  if (!layer) {
    layer = document.createElement("span");
    layer.className = "nexus-kokusen-fx";
    target.prepend(layer);
  }
  layer.setAttribute("aria-hidden", "true");
  if (!layer.querySelector("svg")) {
    layer.innerHTML = edges.map((edge, index) => {
      const vertical = index % 2 === 1;
      const path = boltPath(vertical);
      return `<svg class="nexus-kokusen-lightning nexus-kokusen-edge-${edge}" viewBox="${vertical ? "0 0 24 120" : "0 0 120 24"}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
        `<g class="nexus-kokusen-bolt bolt-${index + 1}">` +
        `<path class="nexus-kokusen-bolt-aura" d="${path}"/><path class="nexus-kokusen-bolt-core" d="${path}"/></g></svg>`;
    }).join("");
  }
  managerFor(document).attach(target, layer);
}

/** SVG is created only on the client, after chat HTML sanitization. */
export function decorateKokusenVisuals(state, html) {
  if (!["offer", "result"].includes(state?.kind) || !html?.ownerDocument?.defaultView) return;
  const document = html.ownerDocument;
  for (const button of html.querySelectorAll('[data-nexus-critical-action="kokusen"], [data-nexus-critical-action="sparks"]')) {
    button.classList.add("nexus-kokusen-trigger");
    if (![...button.children].some(child => child.classList.contains("nexus-kokusen-label"))) {
      const label = document.createElement("span");
      label.className = "nexus-kokusen-label";
      label.append(...[...button.childNodes].filter(node => !node.classList?.contains("nexus-kokusen-fx")));
      button.append(label);
    }
    addLightning(button);
  }
  if (state.kind === "result" && state.success === true && ["kokusen", "sparks"].includes(state.choice)) {
    for (const card of html.querySelectorAll(".nexus-critical-result")) {
      card.classList.add("nexus-kokusen-result");
      addLightning(card);
    }
  }
}

export function clearKokusenVisuals(html) {
  for (const card of html.querySelectorAll(".nexus-kokusen-result")) card.classList?.remove("nexus-kokusen-result");
  for (const layer of html.querySelectorAll(".nexus-kokusen-fx")) {
    managers.get(html.ownerDocument)?.remove(layer);
    layer.remove?.();
  }
}
