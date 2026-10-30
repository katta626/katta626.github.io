import 'lenis/dist/lenis.css';
import './style.css';
import Lenis from 'lenis';

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const phoneQ = matchMedia('(max-width: 820px)');
document.documentElement.classList.add('js');

// ---------- smooth scroll ----------
export let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  const id = a.getAttribute('href');
  if (id.length < 2 || a.hasAttribute('data-placeholder')) return;
  a.addEventListener('click', (e) => {
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const offset = -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 64) - 16;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
    else target.scrollIntoView();
    history.replaceState(null, '', id);
  });
});
document.querySelectorAll('a[data-placeholder]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

// ---------- the bar lifts off the page once it scrolls ----------
const bar = document.querySelector('.bar');
const onScroll = () => bar?.classList.toggle('scrolled', window.scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- entrances: parts of a section arrive in order ----------
const io = new IntersectionObserver((entries) => {
  const arriving = entries.filter((e) => e.isIntersecting).map((e) => e.target);
  arriving.forEach((el, i) => {
    el.style.setProperty('--d', `${Math.min(i, 5) * 90}ms`);
    el.classList.add('in');
    io.unobserve(el);
  });
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('[data-pop]').forEach((el) => io.observe(el));
