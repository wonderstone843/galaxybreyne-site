// GalaxyBreyne — main.js
// Fade-in on scroll + nav background on scroll

document.addEventListener("DOMContentLoaded", () => {
    // ─── Scroll-triggered fade-in ─────────────────────
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            });
        },
        { threshold: 0.1 }
    );

    document.querySelectorAll("section, .service-card, .portfolio-card, .badge")
        .forEach(el => observer.observe(el));

    // ─── Smooth scroll with nav offset ────────────────
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener("click", e => {
            const target = document.querySelector(link.getAttribute("href"));
            if (target) {
                e.preventDefault();
                const navHeight = document.querySelector(".nav").offsetHeight;
                window.scrollTo({
                    top: target.offsetTop - navHeight,
                    behavior: "smooth",
                });
            }
        });
    });
});
