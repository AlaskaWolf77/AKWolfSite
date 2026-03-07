const hero = document.querySelector(".hero");
const heroBg = document.getElementById("heroBg");
const heroFade = document.getElementById("heroFade");
const heroTopText = document.getElementById("heroTopText");
const heroCard = document.getElementById("heroCard");
const year = document.getElementById("year");
const reduceHeroMotionQuery = window.matchMedia("(max-width: 800px)");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function onScroll() {
  if (reduceHeroMotionQuery.matches) {
    heroBg.style.transform = "translate3d(0, 0, 0) scale(1.02)";
    heroBg.style.opacity = "1";
    heroFade.style.opacity = "0.35";
    heroTopText.style.transform = "translate3d(0, 0, 0)";
    heroCard.style.opacity = "1";
    heroCard.style.transform = "translate3d(0, 0, 0)";
    return;
  }

  const rect = hero.getBoundingClientRect();
  const heroHeight = hero.offsetHeight;

  const scrolled = clamp(-rect.top, 0, heroHeight);
  const progressRaw = clamp(scrolled / heroHeight, 0, 1);
  const progress = easeOutCubic(progressRaw);

  /* unchanged parallax values */
  const parallaxY = progressRaw * 80;
  heroBg.style.transform = `translate3d(0, ${parallaxY}px, 0) scale(1.02)`;
  heroBg.style.opacity = String(1 - progressRaw * 0.95);

  heroFade.style.opacity = String(0.25 + progressRaw * 0.75);

  const topTextY = progressRaw * 1200;
  heroTopText.style.transform = `translate3d(0, ${topTextY}px, 0)`;

  const start = 0.18;
  const end = 0.42;
  const t = clamp((progressRaw - start) / (end - start), 0, 1);
  const easedT = easeOutCubic(t);

  heroCard.style.opacity = String(easedT);

  const cardY = progress * 520;
  heroCard.style.transform = `translate3d(0, ${cardY}px, 0)`;
}

function createGalleryItem(item) {
  const article = document.createElement("article");
  article.className = "gallery-item";

  const img = document.createElement("img");
  img.src = item.src;
  img.alt = item.title || "";
  img.loading = "lazy";

  article.appendChild(img);

  if (item.title || item.caption) {
    const caption = document.createElement("div");
    caption.className = "gallery-caption";

    if (item.title) {
      const h3 = document.createElement("h3");
      h3.textContent = item.title;
      caption.appendChild(h3);
    }

    if (item.caption) {
      const p = document.createElement("p");
      p.textContent = item.caption;
      caption.appendChild(p);
    }

    article.appendChild(caption);
  }

  return article;
}

async function loadArtworks() {
  try {
    const response = await fetch("artworks.json");
    if (!response.ok) throw new Error("Could not load artworks.json");

    const data = await response.json();

    document.querySelectorAll("[data-gallery]").forEach((gallery) => {
      const key = gallery.dataset.gallery;
      const items = data[key] || [];

      gallery.innerHTML = "";

      items.forEach((item) => {
        gallery.appendChild(createGalleryItem(item));
      });
    });
  } catch (error) {
    document.querySelectorAll("[data-gallery]").forEach((gallery) => {
      gallery.innerHTML = `<p style="color:#8b949e;">Couldn’t load gallery data.</p>`;
    });
    console.error(error);
  }
}

if (year) {
  year.textContent = new Date().getFullYear();
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
reduceHeroMotionQuery.addEventListener("change", onScroll);

onScroll();
loadArtworks();
