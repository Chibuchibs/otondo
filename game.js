/* OTONDO — core state machine. No framework, no DOM. Portable into Next.js. */

export const MAX_DAY = 21;
export const ACTIONS_PER_DAY = 2;

/* Camp has a shape, and so does this. Six actions available from day one meant
   a player had seen everything the game does by day 3 — which is exactly where
   the average run stopped. Actions now open on a schedule, and the ones still
   locked stay VISIBLE with the day they unlock. */
export const PHASES = [
  { from: 1,  to: 3,  name: 'Registration' },
  { from: 4,  to: 10, name: 'Drills & SAED' },
  { from: 11, to: 17, name: 'Competitions' },
  { from: 18, to: 21, name: 'Passing out' },
];
export const phaseOf = day =>
  PHASES.find(p => day >= p.from && day <= p.to) || PHASES[PHASES.length - 1];

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const chance = (rng, p) => rng() < p;

/* ---------- actions ---------- */
export const ACTIONS = {
  register: {
    label: 'Join the registration queue',
    hint: 'Collect your kit before the queue moves on.',
    from: 1, to: 3,
    play: 'register',
    run(s, rng, res) {
      const sc = res ? res.score : 0.5;
      const cred = 2 + Math.round(sc * 8);
      if (sc >= 0.99) s.friends += 1;
      apply(s, { energy: -14, belle: -8, cred });
      return `${res ? res.detail : 'You queued for hours.'} +${cred} credibility.`;
    },
  },
  parade: {
    label: 'Fall in for parade',
    hint: 'March A to B in step. Hot sun. Soldier watching.',
    play: 'parade',
    run(s, rng, res) {
      const sc = res ? res.score : 0.6;
      const cred = 4 + Math.round(sc * 12);
      apply(s, { energy: -18, belle: -12, cred });
      return `${res ? res.detail : 'You stood for parade under that sun.'} +${cred} credibility.`;
    },
  },
  mami: {
    label: 'Mami market',
    hint: 'Chop till your belle settle. Your money dey finish.',
    cost: 400,                      // cheapest thing on the fire
    play: 'mami',
    run(s, rng, res) {
      if (!res) { spend(s, 700); apply(s, { belle: 20, energy: 10, cred: 1 });
                  return 'You faced something small at Mami.'; }
      spend(s, res.spent || 0);
      apply(s, { belle: res.belle || 0, energy: Math.round((res.belle || 0) / 2), cred: 1 });
      return `${res.detail} ₦${(res.spent || 0).toLocaleString()} gone.`;
    },
  },
  hustle: {
    label: 'Hustle',
    hint: 'Pick three jobs. Big pay costs energy.',
    play: 'hustle',
    run(s, rng, res) {
      if (!res) { const p = 600 + Math.floor(rng() * 500); s.money += p;
                  apply(s, { energy: -14, belle: -8 });
                  return `You hustled small. ₦${p.toLocaleString()} entered.`; }
      s.money += res.earned || 0;
      apply(s, { energy: -(res.tired || 12), belle: -8 });
      return res.detail;
    },
  },
  manowar: {
    label: 'Man O War drill',
    hint: 'Cross the rope bridge without falling.',
    play: 'manowar',
    run(s, rng, res) {
      const sc = res ? res.score : (chance(rng, 0.22) ? 0.2 : 0.75);
      if ((res ? res.fell > 2 : sc < 0.3) && chance(rng, 0.45)) {
        s.injured = true;
        apply(s, { energy: -30, cred: 4 });
        return `${res ? res.detail : 'You landed badly.'} Clinic case. Still, credibility.`;
      }
      s.drills = (s.drills || 0) + 1;        // survived ones only — see awards.sql
      const cred = 6 + Math.round(sc * 16);
      apply(s, { energy: -28, belle: -14, cred });
      return `${res ? res.detail : 'You climbed, crawled and survived.'} +${cred} credibility.`;
    },
  },
  socialise: {
    label: 'Socialise',
    hint: 'Camp gist. Say the right thing.',
    play: 'socialise',
    run(s, rng, res) {
      const sc = res ? res.score : 0.6;
      s.friends += res ? (res.friends || 0) : 1;
      const cred = 2 + Math.round(sc * 10);
      apply(s, { energy: -8, cred });
      return `${res ? res.detail : 'You joined the gist.'} +${cred} credibility.`;
    },
  },
  saed: {
    label: 'SAED class',
    hint: 'Learn a trade. Materials cost ₦.',
    cost: 700,
    play: 'saed',
    run(s, rng, res) {
      const sc = res ? res.score : 0.5;
      /* A skill pays, but only once you have sat through enough of it. */
      s.saed = (s.saed || 0) + 1;
      spend(s, 700 + Math.floor(rng() * 400));      // materials
      const cred = 2 + Math.round(sc * 9);
      let line = res ? res.detail : 'SAED class. You learned something.';
      if (s.saed >= 3 && sc >= 0.5) {
        const pay = Math.round((700 + rng() * 900) * (0.6 + sc));
        s.money += pay;
        line += ` You sold your first one for ₦${pay.toLocaleString()}.`;
      }
      apply(s, { energy: -10, cred });
      return `${line} +${cred} credibility.`;
    },
  },
  sports: {
    label: 'Inter-platoon sports',
    hint: 'Football or basketball. You actually play this one.',
    /* Open from day one. Gating this behind day 11 meant almost nobody ever
       discovered the game is playable — the average run stopped at day 3.
       The hook has to be reachable in the first session. */
    from: 1,
    play: 'sport',                    // the UI picks football or hoop at random
    run(s, rng, res) {
      /* Falls back to a roll if the mini-game could not load, so a failed
         module never blocks a day's action. */
      const sc = res ? res.score : rng() * 0.7;
      const cred = 3 + Math.round(sc * 17);
      if (sc >= 0.99) s.friends += 1;
      apply(s, { energy: -18, belle: -10, cred });
      return `${res ? res.detail : 'You played for the platoon.'} +${cred} credibility.`;
    },
  },
  quiz: {
    label: 'Camp quiz night',
    hint: 'Five questions. Nigeria, culture, history.',
    play: 'quiz',
    run(s, rng, res) {
      const sc = res ? res.score : rng() * 0.6;
      const cred = 2 + Math.round(sc * 15);
      let line = res ? res.detail : 'You sat through quiz night.';
      if (sc >= 0.99) {
        const prize = 1500 + Math.floor(rng() * 1500);
        s.money += prize;
        line += ` Platoon prize: \u20a6${prize.toLocaleString()}.`;
      }
      s.friends += sc >= 0.6 ? 1 : 0;
      apply(s, { energy: -8, cred });
      return `${line} +${cred} credibility.`;
    },
  },
  social: {
    label: 'Social night',
    hint: 'MC calls the step. Do am sharp sharp.',
    cost: 400,
    play: 'social',
    run(s, rng, res) {
      const sc = res ? res.score : 0.5;
      spend(s, 400 + Math.floor(rng() * 500));      // minerals at the stand
      const cred = Math.round(-4 + sc * 18);        // freeze and it costs you
      s.friends += sc >= 0.5 ? 2 : 0;
      apply(s, { energy: -12, belle: -6, cred });
      return `${res ? res.detail : 'You danced at social night.'} ${cred >= 0 ? '+' : ''}${cred} credibility.`;
    },
  },
  rehearse: {
    label: 'Rehearse passing out',
    hint: 'Obey the drill. Mind the trick commands.',
    from: 18,
    play: 'rehearse',
    run(s, rng, res) {
      const sc = res ? res.score : 0.6;
      const cred = 3 + Math.round(sc * 14);
      apply(s, { energy: -15, belle: -8, cred });
      return `${res ? res.detail : 'Rehearsal for the passing out parade.'} +${cred} credibility.`;
    },
  },
  dodge: {
    label: 'Dodge and sleep',
    hint: 'Hit snooze. See how far you push it.',
    play: 'dodge',
    run(s, rng, res) {
      if (res && res.caught) {
        s.punished = true;
        apply(s, { energy: 16, cred: -14 });
        return `${res.detail} -14 credibility.`;
      }
      const sc = res ? res.score : 0.6;
      apply(s, { energy: 10 + Math.round(sc * 22), belle: -6, cred: -Math.round(2 + sc * 5) });
      return res ? res.detail : 'You slept through parade and nobody noticed.';
    },
  },
};

