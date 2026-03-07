document.documentElement.classList.add("js");

const hero = document.querySelector(".hero");
const heroBg = document.getElementById("heroBg");
const heroFade = document.getElementById("heroFade");
const heroTopText = document.getElementById("heroTopText");
const year = document.getElementById("year");
const artworkRevealGrid = document.querySelector("#artwork .reveal-sequence");

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

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
onScroll();
