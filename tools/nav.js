const topbar = document.querySelector(".topbar");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("site-nav");
const navDropdown = document.querySelector(".nav-dropdown");
const navDropdownTrigger = document.querySelector(".nav-dropdown-trigger");

function setNavDropdown(open) {
    if (!navDropdown || !navDropdownTrigger) return;

    navDropdown.classList.toggle("is-open", open);
    navDropdownTrigger.setAttribute("aria-expanded", String(open));
}

function setMobileNav(open) {
    if (!topbar || !navToggle) return;

    topbar.classList.toggle("is-nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));

    if (!open) {
        setNavDropdown(false);
    }
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
            setNavDropdown(false);
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 800) {
            setMobileNav(false);
        }
    });
}

if (navDropdown && navDropdownTrigger) {
    navDropdownTrigger.addEventListener("click", () => {
        setNavDropdown(!navDropdown.classList.contains("is-open"));
    });

    document.addEventListener("click", (event) => {
        if (event.target instanceof Node && !navDropdown.contains(event.target)) {
            setNavDropdown(false);
        }
    });
}
