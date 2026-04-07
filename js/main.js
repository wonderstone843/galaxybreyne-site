// GalaxyBreyne — main.js
// Scroll reveals + cursor tracking + parallax + magnetic buttons + scroll progress

document.addEventListener("DOMContentLoaded", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ─── Scroll-triggered fade-in ─────────────────────
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
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

    // ─── Scroll progress bar ──────────────────────────
    const progressBar = document.querySelector(".scroll-progress");
    if (progressBar) {
        const updateProgress = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const pct = Math.min(100, (window.scrollY / max) * 100);
            progressBar.style.width = pct + "%";
        };
        window.addEventListener("scroll", updateProgress, { passive: true });
        updateProgress();
    }

    if (reduceMotion) return;

    // ─── Hero cursor-tracking light + parallax ────────
    const hero = document.querySelector(".hero");
    const heroLight = document.querySelector(".hero-cursor-light");
    const heroParallax = document.querySelector(".hero-parallax");

    if (hero && (heroLight || heroParallax)) {
        let targetX = 50, targetY = 50;
        let currentX = 50, currentY = 50;

        hero.addEventListener("mousemove", e => {
            const rect = hero.getBoundingClientRect();
            targetX = ((e.clientX - rect.left) / rect.width) * 100;
            targetY = ((e.clientY - rect.top) / rect.height) * 100;
        });

        hero.addEventListener("mouseleave", () => {
            targetX = 50;
            targetY = 50;
        });

        // Smooth follow loop
        const tick = () => {
            currentX += (targetX - currentX) * 0.08;
            currentY += (targetY - currentY) * 0.08;

            if (heroLight) {
                heroLight.style.setProperty("--mx", currentX + "%");
                heroLight.style.setProperty("--my", currentY + "%");
            }
            if (heroParallax) {
                // Move opposite to cursor for parallax depth
                const tx = (currentX - 50) * -0.04;
                const ty = (currentY - 50) * -0.04;
                heroParallax.style.transform = `translate(${tx}%, ${ty}%) scale(1.04)`;
            }
            requestAnimationFrame(tick);
        };
        tick();
    }

    // ─── Magnetic buttons ─────────────────────────────
    document.querySelectorAll(".btn").forEach(btn => {
        btn.addEventListener("mousemove", e => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px) scale(1.04)`;
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.transform = "";
        });
    });
});
