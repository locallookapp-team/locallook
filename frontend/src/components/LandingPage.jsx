import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  MagnifyingGlass,
  Pulse,
  ListChecks,
  Storefront,
  ForkKnife,
  ToggleRight,
  CaretDown,
  DownloadSimple,
  CheckCircle,
  ArrowRight,
  Door,
  Package,
  Diamond,
} from '@phosphor-icons/react';

/* ------------------------------------------------------------------ */
/* Content                                                            */
/* ------------------------------------------------------------------ */

const PROBLEMS = [
  {
    icon: Door,
    title: 'Closed doors',
    text: 'You cross town for a store that shut early. A static map shows last year’s opening hours, not what the owner decided today.',
  },
  {
    icon: Package,
    title: 'Unavailable products',
    text: 'The item you came for sold out hours ago. Stock changes through the day, and printed signs and old posts cannot keep up.',
  },
  {
    icon: Diamond,
    title: 'Hidden gems',
    text: 'Good local stores often have no website and little online presence. LocalLook puts them on the same map as everyone else so you can find them.',
  },
];

const EXPLORER_STEPS = [
  {
    icon: MagnifyingGlass,
    title: 'Search nearby',
    text: 'Open the map and browse stores and menus around you in Odiongan.',
  },
  {
    icon: Pulse,
    title: 'Check the pulse',
    text: 'Every pin shows whether the store is open or closed right now, as set by the merchant.',
  },
  {
    icon: ListChecks,
    title: 'Build your list',
    text: 'Add items to your Errand List and see the exact cash to prepare before you leave.',
  },
];

const BUSINESS_STEPS = [
  {
    icon: Storefront,
    title: 'Claim your spot',
    text: 'Create your business listing and verify your store so customers can find you on the map.',
  },
  {
    icon: ForkKnife,
    title: 'Build digital menus',
    text: 'Add your items and prices, then update them the moment stock changes.',
  },
  {
    icon: ToggleRight,
    title: 'Toggle live status',
    text: 'Switch between open and closed with one toggle so customers always see the truth.',
  },
];

const FAQS = [
  {
    q: 'Is it free?',
    a: 'Yes. Browsing the map, checking store status and building your Errand List cost nothing. Business owners can choose optional paid features for their listing.',
  },
  {
    q: 'Do I need an account to browse?',
    a: 'No. You can open the map, check which stores are open and read their menus without signing up.',
  },
  {
    q: 'How do I know if a store is open?',
    a: 'Merchants use a live Open or Close toggle on their listing. The pin on the map updates to match, so you see the status the store set most recently.',
  },
  {
    q: 'Can I order or pay in the app?',
    a: 'No. LocalLook does not process orders or payments. Use it to plan your trip and build an Errand List so you know the exact cash to prepare.',
  },
  {
    q: 'Where is it available?',
    a: 'LocalLook is built for Odiongan, Romblon.',
  },
];

const TAGLINE = ['Maps tell you where.', 'LocalLook tells you what is happening.'];

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const CURVE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

.ll-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #0F172A;
  background: #FFFFFF;
  -webkit-font-smoothing: antialiased;
  font-style: normal;
  width: 100%;
  display: block;
}
.ll-root *, .ll-root *::before, .ll-root *::after { box-sizing: border-box; font-style: normal; }
.ll-root h1, .ll-root h2, .ll-root h3, .ll-root h4 { margin: 0; text-wrap: balance; }
.ll-root p { margin: 0; text-wrap: pretty; }
.ll-root a { color: inherit; text-decoration: none; }
.ll-root button { font-family: inherit; }
.ll-root ul { margin: 0; padding: 0; list-style: none; }