/* The full amount, below zero if that is where it lands. This used to cap
   at what the player had, on the theory that "₦-400" looks like a bug — but
   the cap meant a broke player paid nothing for anything, which is worse. The
   display now writes it "-₦400" in red, which reads as debt, not as a bug.
   Actions you choose still require the cash (see canAct); this is for the
   costs the game imposes on you. */
function spend(s, amount) {
  s.money -= amount;
  return amount;
}

const naira = n => (n < 0 ? '-' : '') + '₦' + Math.abs(n).toLocaleString();

function apply(s, d) {
  if (d.energy) s.energy = clamp(s.energy + d.energy);
  if (d.belle) s.belle = clamp(s.belle + d.belle);
  if (d.cred) s.cred = clamp(s.cred + d.cred, 0, 999);
}

/* ---------- events ---------- */
const EVENTS = [
  { id: 'rain', text: 'Rain catch everybody for parade ground. Na so people scatter.', fx: s => apply(s, { energy: -6, cred: 2 }) },
  { id: 'inspection', text: 'Morning inspection. Your bunk no make. Query.', fx: s => apply(s, { cred: -6 }) },
  { id: 'beans', text: 'Camp beans do you dirty. You spend the night for toilet.', fx: s => apply(s, { energy: -12, belle: -10 }) },
  { id: 'boots', text: 'Your jungle boot disappear. Somebody "borrow" am.', fx: s => { spend(s, 4000); apply(s, { cred: -3 }); } },
  { id: 'credit', text: 'Mami madam give you credit. God bless that woman.', fx: s => apply(s, { belle: 18 }) },
  { id: 'variety', text: 'You shine pass everybody for variety night. Platoon dey hail you.', fx: s => apply(s, { cred: 8, energy: -5 }) },
  { id: 'macho', text: 'Dem enter your name for Mr Macho. You no get the body, but platoon still dey shout.', fx: s => apply(s, { cred: 7, energy: -6 }) },
  { id: 'phone', text: 'Soldier seize phone for lecture. Your own enter.', fx: s => apply(s, { cred: -4 }) },
  { id: 'lecture', text: 'SAED lecture. You sleep with your eye open.', fx: s => apply(s, { energy: 6, cred: -2 }) },
  { id: 'nccf', text: 'NCCF fellowship. Somebody prophesy say you go marry for camp.', fx: s => { s.friends += 1; apply(s, { cred: 3 }); } },
  { id: 'queue', text: 'Three hours for registration queue. For nothing.', fx: s => apply(s, { energy: -10, belle: -8 }) },
  { id: 'water', text: 'No water for bathroom. You wash with pure water.', fx: s => apply(s, { energy: -6, cred: -1 }) },
  { id: 'crush',
    text: (s, rng) => {
      let p = 1 + Math.floor(rng() * 10);
      if (p === s.platoon) p = (p % 10) + 1;        // never your own platoon
      return `Person from Platoon ${p} dey look you since parade.`;
    },
    fx: s => { s.friends += 1; apply(s, { cred: 5 }); } },
  { id: 'bugle', text: 'Bugle blow 4:30am. You don already dey awake, dey stare ceiling.', fx: s => apply(s, { energy: -4 }) },
  { id: 'drill', text: 'Drill sergeant make the whole platoon start again. Because of you.', fx: s => apply(s, { cred: -8, energy: -8 }) },
  { id: 'allawee_rumour', text: 'Rumour say allawee don enter. Allawee no enter.', fx: s => apply(s, { cred: 0 }) },
  { id: 'bank_queue', text: 'You queue since morning to register account for allawee. Network no gree.', fx: s => apply(s, { energy: -10, belle: -6 }) },
  { id: 'photo', text: 'Camp photographer snap you as you dey sneeze. E don turn meme.', fx: s => apply(s, { cred: 6 }) },
  { id: 'borrow', text: 'Stranger borrow ₦5,000, swear say he go pay. He no go pay.', fx: s => { spend(s, 5000); s.friends += 1; } },
  { id: 'cook', text: 'You help carry cook pot. Extra portion enter your plate.', fx: s => apply(s, { belle: 20, energy: -6 }) },
  { id: 'nothing', text: 'Nothing happen today. Camp just long.', fx: () => {} },

  /* Second batch. Same rule as the first: every line must be something that
     actually happens in camp, told the way a corper would tell it. */
  { id: 'otondo_call', text: 'Soldier shout "OTONDO!" and the whole parade ground turn look you. Na you.', fx: s => apply(s, { cred: -5 }) },
  { id: 'mami_debt', text: 'Mami madam write your name for her book. The book dey grow.', fx: s => apply(s, { belle: 14, cred: -2 }) },
  { id: 'bucket', text: 'Your bucket waka. Na the same person wey you greet this morning carry am.', fx: s => { spend(s, 1500); apply(s, { cred: -2 }); } },
  { id: 'khaki_shrink', text: 'Your khaki shrink after one wash. Now e fit secondary school pikin.', fx: s => apply(s, { cred: -4 }) },
  { id: 'face_card', text: 'You try sign out go town. Soldier ask for your face card. Face card no work.', fx: s => apply(s, { energy: -8, cred: -3 }) },
  { id: 'endurance_dance', text: 'Platoon drag you out for endurance dance. The video don reach Lagos.', fx: s => { s.friends += 1; apply(s, { cred: 9, energy: -10 }); } },
  { id: 'torchlight', text: 'NEPA take light for hostel. Na one torchlight dey serve forty people.', fx: s => apply(s, { energy: -6 }) },
  { id: 'prayer', text: 'Camp pastor call you out make you pray for better posting. You pray with your chest.', fx: s => { s.friends += 1; apply(s, { cred: 4 }); } },
  { id: 'queue_cut', text: 'Person cut queue for breakfast front of you. You vex. You no talk.', fx: s => apply(s, { belle: -8, cred: -1 }) },
  { id: 'jog_small', text: 'Morning PT. Soldier say make una "jog small". Una jog five kilometre.', fx: s => apply(s, { energy: -16, cred: 5 }) },
  { id: 'white_tshirt', text: 'Your white t-shirt waka from the line. Na the same person again.', fx: s => { spend(s, 2000); apply(s, { cred: -2 }); } },
  { id: 'mattress', text: 'Camp mattress thin like paper. Your back don sabi the ground by now.', fx: s => apply(s, { energy: -8 }) },
  { id: 'hostel_gist', text: 'Hostel gist go reach 2am. Nobody sleep. Bugle no send anybody.', fx: s => { s.friends += 1; apply(s, { energy: -12, cred: 3 }); } },
  { id: 'kitman', text: 'Kit man say your size don finish. You collect boot wey pass you by two size.', fx: s => apply(s, { energy: -6, cred: -3 }) },
  { id: 'camp_id', text: 'Dem snap your camp ID. Your eye close for the picture. Forever.', fx: s => apply(s, { cred: 2 }) },
  { id: 'same_slippers', text: 'Camp market open. Now everybody for hostel get the same slippers.', fx: s => { spend(s, 1200); apply(s, { cred: 1 }); } },
];

