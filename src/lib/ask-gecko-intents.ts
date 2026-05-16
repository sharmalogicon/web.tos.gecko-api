/**
 * Ask Gecko — intent matching for the in-app AI assist widget.
 *
 * Phase 1 (demo): deterministic regex/keyword matching against a curated set
 * of known questions. Real responses, real navigation links — feels alive
 * even without an LLM call.
 *
 * Phase 2 (production): swap dispatchAskGecko() for a call to
 * Gecko.AI.Service.AskGecko. UI doesn't change; audit log captures the
 * request/response/cost, confidence chip appears beside answers. See
 * docs/08-AI-STRATEGY.md.
 */

export interface AssistantCTA {
  label: string;
  href: string;
}

export interface AssistantReply {
  text: string;         // plain text; supports inline **bold**
  ctas?: AssistantCTA[];
  followUps?: string[]; // suggested next questions shown as chips
}

interface Intent {
  id: string;
  match: (lowerInput: string) => boolean;
  handle: (originalInput: string) => AssistantReply;
}

/* ──────────────────────────────────────────────────────────────────────────
   Known containers + bookings — small in-file mock so the chat is always
   "alive" without needing to thread the booking page mocks into here.
   ────────────────────────────────────────────────────────────────────────── */

const KNOWN_CONTAINERS: Record<string, {
  status: string; lastMove: string; truck: string; customer: string;
  vessel: string; voyage: string; dwell: number; holds?: string;
}> = {
  MAEU7234561: {
    status: 'LADEN EXPORT · delivered', lastMove: 'Gate-OUT · 24 Apr 2026 14:32',
    truck: '70-1234', customer: 'KCE Electronics PCL',
    vessel: 'EVER WEB', voyage: '0344-022B', dwell: 15,
  },
  ONEU3398472: {
    status: 'LADEN IMPORT · in yard', lastMove: 'Gate-IN · 11 May 2026 09:18',
    truck: '70-5678', customer: 'CP Foods Co., Ltd.',
    vessel: 'ONE COMMITMENT', voyage: 'C-308S', dwell: 5,
  },
  CMAU8843901: {
    status: 'LADEN IMPORT · customs hold', lastMove: 'Gate-IN · 23 Apr 2026 11:08',
    truck: '71-9981', customer: 'Charoen Pokphand Foods PCL',
    vessel: 'CMA MARCO POLO', voyage: '0712E', dwell: 23,
    holds: 'Customs verification — open since 23 Apr',
  },
  COSU9981233: {
    status: 'LADEN IMPORT · in yard', lastMove: 'Gate-IN · 29 Apr 2026 16:42',
    truck: '70-3344', customer: 'Indorama Ventures PCL',
    vessel: 'COSCO PRIDE', voyage: '305E', dwell: 17,
  },
  EGHU9213381: {
    status: 'LADEN EXPORT · in yard', lastMove: 'Gate-IN · 24 Apr 2026 00:31',
    truck: 'GISCT1260412201', customer: 'TCL Electronics (Thailand)',
    vessel: 'EVER WEB', voyage: '0344-022B', dwell: 22,
  },
};

const KNOWN_BOOKINGS: Record<string, {
  customer: string; agent: string; type: string; orderType: string;
  vessel: string; voyage: string; etd: string; status: string;
  containers: { total: number; gatedIn: number };
}> = {
  EGLV149602390729: {
    customer: 'TCL Electronics (Thailand) Co., Ltd', agent: 'EVERGREEN',
    type: 'EXPORT', orderType: 'EXP CY/CY',
    vessel: 'EVER WEB', voyage: '0344-022B', etd: '21 Jun 2026',
    status: 'ACTIVE', containers: { total: 8, gatedIn: 5 },
  },
  EGLV149612498744: {
    customer: 'Thai Union Group PCL', agent: 'EVERGREEN',
    type: 'EXPORT', orderType: 'EXP CY/CY',
    vessel: 'EVER WEB', voyage: '0344-022B', etd: '21 Jun 2026',
    status: 'ACTIVE', containers: { total: 12, gatedIn: 8 },
  },
  EGLV149600114985: {
    customer: 'PTT Global Chemical PCL', agent: 'EVERGREEN',
    type: 'EXPORT', orderType: 'EXP CY/CY',
    vessel: 'EVER WEB', voyage: '0344-022B', etd: '21 Jun 2026',
    status: 'ACTIVE', containers: { total: 6, gatedIn: 6 },
  },
};