/* Named text styles */
.heading-1 { font-size: 60px; line-height: 1; font-weight: 600; }
.heading-2 { font-size: 48px; line-height: 1; font-weight: 600; }
.heading-3 { font-size: 36px; line-height: 40px; font-weight: 600; }
.heading-4 { font-size: 30px; line-height: 36px; font-weight: 600; }
.heading-5 { font-size: 24px; line-height: 32px; font-weight: 600; }
.heading-6 { font-size: 20px; line-height: 28px; font-weight: 600; }
.title-1 { font-size: 20px; line-height: 28px; font-weight: 500; }
.title-2 { font-size: 18px; line-height: 28px; font-weight: 500; }
.title-3 { font-size: 16px; line-height: 24px; font-weight: 500; }
.title-4 { font-size: 14px; line-height: 20px; font-weight: 500; }
.title-5 { font-size: 12px; line-height: 16px; font-weight: 500; }
.body-1 { font-size: 16px; line-height: 24px; font-weight: 600; }
.body-2 { font-size: 16px; line-height: 24px; font-weight: 500; }
.body-3 { font-size: 16px; line-height: 24px; font-weight: 400; }
.body-4 { font-size: 14px; line-height: 20px; font-weight: 600; }
.body-5 { font-size: 14px; line-height: 20px; font-weight: 500; }
.body-6 { font-size: 14px; line-height: 20px; font-weight: 400; }
.button-lg { font-size: 18px; line-height: 28px; font-weight: 600; }
.button-md { font-size: 16px; line-height: 24px; font-weight: 600; }
.button-sm { font-size: 14px; line-height: 20px; font-weight: 600; }
.caption-1 { font-size: 14px; line-height: 20px; font-weight: 500; }
.caption-2 { font-size: 14px; line-height: 20px; font-weight: 400; }
.caption-3 { font-size: 12px; line-height: 16px; font-weight: 600; }
.caption-4 { font-size: 12px; line-height: 16px; font-weight: 500; }
.caption-5 { font-size: 12px; line-height: 16px; font-weight: 400; }

@media (max-width: 640px) {
  .heading-1 { font-size: 36px; line-height: 40px; }
  .heading-2 { font-size: 30px; line-height: 36px; }
  .heading-3 { font-size: 24px; line-height: 32px; }
}

