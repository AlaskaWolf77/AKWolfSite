document.documentElement.classList.add("js");

const hero = document.querySelector(".hero");
const heroBg = document.getElementById("heroBg");
const heroFade = document.getElementById("heroFade");
const heroTopText = document.getElementById("heroTopText");
const year = document.getElementById("year");
const artworkRevealGrid = document.querySelector("#artwork .reveal-sequence");
const topbar = document.querySelector(".topbar");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("site-nav");

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function onScroll() {
    const rect = hero.getBoundingClientRect();
    const heroHeight = hero.offsetHeight;

    const scrolled = clamp(-rect.top, 0, heroHeight);
    const progressRaw = clamp(scrolled / heroHeight, 0, 1);
    const progress = easeOutCubic(progressRaw);

    const parallaxY = progressRaw * 80;
    heroBg.style.transform = `translate3d(0, ${parallaxY}px, 0) scale(1.02)`;
    heroBg.style.opacity = String(1 - progressRaw * 0.95);

    heroFade.style.opacity = String(0.25 + progressRaw * 0.75);

    const topTextY = progressRaw * 800;
    heroTopText.style.transform = `translate3d(0, ${topTextY}px, 0)`;
}

if (year) {
    year.textContent = new Date().getFullYear();
}

function setMobileNav(open) {
    if (!topbar || !navToggle) return;

    topbar.classList.toggle("is-nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
}

if (topbar && navToggle && nav) {
    navToggle.addEventListener("click", () => {
        setMobileNav(!topbar.classList.contains("is-nav-open"));
    });

    nav.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
            setMobileNav(false);
        }
    });

    document.addEventListener("click", (event) => {
        if (event.target instanceof Node && !topbar.contains(event.target)) {
            setMobileNav(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            setMobileNav(false);
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 800) {
            setMobileNav(false);
        }
    });
}

function revealArtworkCards() {
    if (!artworkRevealGrid) return;

    const cards = artworkRevealGrid.querySelectorAll(".reveal-card");
    cards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 180}ms`;
        card.classList.add("is-visible");
    });
}

function resetArtworkCards() {
    if (!artworkRevealGrid) return;

    const cards = artworkRevealGrid.querySelectorAll(".reveal-card");
    cards.forEach((card) => {
        card.classList.remove("is-visible");
        card.style.transitionDelay = "0ms";
    });
}

if (artworkRevealGrid) {
    if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        revealArtworkCards();
                    } else {
                        resetArtworkCards();
                    }
                });
            },
            { threshold: 0.25, rootMargin: "0px 0px -10% 0px" }
        );

        revealObserver.observe(artworkRevealGrid);
    } else {
        revealArtworkCards();
    }
}

const mobileScrollMediaQuery = window.matchMedia("(max-width: 800px)");
let mobileScrollTicking = false;

function onScrollEvent() {
    if (!mobileScrollMediaQuery.matches) {
        onScroll();
        return;
    }

    if (mobileScrollTicking) return;

    mobileScrollTicking = true;
    window.requestAnimationFrame(() => {
        onScroll();
        mobileScrollTicking = false;
    });
}

window.addEventListener("scroll", onScrollEvent, { passive: true });
window.addEventListener("resize", onScroll);
onScroll();