/* Fixed days, so there is something to look forward to rather than 21 days of
   the same random draw. These override the random event entirely. */
const MILESTONES = {
  3:  { text: 'SWEARING-IN. You raise your right hand before the Chief Judge and swear to serve. Na now you be corper proper.',
        fx: s => { apply(s, { cred: 10, energy: -8 }); } },
  7:  { text: 'First week don finish. Camp commandant hail everybody for assembly.',
        fx: s => { apply(s, { cred: 6 }); s.friends += 1; } },
  10: { text: 'MID-CAMP SPORTS FINAL. Whole camp gather for the field. Platoon war.',
        fx: s => { apply(s, { cred: 6, energy: -12 }); s.friends += 1; } },
  14: { text: 'CULTURAL CARNIVAL. Platoon levy for attire — everybody drop. Camp turn colour.',
        fx: s => { spend(s, 2500); apply(s, { cred: 9, energy: -10, belle: -6 }); s.friends += 2; } },
  17: { text: 'MISS CAMP & MR MACHO night. Dem crown winners. You shout till your voice cut.',
        fx: s => { apply(s, { cred: 7, energy: -8 }); s.friends += 1; } },
  20: { text: 'FINAL REHEARSAL for passing out. Dem hand out posting letters tomorrow.',
        fx: s => { apply(s, { cred: 5, energy: -10 }); } },
};