/* Layout */
.ll-container { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.ll-section { padding: 96px 0; background: #FFFFFF; }
.ll-section--alt { background: #F8FAFC; }
@media (max-width: 640px) { .ll-section { padding: 64px 0; } }

.ll-muted { color: #64748B; }
.ll-eyebrow { color: #2563EB; display: inline-flex; align-items: center; gap: 8px; }
.ll-section-head { max-width: 680px; margin: 0 auto 64px; text-align: center; display: flex; flex-direction: column; gap: 16px; align-items: center; }
@media (max-width: 640px) { .ll-section-head { margin-bottom: 48px; } }

/* Skip link */
.ll-skip { position: absolute; left: 16px; top: -64px; z-index: 100; background: #0F172A; color: #FFFFFF !important; padding: 8px 12px; border-radius: 8px; transition: transform 500ms ${CURVE}; }
.ll-skip:focus { transform: translateY(80px); }

/* Focus */
.ll-root a:focus-visible, .ll-root button:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }

/* Buttons */
.ll-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid transparent; cursor: pointer; border-radius: 12px; padding: 12px 24px; min-height: 48px; transition: background-color 300ms ${CURVE}, color 300ms ${CURVE}, transform 500ms ${CURVE}; white-space: nowrap; }
.ll-btn:hover { transform: translateY(-2px); }
.ll-btn:active { transform: scale(0.98); }
.ll-btn--sm { padding: 8px 12px; min-height: 40px; border-radius: 8px; }
.ll-btn--primary { background: #2563EB; color: #FFFFFF; }
.ll-btn--primary:hover { background: #1D4ED8; }
.ll-btn--secondary { background: #FFFFFF; color: #0F172A; border-color: #E2E8F0; }
.ll-btn--secondary:hover { background: #F8FAFC; }
.ll-btn--white { background: #FFFFFF; color: #2563EB; }
.ll-btn--white:hover { background: #F8FAFC; }
.ll-btn--block { width: 100%; }

/* Navigation */
.ll-nav { position: fixed; top: 16px; left: 0; right: 0; margin: 0 auto; width: fit-content; max-width: calc(100% - 32px); z-index: 60; display: flex; align-items: center; gap: 32px; padding: 8px; background: rgba(255,255,255,0.8); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border: 1px solid #E2E8F0; border-radius: 16px; }
.ll-brand { display: inline-flex; align-items: center; gap: 8px; padding: 0 8px; }
.ll-brand-mark { width: 32px; height: 32px; border-radius: 8px; background: #2563EB; display: inline-flex; align-items: center; justify-content: center; color: #FFFFFF; }
.ll-nav-links { display: flex; align-items: center; gap: 8px; }
.ll-nav-link { padding: 8px 12px; border-radius: 8px; color: #64748B; transition: color 300ms ${CURVE}, background-color 300ms ${CURVE}; }
.ll-nav-link:hover { color: #0F172A; background: #F8FAFC; }
.ll-toggle { display: none; width: 40px; height: 40px; background: transparent; border: 0; border-radius: 8px; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 4px; padding: 0; }
.ll-toggle:active { transform: scale(0.98); }
.ll-bar { display: block; width: 24px; height: 2px; background: #0F172A; border-radius: 2px; transition: transform 500ms ${CURVE}, opacity 300ms ${CURVE}; }
.ll-toggle[aria-expanded="true"] .ll-bar:nth-child(1) { transform: translateY(6px) rotate(45deg); }
.ll-toggle[aria-expanded="true"] .ll-bar:nth-child(2) { opacity: 0; }
.ll-toggle[aria-expanded="true"] .ll-bar:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

.ll-panel { position: fixed; inset: 0; z-index: 50; background: rgba(255,255,255,0.94); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 500ms ${CURVE}, visibility 0s 500ms; }
.ll-panel.is-open { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 500ms ${CURVE}, visibility 0s 0s; }
.ll-panel-inner { height: 100%; display: flex; flex-direction: column; justify-content: flex-start; gap: 8px; padding: 96px 24px 32px; }
.ll-panel-item { opacity: 0; transform: translateY(24px); transition: opacity 500ms ${CURVE}, transform 500ms ${CURVE}; transition-delay: 0ms; }
.ll-panel.is-open .ll-panel-item { opacity: 1; transform: none; transition-delay: var(--d, 0ms); }
.ll-panel-link { display: block; padding: 8px 0; color: #0F172A; }
.ll-panel-cta { margin-top: 24px; }

@media (max-width: 860px) {
  .ll-nav { width: calc(100% - 32px); justify-content: space-between; gap: 16px; }
  .ll-nav-links { display: none; }
  .ll-toggle { display: flex; }
}
@media (min-width: 861px) { .ll-panel { display: none; } }

/* Hero */
.ll-hero { padding: 96px 0; background: #FFFFFF; }
.ll-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
.ll-hero-copy { display: flex; flex-direction: column; gap: 24px; align-items: flex-start; }
.ll-hero-title { max-width: 680px; background: linear-gradient(90deg, #000000, #666666); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
.ll-hero-title span { display: block; }
.ll-hero-sub { max-width: 680px; color: #64748B; }
.ll-hero-actions { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.ll-proof { display: flex; flex-wrap: wrap; gap: 8px 24px; color: #64748B; }
.ll-proof li { display: inline-flex; align-items: center; gap: 8px; }
@media (max-width: 960px) {
  .ll-hero-grid { grid-template-columns: 1fr; gap: 48px; }
}
@media (max-width: 640px) {
  .ll-hero { padding: 96px 0 64px; }
  .ll-hero-actions .ll-btn { width: 100%; }
}

/* Map mockup */
.ll-mock { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 24px; padding: 8px; }
.ll-map { position: relative; height: 440px; border-radius: 16px; overflow: hidden; background: #F8FAFC; }
.ll-map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.ll-map-tag { position: absolute; top: 16px; left: 16px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 4px 8px; color: #64748B; }
.ll-pin { position: absolute; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); }
.ll-chip { display: flex; flex-direction: column; align-items: center; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 4px 8px; margin-bottom: 4px; white-space: nowrap; }
.ll-chip-name { color: #64748B; }
.ll-open { color: #10B981; }
.ll-closed { color: #64748B; }
.ll-pin-icon { position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
.ll-ring { position: absolute; left: 8px; top: 8px; width: 24px; height: 24px; border-radius: 9999px; }
.ll-ring--open { background: rgba(16,185,129,0.4); animation: ll-pulse 2400ms ${CURVE} infinite; }
.ll-ring--closed { background: rgba(100,116,139,0.25); transform: scale(1.5); }
.ll-pin-icon svg { position: relative; }
@keyframes ll-pulse {
  0% { transform: scale(0.8); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}
.ll-errand { position: absolute; left: 16px; right: 16px; bottom: 16px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.ll-errand-row { display: flex; justify-content: space-between; align-items: center; color: #64748B; }
.ll-errand-total { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #E2E8F0; }
@media (max-width: 640px) { .ll-map { height: 400px; } }

/* Cards and grids */
.ll-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.ll-grid-3 > div, .ll-grid-2 > div { display: flex; }
.ll-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 860px) { .ll-grid-3, .ll-grid-2 { grid-template-columns: 1fr; } }
.ll-card { flex: 1; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px; display: flex; flex-direction: column; gap: 16px; transition: transform 500ms ${CURVE}; }
.ll-card:hover { transform: translateY(-4px); }
.ll-card--lg { border-radius: 24px; gap: 32px; }
.ll-card--lg:hover { transform: none; }
@media (max-width: 640px) { .ll-card { padding: 24px; } }
.ll-icon { width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(37,99,235,0.1); color: #2563EB; }
.ll-icon--green { background: rgba(16,185,129,0.12); color: #10B981; }
.ll-steps { display: flex; flex-direction: column; gap: 24px; }
.ll-step { display: grid; grid-template-columns: 48px 1fr; gap: 16px; align-items: start; }
.ll-step-text { display: flex; flex-direction: column; gap: 4px; }
.ll-card-head { display: flex; flex-direction: column; gap: 8px; }
.ll-badge-green { color: #10B981; }

/* Tagline reveal */
.ll-tagline { max-width: 680px; margin: 0 auto; text-align: center; color: #0F172A; }
.ll-tagline-line { display: block; }
.ll-tagline-line + .ll-tagline-line { margin-top: 16px; }
.ll-word { opacity: 0.3; transition: opacity 500ms ${CURVE}; }
.ll-word.is-lit { opacity: 1; }

/* FAQ */
.ll-faq { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.ll-faq-item { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; }
.ll-faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; text-align: left; background: transparent; border: 0; border-radius: 16px; padding: 24px; cursor: pointer; color: #0F172A; }
.ll-faq-q:active { transform: scale(0.99); }
.ll-caret { flex-shrink: 0; color: #64748B; transition: transform 500ms ${CURVE}; }
.ll-faq-q[aria-expanded="true"] .ll-caret { transform: rotate(180deg); }
.ll-faq-a { padding: 0 24px 24px; color: #64748B; animation: ll-fade 500ms ${CURVE}; }
@keyframes ll-fade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

/* Final CTA */
.ll-cta { background: #2563EB; border-radius: 24px; padding: 64px 32px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px; color: #FFFFFF; }
.ll-cta p { color: #FFFFFF; max-width: 680px; }
.ll-cta h2 { max-width: 680px; }
.ll-cta-note { opacity: 0.8; }
@media (max-width: 640px) { .ll-cta { padding: 48px 24px; } .ll-cta .ll-btn { width: 100%; } }

/* Footer */
.ll-footer { background: #FFFFFF; padding: 48px 0; }
.ll-footer-inner { display: flex; flex-wrap: wrap; gap: 16px 32px; justify-content: space-between; align-items: center; }
.ll-footer-links { display: flex; flex-wrap: wrap; gap: 8px 24px; }
.ll-footer-links a { color: #64748B; transition: color 300ms ${CURVE}; }
.ll-footer-links a:hover { color: #0F172A; }

/* Scroll reveal */
[data-reveal] { opacity: 0; transform: translateY(32px); transition: opacity 700ms ${CURVE} var(--d, 0ms), transform 700ms ${CURVE} var(--d, 0ms); }
[data-reveal].is-visible { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  [data-reveal] { transform: none; transition: opacity 300ms ${CURVE}; }
  .ll-word { opacity: 1; transition: none; }
  .ll-ring--open { animation: none; transform: scale(1.5); opacity: 0.5; }
  .ll-faq-a { animation: none; }
  .ll-panel-item { transform: none; }
  .ll-btn:hover, .ll-card:hover { transform: none; }
}
`;

/* ------------------------------------------------------------------ */
/* Small components                                                   */
/* ------------------------------------------------------------------ */

function Pin({ x, y, open, name }) {
  return (
    <div className="ll-pin" style={{ left: x, top: y }}>
      <div className="ll-chip">
        <span className="caption-4 ll-chip-name">{name}</span>
        <span className={`caption-3 ${open ? 'll-open' : 'll-closed'}`}>
          {open ? 'Open now' : 'Closed'}
        </span>
      </div>
      <div className="ll-pin-icon">
        <span className={`ll-ring ${open ? 'll-ring--open' : 'll-ring--closed'}`} />
        <MapPin size={40} weight="fill" color={open ? '#10B981' : '#64748B'} />
      </div>
    </div>
  );
}

function MapMockup() {
  return (
    <div className="ll-mock" role="img" aria-label="Sample map showing two open stores, one closed store and an Errand List total">
      <div className="ll-map">
        <svg viewBox="0 0 400 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect x="16" y="64" width="104" height="80" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="136" y="64" width="120" height="80" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="272" y="64" width="112" height="80" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="16" y="160" width="104" height="96" rx="8" fill="rgba(16,185,129,0.12)" />
          <rect x="136" y="160" width="120" height="96" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="272" y="160" width="112" height="96" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="16" y="272" width="168" height="64" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="200" y="272" width="184" height="64" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="0" y="392" width="400" height="48" fill="rgba(37,99,235,0.1)" />
        </svg>
        <span className="ll-map-tag caption-4">Sample view</span>
        <Pin x="24%" y="34%" open name="Corner bakery" />
        <Pin x="70%" y="44%" open name="Hardware store" />
        <Pin x="42%" y="62%" open={false} name="Pharmacy" />
        <div className="ll-errand">
          <span className="title-4">Errand list</span>
          <div className="ll-errand-row caption-2">
            <span>Corner bakery, 2 items</span>
            <span>₱84.50</span>
          </div>
          <div className="ll-errand-row caption-2">
            <span>Hardware store, 1 item</span>
            <span>₱148.00</span>
          </div>
          <div className="ll-errand-total">
            <span className="caption-1 ll-muted">Total cash to prepare</span>
            <span className="body-1">₱232.50</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepList({ steps, tone }) {
  return (
    <ul className="ll-steps">
      {steps.map(({ icon: Icon, title, text }) => (
        <li className="ll-step" key={title}>
          <span className={`ll-icon ${tone === 'green' ? 'll-icon--green' : ''}`}>
            <Icon size={24} weight="bold" aria-hidden="true" />
          </span>
          <div className="ll-step-text">
            <h4 className="title-2">{title}</h4>
            <p className="body-6 ll-muted">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const link = (path) => (e) => {
    e.preventDefault();
    go(path);
  };

  /* Meta tags */
  useEffect(() => {
    const title = 'LocalLook | Know what is open before you go';
    const description =
      'LocalLook is a live map of local businesses in Odiongan, Romblon. See which stores are open, check digital menus and plan the exact cash for your errands.';
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
  }, []);

  /* PWA install prompt */
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try {
      await installPrompt.userChoice;
    } catch (err) {
      /* user dismissed or the prompt failed; nothing to do */
    }
    setInstallPrompt(null);
  };

  /* Scroll reveals and word by word tagline */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reveals = root.querySelectorAll('[data-reveal]');
    const words = root.querySelectorAll('[data-word]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || !('IntersectionObserver' in window)) {
      reveals.forEach((el) => el.classList.add('is-visible'));
      words.forEach((el) => el.classList.add('is-lit'));
      return undefined;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -48px 0px' }
    );
    reveals.forEach((el) => revealObserver.observe(el));

    const wordObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-lit');
            wordObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -40% 0px' }
    );
    words.forEach((el) => wordObserver.observe(el));

    return () => {
      revealObserver.disconnect();
      wordObserver.disconnect();
    };
  }, []);

  /* Mobile menu: lock scroll, close on Escape */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const panelDelay = (i) => `${Math.min(i * 60, 400)}ms`;

  return (
    <div className="ll-root" ref={rootRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', height: '100dvh', zIndex: 10 }}>
      <style>{css}</style>

      <a className="ll-skip body-4" href="#main">Skip to main content</a>

      {/* 1. Navigation */}
      <nav className="ll-nav" aria-label="Main">
        <a className="ll-brand" href="/" onClick={link('/')} aria-label="LocalLook home">
          <span className="ll-brand-mark">
            <MapPin size={20} weight="fill" aria-hidden="true" />
          </span>
          <span className="heading-6">LocalLook</span>
        </a>

        <div className="ll-nav-links">
          <a className="ll-nav-link title-4" href="/create-business" onClick={link('/create-business')}>
            For businesses
          </a>
          <a className="ll-nav-link title-4" href="/login" onClick={link('/login')}>
            Log in
          </a>
          <button type="button" className="ll-btn ll-btn--sm ll-btn--primary button-sm" onClick={() => go('/map')}>
            Explore map
          </button>
        </div>

        <button
          type="button"
          className="ll-toggle"
          aria-expanded={menuOpen}
          aria-controls="ll-mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="ll-bar" />
          <span className="ll-bar" />
          <span className="ll-bar" />
        </button>
      </nav>

      <div id="ll-mobile-menu" className={`ll-panel ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="ll-panel-inner">
          <div className="ll-panel-item" style={{ '--d': panelDelay(0) }}>
            <a className="ll-panel-link heading-4" href="/create-business" onClick={link('/create-business')} tabIndex={menuOpen ? 0 : -1}>
              For businesses
            </a>
          </div>
          <div className="ll-panel-item" style={{ '--d': panelDelay(1) }}>
            <a className="ll-panel-link heading-4" href="/login" onClick={link('/login')} tabIndex={menuOpen ? 0 : -1}>
              Log in
            </a>
          </div>
          <div className="ll-panel-item ll-panel-cta" style={{ '--d': panelDelay(2) }}>
            <button
              type="button"
              className="ll-btn ll-btn--primary ll-btn--block button-lg"
              onClick={() => go('/map')}
              tabIndex={menuOpen ? 0 : -1}
            >
              Explore map
            </button>
          </div>
        </div>
      </div>

      <main id="main">
        {/* 2. Hero */}
        <section className="ll-hero" aria-labelledby="hero-title">
          <div className="ll-container">
            <div className="ll-hero-grid">
              <div className="ll-hero-copy">
                <div data-reveal>
                  <span className="ll-eyebrow caption-3">
                    <MapPin size={16} weight="fill" aria-hidden="true" />
                    Live local map for Odiongan, Romblon
                  </span>
                </div>

                <h1 id="hero-title" className="ll-hero-title heading-1" data-reveal style={{ '--d': '60ms' }}>
                  <span>Know what’s open</span>
                  <span>before you go.</span>
                </h1>

                <p className="ll-hero-sub title-2" data-reveal style={{ '--d': '120ms' }}>
                  LocalLook shows which stores in Odiongan are open right now and what is on their menu, so you can plan your errand run and prepare the exact cash before you leave home.
                </p>

                <div className="ll-hero-actions" data-reveal style={{ '--d': '180ms' }}>
                  <button type="button" className="ll-btn ll-btn--primary button-md" onClick={() => go('/map')}>
                    Explore the map
                    <ArrowRight size={20} weight="bold" aria-hidden="true" />
                  </button>
                  {installPrompt && (
                    <button type="button" className="ll-btn ll-btn--secondary button-md" onClick={handleInstall}>
                      <DownloadSimple size={20} weight="bold" aria-hidden="true" />
                      Install LocalLook app
                    </button>
                  )}
                </div>

                <ul className="ll-proof caption-1" data-reveal style={{ '--d': '240ms' }}>
                  {['Free to browse', 'No account needed', 'Made for Odiongan'].map((t) => (
                    <li key={t}>
                      <CheckCircle size={16} weight="fill" color="#10B981" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div data-reveal style={{ '--d': '120ms' }}>
                <MapMockup />
              </div>
            </div>
          </div>
        </section>

        {/* 3. The problem */}
        <section className="ll-section ll-section--alt" aria-labelledby="problem-title">
          <div className="ll-container">
            <div className="ll-section-head" data-reveal>
              <span className="ll-eyebrow caption-3">The problem</span>
              <h2 id="problem-title" className="heading-3">
                Local stores change by the hour. Your map does not.
              </h2>
              <p className="body-3 ll-muted">
                Customers lose time and money on trips that end at a locked door or an empty shelf.
              </p>
            </div>

            <div className="ll-grid-3">
              {PROBLEMS.map(({ icon: Icon, title, text }, i) => (
                <div key={title} data-reveal style={{ '--d': `${i * 80}ms` }}>
                  <article className="ll-card">
                    <span className="ll-icon">
                      <Icon size={24} weight="bold" aria-hidden="true" />
                    </span>
                    <h3 className="heading-6">{title}</h3>
                    <p className="body-3 ll-muted">{text}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Tagline reveal */}
        <section className="ll-section" aria-label="What LocalLook does">
          <div className="ll-container">
            <h2 className="ll-tagline heading-1">
              {TAGLINE.map((line, li) => (
                <span className="ll-tagline-line" key={li}>
                  {line.split(' ').map((word, wi, arr) => (
                    <React.Fragment key={wi}>
                      <span className="ll-word" data-word>{word}</span>
                      {wi < arr.length - 1 ? ' ' : ''}
                    </React.Fragment>
                  ))}
                </span>
              ))}
            </h2>
          </div>
        </section>

        {/* 5. How it works */}
        <section className="ll-section ll-section--alt" aria-labelledby="how-title">
          <div className="ll-container">
            <div className="ll-section-head" data-reveal>
              <span className="ll-eyebrow caption-3">How it works</span>
              <h2 id="how-title" className="heading-3">
                One map for the people who shop and the people who sell.
              </h2>
            </div>

            <div className="ll-grid-2">
              <div data-reveal>
                <article className="ll-card ll-card--lg">
                  <div className="ll-card-head">
                    <span className="ll-eyebrow caption-3">For explorers</span>
                    <h3 className="heading-5">Plan the trip before you leave home</h3>
                  </div>
                  <StepList steps={EXPLORER_STEPS} />
                  <button type="button" className="ll-btn ll-btn--secondary ll-btn--block button-md" onClick={() => go('/map')}>
                    Open the map
                  </button>
                </article>
              </div>

              <div data-reveal style={{ '--d': '80ms' }}>
                <article className="ll-card ll-card--lg">
                  <div className="ll-card-head">
                    <span className="ll-eyebrow ll-badge-green caption-3">For businesses</span>
                    <h3 className="heading-5">Show customers the truth about your store</h3>
                  </div>
                  <StepList steps={BUSINESS_STEPS} tone="green" />
                  <button type="button" className="ll-btn ll-btn--secondary ll-btn--block button-md" onClick={() => go('/create-business')}>
                    List your business
                  </button>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FAQ */}
        <section className="ll-section" aria-labelledby="faq-title">
          <div className="ll-container">
            <div className="ll-section-head" data-reveal>
              <span className="ll-eyebrow caption-3">FAQ</span>
              <h2 id="faq-title" className="heading-3">Questions people ask first</h2>
            </div>

            <div className="ll-faq" data-reveal>
              {FAQS.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div className="ll-faq-item" key={item.q}>
                    <h3>
                      <button
                        type="button"
                        className="ll-faq-q title-2"
                        aria-expanded={open}
                        aria-controls={`faq-panel-${i}`}
                        id={`faq-button-${i}`}
                        onClick={() => setOpenFaq(open ? -1 : i)}
                      >
                        <span>{item.q}</span>
                        <CaretDown className="ll-caret" size={20} weight="bold" aria-hidden="true" />
                      </button>
                    </h3>
                    {open && (
                      <div className="ll-faq-a body-3" id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-button-${i}`}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 7. Final CTA */}
        <section className="ll-section ll-section--alt" aria-labelledby="cta-title">
          <div className="ll-container">
            <div data-reveal>
              <div className="ll-cta">
                <h2 id="cta-title" className="heading-2">Check the map before your next errand.</h2>
                <p className="title-2">
                  Find out which stores are open in Odiongan, read their menus and plan the exact cash you will need.
                </p>
                <button type="button" className="ll-btn ll-btn--white button-md" onClick={() => go('/map')}>
                  Explore the map
                  <ArrowRight size={20} weight="bold" aria-hidden="true" />
                </button>
                <span className="ll-cta-note caption-1">Free to browse. No account needed.</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Footer */}
      <footer className="ll-footer">
        <div className="ll-container">
          <div className="ll-footer-inner">
            <span className="caption-2 ll-muted">
              © {new Date().getFullYear()} LocalLook. All rights reserved.
            </span>
            <nav className="ll-footer-links caption-1" aria-label="Legal">
              <a href="/privacy" onClick={link('/privacy')}>Privacy Policy</a>
              <a href="/terms" onClick={link('/terms')}>Terms of Service</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}