/* ──────────────────────────────────────────────────────────────────────────
   Intent matchers
   ────────────────────────────────────────────────────────────────────────── */

const RE_CONTAINER = /\b([A-Z]{4})\s*(\d{7})\b/;
const RE_BOOKING   = /\b([A-Z]{4})(\d{10,16})\b/;

function normalizeContainer(input: string): string | null {
  const m = input.toUpperCase().match(RE_CONTAINER);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

function normalizeBooking(input: string): string | null {
  const m = input.toUpperCase().match(RE_BOOKING);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

const INTENTS: Intent[] = [
  /* ── 1. Container status lookup ────────────────────────────────────── */
  {
    id: 'container-status',
    match: (q) => RE_CONTAINER.test(q.toUpperCase()) && !/booking|bl no|b\/l/.test(q),
    handle: (input) => {
      const id = normalizeContainer(input);
      if (!id) return fallback();
      const c = KNOWN_CONTAINERS[id];
      if (!c) {
        return {
          text: `I couldn't find container **${id}** in the current yard or recent history. It may belong to another depot or be older than 90 days.\n\nDouble-check the number, or try one of the demo containers: MAEU7234561, ONEU3398472, CMAU8843901.`,
        };
      }
      return {
        text:
          `**Container ${id}** — ${c.status}.\n\n` +
          `Last move: ${c.lastMove} by truck ${c.truck}.\n` +
          `Customer: ${c.customer}.\n` +
          `Vessel: ${c.vessel} / ${c.voyage}.\n` +
          `Dwell: ${c.dwell} day${c.dwell === 1 ? '' : 's'} on yard.` +
          (c.holds ? `\n\n⚠ Hold: ${c.holds}` : ''),
        ctas: [
          { label: 'View container history', href: '/units/unit-inquiry' },
          { label: 'Open yard view', href: '/gate/yard-view' },
        ],
        followUps: [`Show ${c.customer.split(' ')[0]}'s bookings`, 'Show longest dwell'],
      };
    },
  },

  /* ── 2. Booking lookup ─────────────────────────────────────────────── */
  {
    id: 'booking-lookup',
    match: (q) => RE_BOOKING.test(q.toUpperCase()) || /booking|bl no|b\/l/.test(q),
    handle: (input) => {
      const id = normalizeBooking(input);
      if (!id) {
        return {
          text: `To look up a booking, give me the full B/L number — e.g. **EGLV149602390729**.`,
          followUps: ['Show pending bookings for Thai Union', 'Open Bookings register'],
        };
      }
      const b = KNOWN_BOOKINGS[id];
      if (!b) {
        return {
          text: `I couldn't find booking **${id}**. Try EGLV149602390729 (TCL Electronics) or EGLV149612498744 (Thai Union).`,
          ctas: [{ label: 'Open Bookings register', href: '/bookings' }],
        };
      }
      return {
        text:
          `**Booking ${id}** — ${b.customer}, ${b.type} via ${b.agent}.\n\n` +
          `Order Type: ${b.orderType}. Vessel: ${b.vessel} / ${b.voyage}. ETD: ${b.etd}.\n` +
          `Status: ${b.status} · ${b.containers.gatedIn} of ${b.containers.total} containers gated-in.`,
        ctas: [{ label: 'Open booking', href: `/bookings/${id}` }],
        followUps: ['Show containers in this booking', 'Show pending billing for this customer'],
      };
    },
  },

  /* ── 3. Pending statements / unbilled count ────────────────────────── */
  {
    id: 'pending-billing',
    match: (q) => /pending.*(bill|invoic|statement)|statements? pending|how many.*(bill|unbill)/.test(q),
    handle: () => ({
      text:
        `**47 statements** are pending billing, totalling **฿4.28M**.\n\n` +
        `5 of them are over 14 days old — oldest is from **2 May** (Thai Union Group, ฿312,400).\n` +
        `Largest by value: PTT Global Chemical at ฿892,150.`,
      ctas: [
        { label: 'Open Unbilled Services', href: '/billing/unbilled' },
        { label: 'Open Billing Statements', href: '/billing/statement' },
      ],
      followUps: ['Show oldest unbilled', 'Unbilled for Thai Union'],
    }),
  },

  /* ── 4. Customer-scoped unbilled ───────────────────────────────────── */
  {
    id: 'customer-unbilled',
    match: (q) => /unbilled.*(for|by)|.*(thai union|kce|cp foods|ptt|aeon|siam|betagro|charoen).*(unbill|pending|billing)/.test(q),
    handle: (input) => {
      const lower = input.toLowerCase();
      let customer = 'the customer';
      let count = 0; let total = '฿0'; let oldest = '—';
      if (/thai union/.test(lower))       { customer = 'Thai Union Group'; count = 14; total = '฿1.24M'; oldest = '27 Apr'; }
      else if (/kce/.test(lower))          { customer = 'KCE Electronics';   count = 6;  total = '฿312,400'; oldest = '2 May'; }
      else if (/cp foods?/.test(lower))    { customer = 'CP Foods';          count = 8;  total = '฿428,900'; oldest = '4 May'; }
      else if (/ptt/.test(lower))          { customer = 'PTT Global Chemical';count = 11; total = '฿892,150'; oldest = '21 Apr'; }
      else if (/aeon/.test(lower))         { customer = 'AEON Thailand';     count = 3;  total = '฿98,400'; oldest = '12 May'; }
      else if (/charoen|cpf/.test(lower))  { customer = 'Charoen Pokphand';  count = 9;  total = '฿612,300'; oldest = '23 Apr'; }
      return {
        text:
          `**${customer}** has **${count}** unbilled booking${count === 1 ? '' : 's'} totalling **${total}**.\n\n` +
          `Oldest is from ${oldest}. Charges include storage, lift-off, and reefer monitoring.`,
        ctas: [{ label: 'Open filtered list', href: '/billing/unbilled' }],
        followUps: ['Show oldest 5', 'Send to invoice'],
      };
    },
  },

  /* ── 5. Today's gate traffic ───────────────────────────────────────── */
  {
    id: 'gate-traffic',
    match: (q) => /gate.*traffic|today.*gate|gate.*today|how.*many.*truck|truck.*today/.test(q),
    handle: () => ({
      text:
        `**Today's gate** (06:00 → now):\n\n` +
        `• Total moves: **158** (92 inbound, 66 outbound)\n` +
        `• Average turn-around: **38 minutes**\n` +
        `• Peak hour: 09:00–10:00 (32 trucks)\n` +
        `• Currently busiest lane: **IN-03** (queue of 4 trucks)\n` +
        `• Lane status: OUT-02 offline, all others operational`,
      ctas: [
        { label: 'Open Gate Traffic dashboard', href: '/dashboard/gate-traffic' },
        { label: 'Open Gate Appointments', href: '/gate/appointments' },
      ],
      followUps: ['Show busiest yard block', 'Open kiosk view'],
    }),
  },

  /* ── 6. Busiest yard block ─────────────────────────────────────────── */
  {
    id: 'busiest-yard',
    match: (q) => /busiest|most.*loaded|crowded.*yard|yard.*occup|critical.*block/.test(q),
    handle: () => ({
      text:
        `**Top 3 most-loaded blocks** right now:\n\n` +
        `1. **IMP-A2** — 94% util (Maersk reserved, 286 / 304 TEU)\n` +
        `2. **EXP-B2** — 88% util (Thai Union reserved, 254 / 288 TEU)\n` +
        `3. **MT-E3** — 86% util (COSCO empties, 496 / 576 TEU)\n\n` +
        `⚠ **IMP-A2 is in critical band** (>85%). Consider escalating or pre-positioning empties.`,
      ctas: [
        { label: 'Open Yard at a Glance', href: '/dashboard/yard-glance' },
        { label: 'Open full Yard view', href: '/gate/yard-view' },
      ],
      followUps: ['Show longest dwell', 'Reefer plug status'],
    }),
  },

  /* ── 7. Longest dwell / oldest container ───────────────────────────── */
  {
    id: 'longest-dwell',
    match: (q) => /longest.*dwell|oldest.*container|dwell.*break|stale.*container|aged.*container/.test(q),
    handle: () => ({
      text:
        `**Container CMAU8843901** has the longest dwell — **23 days**.\n\n` +
        `Customer: Charoen Pokphand Foods. Hold reason: customs verification (open since 23 Apr).\n\n` +
        `Next 4 over 14 days:\n` +
        `• EGHU9213381 — 22d (TCL Electronics)\n` +
        `• COSU9981233 — 17d (Indorama Ventures)\n` +
        `• MAEU7234561 — 15d (KCE Electronics)\n` +
        `• OOLU1122334 — 14d (Bangchak Corporation)`,
      ctas: [
        { label: 'Open Dwell-Time dashboard', href: '/dashboard/dwell-time' },
        { label: 'Show all holds', href: '/masters/holds' },
      ],
      followUps: ['Where is CMAU8843901?', 'Show busiest yard block'],
    }),
  },

  /* ── 8. Reefer plug status ─────────────────────────────────────────── */
  {
    id: 'reefer-plugs',
    match: (q) => /reefer.*plug|plug.*usage|reefer.*status|reefer.*utiliz/.test(q),
    handle: () => ({
      text:
        `**Reefer plugs:** 41 active / 56 capacity (**73% utilization**).\n\n` +
        `All within normal band. No alerts currently.\n\n` +
        `• **RF-C1** — 12 / 16 plugs active (4 free)\n` +
        `• **RF-C2** — 13 / 24 plugs active (11 free)\n` +
        `• **Other blocks** — 16 reefer containers on incidental plug points\n\n` +
        `Next reefer event: PTI scheduled in 2 hours for 3 containers (MAEU/ONEU).`,
      ctas: [
        { label: 'Open Yard at a Glance · Reefer lens', href: '/dashboard/yard-glance' },
      ],
      followUps: ['Show today\'s PTI events', 'Show reefer charges this week'],
    }),
  },

  /* ── 9. Daily / shift summary ──────────────────────────────────────── */
  {
    id: 'daily-summary',
    match: (q) => /daily.*summary|shift.*summary|today.*summary|what.*happen.*today|overview.*today/.test(q),
    handle: () => ({
      text:
        `**Today's shift** (06:00 → now):\n\n` +
        `• Gate moves: **158** (92 in / 66 out) · avg turn-around 38 min\n` +
        `• Invoices generated: **12** (฿2.1M billed)\n` +
        `• Pending billing: **47** statements (฿4.28M)\n` +
        `• Dwell breaches: **5** containers over 14d\n` +
        `• Reefer plugs: 73% util · no alerts\n` +
        `• Critical yard block: IMP-A2 at 94% util\n` +
        `• Open holds: **3** customs · **1** legal`,
      ctas: [
        { label: 'Open Operations Overview', href: '/dashboard/overview' },
        { label: 'Open Yard at a Glance', href: '/dashboard/yard-glance' },
      ],
      followUps: ['Show pending billing', 'Show longest dwell'],
    }),
  },

  /* ── 10. Navigation ────────────────────────────────────────────────── */
  {
    id: 'navigation',
    match: (q) => /^(open|take me to|go to|show me the?)\s+/.test(q.toLowerCase()),
    handle: (input) => {
      const lower = input.toLowerCase();
      const routes: { keywords: RegExp; label: string; href: string }[] = [
        { keywords: /yard.?(at.?)?(a.?)?glance|yard.?dashboard|aerial/, label: 'Yard at a Glance', href: '/dashboard/yard-glance' },
        { keywords: /yard.?view|yard.?plan|yard.?map|heatmap/,            label: 'Yard view',           href: '/gate/yard-view' },
        { keywords: /yard.?zones?|yard.?editor/,                          label: 'Yard editor',         href: '/config/yard-zones' },
        { keywords: /kiosk/,                                              label: 'Gate Kiosk',          href: '/gate/kiosk' },
        { keywords: /auto.?gate/,                                         label: 'Auto-Gate',           href: '/config/auto-gate' },
        { keywords: /appointment/,                                        label: 'Gate Appointments',   href: '/gate/appointments' },
        { keywords: /eir.?out/,                                           label: 'EIR-Out',             href: '/gate/eir-out' },
        { keywords: /eir.?in/,                                            label: 'EIR-In',              href: '/gate/eir-in' },
        { keywords: /tariff/,                                             label: 'Tariff Schedules',    href: '/tariff/plans' },
        { keywords: /unbilled/,                                           label: 'Unbilled Services',   href: '/billing/unbilled' },
        { keywords: /statement/,                                          label: 'Billing Statements',  href: '/billing/statement' },
        { keywords: /invoice/,                                            label: 'Invoices',            href: '/billing/invoices' },
        { keywords: /booking/,                                            label: 'Bookings register',   href: '/bookings' },
        { keywords: /vessel.?sched|voyage.?calendar/,                     label: 'Vessel Schedule',     href: '/masters/vessels/schedule' },
        { keywords: /order.?type/,                                        label: 'Order Types',         href: '/masters/order-types' },
        { keywords: /notification|integration/,                           label: 'Notifications',       href: '/config/integrations' },
        { keywords: /workflow|approval/,                                  label: 'Approval Workflows',  href: '/config/approval-workflows' },
        { keywords: /operational.?report/,                                label: 'Operational Reports', href: '/reports/operational' },
        { keywords: /account.?report/,                                    label: 'Accounts Reports',    href: '/reports/accounts' },
        { keywords: /schedule.?report|auto.?schedule/,                    label: 'Auto-Schedule Reports', href: '/reports/schedule' },
        { keywords: /dashboard|overview/,                                 label: 'Operations Overview', href: '/dashboard/overview' },
        { keywords: /gate.?traffic/,                                      label: 'Gate Traffic',        href: '/dashboard/gate-traffic' },
        { keywords: /dwell/,                                              label: 'Dwell-Time dashboard', href: '/dashboard/dwell-time' },
        { keywords: /report/,                                             label: 'Operational Reports', href: '/reports/operational' },
      ];
      const hit = routes.find(r => r.keywords.test(lower));
      if (hit) {
        return {
          text: `Opening **${hit.label}**…`,
          ctas: [{ label: `Go to ${hit.label}`, href: hit.href }],
        };
      }
      return {
        text: `I'm not sure which page you mean. Try saying **"open tariff"**, **"open yard view"**, **"open unbilled"**, or **"open reports"**.`,
        followUps: ['Open Yard at a Glance', 'Open Unbilled Services', 'Open Tariff Schedules'],
      };
    },
  },

  /* ── 11. Greeting ──────────────────────────────────────────────────── */
  {
    id: 'greeting',
    match: (q) => /^(hi|hello|hey|good morning|good afternoon|sawatdee|halo)\b/.test(q),
    handle: () => ({
      text:
        `Hi! I can help with **container lookups**, **billing**, **yard status**, **gate traffic**, and quick navigation.\n\n` +
        `Try one of the suggestions below.`,
      followUps: [
        'Where is container MAEU7234561?',
        'How many statements pending billing?',
        'Today\'s gate traffic',
        'Show busiest yard block',
      ],
    }),
  },

  /* ── 12. Help / capability discovery ───────────────────────────────── */
  {
    id: 'help',
    match: (q) => /^(help|what can you|capabilities|what can i ask)/.test(q),
    handle: () => ({
      text:
        `I can help you with:\n\n` +
        `• **Container lookups** — give me a container number (e.g. *Where is MAEU7234561?*)\n` +
        `• **Booking status** — give me a booking / B-L number\n` +
        `• **Billing** — pending statements, unbilled bookings by customer\n` +
        `• **Operations** — gate traffic, yard occupancy, reefer plugs, longest dwell\n` +
        `• **Daily summary** — today's shift snapshot\n` +
        `• **Navigation** — say *"open [page name]"*`,
      followUps: ['Daily summary', 'Where is MAEU7234561?', 'Open Yard at a Glance'],
    }),
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────────── */

export function dispatchAskGecko(input: string): AssistantReply {
  const lower = input.trim().toLowerCase();
  if (!lower) return fallback();
  for (const intent of INTENTS) {
    if (intent.match(lower)) {
      return intent.handle(input.trim());
    }
  }
  return fallback();
}

function fallback(): AssistantReply {
  return {
    text:
      `I'm not sure I caught that. Here's what I can help with:\n\n` +
      `• **Container lookup** — give me a container number\n` +
      `• **Booking status** — give me a B-L number\n` +
      `• **Billing** — *"how many statements pending?"*\n` +
      `• **Operations** — *"gate traffic"*, *"busiest yard block"*, *"reefer plug status"*\n` +
      `• **Navigation** — *"open [page name]"*`,
    followUps: [
      'Where is container MAEU7234561?',
      'How many statements pending billing?',
      'Today\'s gate traffic',
      'Show busiest yard block',
    ],
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Welcome message — shown when the chat first opens
   ────────────────────────────────────────────────────────────────────────── */

export const WELCOME_SUGGESTIONS: string[] = [
  'Where is container MAEU7234561?',
  'How many statements pending billing?',
  'Today\'s gate traffic',
  'Show busiest yard block',
];

export const WELCOME_TEXT =
  `Hi! I can help with **container lookups**, **billing**, **yard status**, and quick navigation. Try one of these:`;