/* ---------- postings ---------- */
const POSTINGS = {
  soft: ['Lagos — Victoria Island', 'Abuja — Central Area', 'Port Harcourt GRA', 'Ibadan — Bodija', 'Your own home state'],
  mid: ['Enugu', 'Kaduna town', 'Benin City', 'Abeokuta', 'Jos', 'Uyo'],
  hard: ['Zamfara', 'Yobe', 'Taraba — deep inside', 'Bayelsa riverine', 'A village with no network', 'Borno'],
};

/* The same arithmetic computePosting rolls against, exposed so the player can
   watch it move. Hidden, credibility was an abstract number climbing for no
   stated reason and the payoff — the posting — did not exist until day 21.
   Visible, every action is a bet on where you end up:
     cred   0  ->  soft  5%  mid 40%  hard 55%
     cred 100  ->  soft 40%  mid 40%  hard 20%
     cred 200  ->  soft 75%  mid 25%  hard  0%  */
export function postingOdds(s) {
  const t = (s.cred || 0) * 0.35, cl = x => Math.max(0, Math.min(1, x));
  const soft = cl((5 + t) / 100);
  const hard = cl((55 - t) / 100);
  return { soft, mid: Math.max(0, 1 - soft - hard), hard };
}

export function computePosting(s, rng) {
  const roll = rng() * 100 + s.cred * 0.35;
  if (roll > 95) return { tier: 'soft', place: pick(rng, POSTINGS.soft), emoji: '🎉' };
  if (roll > 55) return { tier: 'mid', place: pick(rng, POSTINGS.mid), emoji: '🙂' };
  return { tier: 'hard', place: pick(rng, POSTINGS.hard), emoji: '😭' };
}

