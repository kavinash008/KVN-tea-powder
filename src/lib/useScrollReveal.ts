import { useEffect } from 'react';

/**
 * High-performance scroll reveal hook using IntersectionObserver.
 * Runs off the main thread, causing zero lag on mobile devices.
 */
export function useScrollReveal(dependencies: any[] = []) {
  useEffect(() => {
    // If browser doesn't support IntersectionObserver, reveal immediately
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.scroll-reveal').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.08,
      }
    );

    const elements = document.querySelectorAll('.scroll-reveal:not(.is-revealed)');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, dependencies);
}
