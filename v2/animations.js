(function () {
  "use strict";

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const hasGSAP = typeof window.gsap !== "undefined";

  const scenes = qsa(".scene");
  const progressBar = qs("#progress-bar");
  const heartText = qs("#heart-text");

  const overlayYes = qs("#overlay-yes");

  const photoSlot0 = qs("#photo-0");
  const photoSlot1 = qs("#photo-1");

  const panelBackImgBySceneIndex = [];

  const photos = [
    "./images/4D15B9E5-2AE3-4054-A85A-E228B3FEA82D_1_201_a.jpeg",
    "./images/7814A24E-2071-49F7-AE1C-D968C6E7BC2B_1_105_c.jpeg",
    "./images/2D66E54A-21E4-4CDA-B5B1-1037B8929488_1_102_a.jpeg",
    "./images/EEBE23CC-8FFF-46AE-86E2-21C0C2AC0799_4_5005_c.jpeg",
  ];

  const sceneToPhotoIndex = [0, 1, 2, 3, 1];

  const state = {
    sceneIndex: 0,
    typed: false,
    photoActiveSlot: 0, // 0 -> #photo-0, 1 -> #photo-1
    photoActiveIndex: -1,
    panelPhotoActiveIndex: -1,
    cardDismissed: false,
    overlayYesOpen: false,
  };

  const resultCard = qs("#result-card");
  const homeBtn = qs("#home-btn");

  const STORAGE_KEY = "thiep-v2-card-state";

  const saveState = () => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sceneIndex: state.sceneIndex,
          cardDismissed: state.cardDismissed,
          overlayYesOpen: state.overlayYesOpen,
        })
      );
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  };

  const restoreState = () => {
    let parsed;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object") return;

    const maxIndex = Math.max(0, scenes.length - 1);
    const savedSceneIndex =
      typeof parsed.sceneIndex === "number" && Number.isFinite(parsed.sceneIndex)
        ? Math.trunc(parsed.sceneIndex)
        : 0;
    const targetSceneIndex = Math.max(0, Math.min(maxIndex, savedSceneIndex));

    const savedCardDismissed = !!parsed.cardDismissed;
    const savedOverlayYesOpen = !!parsed.overlayYesOpen;

    // Restore scene first so panel/photo transitions are in sync.
    if (targetSceneIndex !== state.sceneIndex) revealScene(targetSceneIndex);

    setCardsHidden(savedCardDismissed);

    if (savedOverlayYesOpen) openOverlay(overlayYes);
  };

  const setCardsHidden = (hidden) => {
    const appEl = qs(".app");
    if (!appEl) return;
    if (hidden) {
      appEl.classList.add("is-card-hidden");
      state.cardDismissed = true;
      saveState();
      return;
    }
    appEl.classList.remove("is-card-hidden");
    state.cardDismissed = false;
    saveState();
  };

  const updateProgress = () => {
    const ratio = (state.sceneIndex / (scenes.length - 1)) * 100;
    if (progressBar) progressBar.style.width = `${Math.max(0, Math.min(100, ratio))}%`;
  };

  const getPhotoIndexForScene = (sceneIndex) => {
    const mapped = sceneToPhotoIndex[sceneIndex];
    if (typeof mapped === "number") return mapped;
    return sceneIndex % photos.length;
  };

  const getPhotoElBySlot = (slot) => (slot === 0 ? photoSlot0 : photoSlot1);

  const transitionPhoto = (nextSceneIndex) => {
    if (!photoSlot0 || !photoSlot1) return;
    const nextPhotoIndex = getPhotoIndexForScene(nextSceneIndex);
    if (state.photoActiveIndex === nextPhotoIndex) return;

    const currentSlot = state.photoActiveSlot;
    const nextSlot = currentSlot === 0 ? 1 : 0;
    const currentEl = getPhotoElBySlot(currentSlot);
    const nextEl = getPhotoElBySlot(nextSlot);

    if (!currentEl || !nextEl) return;

    // Prepare: fade the incoming photo from blur to sharp.
    currentEl.classList.remove("is-active");
    nextEl.classList.remove("is-active");
    nextEl.src = photos[nextPhotoIndex];
    // With preloading, switching `src` should be instant; start the fade immediately.
    requestAnimationFrame(() => nextEl.classList.add("is-active"));

    state.photoActiveSlot = nextSlot;
    state.photoActiveIndex = nextPhotoIndex;
  };

  const transitionPanelPhoto = (nextSceneIndex) => {
    const img = panelBackImgBySceneIndex[nextSceneIndex];
    if (!img) return;

    const nextPhotoIndex = getPhotoIndexForScene(nextSceneIndex);
    img.classList.remove("is-active");
    img.src = photos[nextPhotoIndex];

    state.panelPhotoActiveIndex = nextPhotoIndex;

    // Make sure the back image becomes visible even on the first flip.
    if (img.complete) {
      img.classList.add("is-active");
      return;
    }

    img.addEventListener(
      "load",
      () => {
        img.classList.add("is-active");
      },
      { once: true }
    );
  };

  const setupPanelFlipCards = () => {
    // Preload all images for smoother transitions.
    photos.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    scenes.forEach((sceneEl, sceneIndex) => {
      const sceneName = sceneEl?.dataset?.scene;
      if (!sceneEl || sceneName === "final") return;

      const panel = qs(".panel", sceneEl);
      if (!panel) return;

      // If already initialized, just cache the back image element.
      const existingBackImg = qs(".panel-photo", panel);
      const hasFaces = !!qs(".panel-face--front", panel) && !!existingBackImg;
      if (hasFaces) {
        panelBackImgBySceneIndex[sceneIndex] = existingBackImg;
        return;
      }

      panel.classList.add("panel--flippable");

      const front = document.createElement("div");
      front.className = "panel-face panel-face--front";

      // Move current children into front face.
      while (panel.firstChild) front.appendChild(panel.firstChild);

      const back = document.createElement("div");
      back.className = "panel-face panel-face--back";

      const backImg = document.createElement("img");
      backImg.className = "panel-photo";
      backImg.alt = "";
      backImg.loading = "eager";
      backImg.decoding = "async";
      back.appendChild(backImg);

      panel.appendChild(front);
      panel.appendChild(back);

      panelBackImgBySceneIndex[sceneIndex] = backImg;
    });

    // Set initial back image for the initial active scene.
    transitionPanelPhoto(state.sceneIndex);
  };

  const revealScene = (index) => {
    if (index < 0 || index >= scenes.length) return;
    const previous = scenes[state.sceneIndex];
    const next = scenes[index];
    if (previous === next) return;

    if (hasGSAP) {
      gsap.to(previous, {
        opacity: 0,
        y: -8,
        duration: 0.25,
        onComplete: () => {
          previous.classList.remove("is-active");
          previous.style.opacity = "";
          previous.style.transform = "";
          next.classList.add("is-active");
          gsap.fromTo(next, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 });
        },
      });
    } else {
      previous.classList.remove("is-active");
      next.classList.add("is-active");
    }

    state.sceneIndex = index;
    updateProgress();
    transitionPhoto(index);
    transitionPanelPhoto(index);
    if (scenes[index]?.dataset.scene === "heart") runTypewriter();
    saveState();
  };

  const nextScene = () => revealScene(state.sceneIndex + 1);

  const spawnHearts = () => {
    if (!overlayYes) return;
    const panel = qs(".overlay__panel", overlayYes);
    if (!panel) return;

    const old = qs(".hearts-burst", panel);
    if (old) old.remove();

    const burst = document.createElement("div");
    burst.className = "hearts-burst";
    burst.setAttribute("aria-hidden", "true");
    panel.appendChild(burst);

    const HEARTS = 14;
    for (let i = 0; i < HEARTS; i += 1) {
      const span = document.createElement("span");
      span.className = "heart-burst__heart";
      span.textContent = "♥";
      span.style.left = "50%";
      span.style.top = "52%";

      const dx = (Math.random() * 2 - 1) * 160; // px
      const dy = -Math.random() * 190 - 40; // px (upwards)
      const rot = Math.random() * 220 - 110;
      const scale = Math.random() * 0.45 + 0.7;
      const delay = Math.random() * 100;

      span.style.setProperty("--dx", `${dx}px`);
      span.style.setProperty("--dy", `${dy}px`);
      span.style.setProperty("--rot", `${rot}deg`);
      span.style.setProperty("--scale", `${scale}`);
      span.style.setProperty("--delay", `${delay}ms`);

      burst.appendChild(span);
    }
  };

  const runTypewriter = () => {
    if (!heartText || state.typed) return;
    state.typed = true;
    const full = heartText.textContent || "";
    heartText.textContent = "";
    let idx = 0;
    const speed = 18;
    const tick = () => {
      idx += 1;
      heartText.textContent = full.slice(0, idx);
      if (idx < full.length) window.setTimeout(tick, speed);
    };
    tick();
  };

  const openOverlay = (overlay) => {
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    const panel = qs(".overlay__panel", overlay);
    if (hasGSAP && panel) {
      gsap.fromTo(panel, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 });
    }
    spawnHearts();
    state.overlayYesOpen = overlay === overlayYes;
    saveState();
  };

  const closeOverlay = (overlay) => {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if (overlay === overlayYes) state.overlayYesOpen = false;
    saveState();
  };

  const setupEvents = () => {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const action = target.getAttribute("data-action");
      if (!action) return;

      if (action === "close-overlay") {
        const host = target.closest(".overlay");
        if (host) closeOverlay(host);
      }
    });
  };

  const setupResultCardOpen = () => {
    if (!resultCard || !overlayYes) return;

    const open = () => openOverlay(overlayYes);
    resultCard.setAttribute("role", "button");
    resultCard.setAttribute("tabindex", "0");
    resultCard.setAttribute("aria-label", "Mở lời đồng ý");

    resultCard.addEventListener("click", open);
    resultCard.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open();
    });
  };

  const setupHomeButton = () => {
    if (!homeBtn) return;

    homeBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (overlayYes?.classList.contains("is-open")) closeOverlay(overlayYes);
      setCardsHidden(false);
      revealScene(0);
      saveState();
    });
  };

  const setupContinueCardsNav = () => {
    const nextBtns = qsa(".continue-next-btn");
    if (!nextBtns.length) return;

    nextBtns.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (overlayYes?.classList.contains("is-open")) return;
        // Arrow chỉ chuyển scene, không tự ẩn card.
        setCardsHidden(false);
        nextScene();
      });
    });
  };

  const setupContinueCardFlip = () => {
    const panels = qsa('.scene:not([data-scene="final"]) > .panel');
    if (!panels.length) return;

    const onPanel = (event) => {
      if (overlayYes?.classList.contains("is-open")) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      // Nút mũi tên thì xử lý bởi handler khác.
      if (target.closest(".continue-next-btn")) return;

      // Không toggle khi click vào card mở overlay.
      if (target.closest("#result-card")) return;

      // Toggle ẩn/hiện (bấm lần 2 sẽ bật lại).
      const shouldFlipOpen = !state.cardDismissed;
      if (shouldFlipOpen) transitionPanelPhoto(state.sceneIndex);
      setCardsHidden(shouldFlipOpen);
    };

    panels.forEach((panel) => {
      panel.addEventListener("click", onPanel);
    });
  };

  const setupClickOutsideCardToggle = () => {
    const getCards = () => {
      const hosts = qsa('.scene:not([data-scene="final"]) > .panel');
      if (resultCard) hosts.push(resultCard);
      return hosts;
    };

    const isClickOnCard = (target) => {
      if (!(target instanceof Element)) return false;
      const cards = getCards();
      return cards.some((card) => card && card.contains(target));
    };

    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Trong lúc overlay đang mở thì không toggle card.
      if (overlayYes?.classList.contains("is-open")) return;

      const onCard = isClickOnCard(target);

      // Card đang bị ẩn: click lại trên màn hình để hiện lại.
      if (state.cardDismissed && !onCard) setCardsHidden(false);
    });
  };

  const setupPhotoStage = () => {
    if (!photoSlot0 || !photoSlot1) return;

    // Preload all images for smoother transitions.
    photos.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    // Initial state: show the mapped photo for the first scene.
    const initialPhotoIndex = getPhotoIndexForScene(0);
    const initialSlot = 0;
    const initialEl = getPhotoElBySlot(initialSlot);
    if (!initialEl) return;

    photoSlot0.classList.remove("is-active");
    photoSlot1.classList.remove("is-active");
    initialEl.src = photos[initialPhotoIndex];
    initialEl.classList.add("is-active");

    state.photoActiveSlot = initialSlot;
    state.photoActiveIndex = initialPhotoIndex;
  };

  window.addEventListener("DOMContentLoaded", () => {
    setupPhotoStage();
    setupPanelFlipCards();
    setupEvents();
    setupResultCardOpen();
    setupContinueCardsNav();
    restoreState();
    setupHomeButton();
    updateProgress();
  });
})();