/* ---------- lifecycle ---------- */
/* A platoon-mate serving the same 21 days. The game was solitaire: your
   credibility climbed against nothing, so there was no way to be DOING BADLY,
   only slowly. A rival turns the odds panel from a progress bar into a
   scoreboard. Beatable on purpose — ends around 190 cred, where the simulated
   average player lands at 231 and a poor one at 105. */
const RIVAL_NAMES = ['Chidi', 'Ngozi', 'Musa', 'Tunde', 'Amaka', 'Bisi',
                     'Emeka', 'Hauwa', 'Segun', 'Ifeoma', 'Yusuf', 'Chioma'];

export function newRival(rng = Math.random) {
  return { name: pick(rng, RIVAL_NAMES), cred: 0 };
}

/* Saves written before rivals existed have no s.rival, and there are players
   mid-camp right now. Never assume it is there. */
export function rivalOf(s, rng = Math.random) {
  if (!s.rival) {
    s.rival = newRival(rng);
    /* Back-fill. There are players mid-camp whose saves predate rivals; giving
       them an opponent starting from zero on day 15 would hand them a lead they
       never earned and make the scoreboard meaningless. Credit the rival for
       the days already served, at the same ~11.5/day they would have gained. */
    s.rival.cred = Math.round(Math.max(0, (s.day || 1) - 1) * 11.5);
  }
  return s.rival;
}

export function newGame(name, rng = Math.random) {
  return {
    name: (name || 'Otondo').slice(0, 16),
    rival: newRival(rng),
    platoon: 1 + Math.floor(rng() * 10),
    day: 1,
    actionsLeft: ACTIONS_PER_DAY,
    energy: 80, belle: 70, money: 20000, cred: 0,
    friends: 0, drills: 0, saed: 0, injured: false, punished: false,
    phase: 'day',
    log: [],
    posting: null,
  };
}

/* Separate from canDo on purpose: the UI needs to SHOW a locked action and the
   day it opens. Hiding them is what made the game look finished on day 3. */
export function unlocked(s, key) {
  const a = ACTIONS[key];
  if (!a) return false;
  return s.day >= (a.from || 1) && s.day <= (a.to || MAX_DAY);
}

export function canDo(s, key) {
  const a = ACTIONS[key];
  if (!a) return false;
  if (s.phase !== 'day' || s.actionsLeft <= 0) return false;
  if (!unlocked(s, key)) return false;
  if (a.cost && s.money < a.cost) return false;
  if (key === 'manowar' && s.injured) return false;
  return true;
}

export function doAction(s, key, rng = Math.random, result = null) {
  if (!canDo(s, key)) return s;
  const msg = ACTIONS[key].run(s, rng, result);
  s.log.unshift({ day: s.day, text: msg });
  s.actionsLeft -= 1;
  if (s.actionsLeft <= 0) endDay(s, rng);
  return s;
}

function endDay(s, rng) {
  const ms = MILESTONES[s.day];
  const ev = ms || pick(rng, EVENTS);
  const line = typeof ev.text === 'function' ? ev.text(s, rng) : ev.text;
  ev.fx(s, rng);
  s.log.unshift({ day: s.day, text: line, event: true, milestone: !!ms });

  /* No allawee inside camp. The ₦77,000 is paid 25th-30th into an account you
     only register once you get here — so it lands AFTER you pass out. You spend
     all 21 days on the money you brought. */

  /* The rival serves their own day. Random enough that the gap moves, steady
     enough that falling behind means you actually fell behind. */
  const r = rivalOf(s, rng);
  /* Tuned by sweeping daily gain against simulated runs. +4..14 left the rival
     beatable 92% of the time by an AVERAGE player — no tension at all. At
     +6..17 a strong player still wins 98%, an average one is a 58% coin-flip,
     and a careless one never wins. Skill decides it, which is the point. */
  r.cred += 6 + Math.floor(rng() * 12);

  // overnight
  apply(s, { energy: 14, belle: -10 });
  if (s.energy <= 5 || s.belle <= 5) {
    apply(s, { energy: 20, belle: 20, cred: -5 });
    s.log.unshift({ day: s.day, text: 'You collapsed. Clinic admitted you overnight. -5 credibility.', event: true });
  }
  s.injured = false;
  s.punished = false;

  if (s.day >= MAX_DAY) {
    s.phase = 'ending';
    s.posting = computePosting(s, rng);
  } else {
    s.day += 1;
    s.actionsLeft = ACTIONS_PER_DAY;
  }
}

/* What the player has to look forward to. Drives the line under the actions —
   "Man O War opens day 4" is the whole reason to come back tomorrow. */
export function nextUnlock(s) {
  const future = Object.entries(ACTIONS)
    .filter(([, a]) => (a.from || 1) > s.day)
    .sort((a, b) => (a[1].from || 1) - (b[1].from || 1));
  if (future.length) {
    const [, a] = future[0];
    return { day: a.from, what: a.label };
  }
  const ms = Object.keys(MILESTONES).map(Number).filter(d => d > s.day).sort((a, b) => a - b);
  return ms.length ? { day: ms[0], what: 'Something big' } : null;
}

export function shareText(s) {
  if (!s.posting) return '';
  return `I survived camp as a Platoon ${s.platoon} otondo.\nCredibility ${s.cred} · ${naira(s.money)} · ${s.friends} friends\nPosted to: ${s.posting.place.toUpperCase()} ${s.posting.emoji}\n\nPlay Otondo:`;
}
