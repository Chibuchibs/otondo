/* OTONDO — core state machine. No framework, no DOM. Portable into Next.js. */

export const MAX_DAY = 21;
export const ACTIONS_PER_DAY = 2;

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const chance = (rng, p) => rng() < p;

/* ---------- actions ---------- */
export const ACTIONS = {
  parade: {
    label: 'Fall in for parade',
    hint: 'Hot sun. Soldier watching.',
    run(s, rng) {
      const cred = 6 + Math.floor(rng() * 5);
      apply(s, { energy: -18, belle: -12, cred });
      return `You stood for parade under that sun. +${cred} credibility.`;
    },
  },
  mami: {
    label: 'Mami market',
    hint: 'Indomie, boli, soaked garri — costs ₦',
    cost: 400,                      // cheapest thing on the fire
    run(s, rng) {
      const menu = [
        ['indomie and egg',        1200, 28, 14],
        ['boli and groundnut',      700, 20, 10],
        ['soaked garri with milk',  600, 22, 16],
        ['cold minerals',           400, 12,  8],
      ];
      const afford = menu.filter(i => i[1] <= s.money);
      const item = pick(rng, afford.length ? afford : [menu[3]]);
      spend(s, item[1]);
      apply(s, { belle: item[2], energy: item[3], cred: 1 });
      return `You faced ${item[0]} at Mami. ₦${item[1].toLocaleString()} gone, but belle dey settle.`;
    },
  },
  hustle: {
    label: 'Hustle',
    hint: 'Laundry, charge phones, sell recharge card',
    run(s, rng) {
      const gig = pick(rng, [
        ['washed khaki for three people', 500],
        ['charged phones at the generator', 800],
        ['sold recharge cards', 650],
        ['plaited hair in the hostel', 950],
      ]);
      const pay = gig[1] + Math.floor(rng() * 400);
      s.money += pay;
      apply(s, { energy: -14, belle: -8 });
      return `You ${gig[0]}. ₦${pay.toLocaleString()} entered.`;
    },
  },
  manowar: {
    label: 'Man O War drill',
    hint: 'Big credibility. Bigger risk.',
    run(s, rng) {
      if (chance(rng, 0.22)) {
        s.injured = true;
        apply(s, { energy: -30, cred: 4 });
        return 'You tried the rope and landed badly. Clinic case. Still, credibility.';
      }
      const cred = 14 + Math.floor(rng() * 8);
      s.drills = (s.drills || 0) + 1;        // survived ones only — see awards.sql
      apply(s, { energy: -28, belle: -14, cred });
      return `You climbed, crawled and survived Man O War. +${cred} credibility.`;
    },
  },
  socialise: {
    label: 'Socialise',
    hint: 'NCCF, variety night, platoon gist',
    run(s, rng) {
      s.friends += 1;
      const cred = 4 + Math.floor(rng() * 6);
      apply(s, { energy: -8, cred });
      return `You joined the gist. Platoon ${s.platoon} knows your name now. +${cred} credibility.`;
    },
  },
  dodge: {
    label: 'Dodge and sleep',
    hint: 'Sweet. Until they catch you.',
    run(s, rng) {
      if (chance(rng, 0.3)) {
        apply(s, { energy: 16, cred: -14 });
        s.punished = true;
        return 'Soldier found you in mufti. Frog jump. Your name spoiled. -14 credibility.';
      }
      apply(s, { energy: 26, belle: -6, cred: -5 });
      return 'You slept through parade and nobody noticed. Sweet.';
    },
  },
};

/* Never let money go negative — a player seeing "₦-400" assumes the game
   is broken. Deduct only what they actually have. */
function spend(s, amount) {
  const paid = Math.min(amount, s.money);
  s.money -= paid;
  return paid;
}

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

/* ---------- postings ---------- */
const POSTINGS = {
  soft: ['Lagos — Victoria Island', 'Abuja — Central Area', 'Port Harcourt GRA', 'Ibadan — Bodija', 'Your own home state'],
  mid: ['Enugu', 'Kaduna town', 'Benin City', 'Abeokuta', 'Jos', 'Uyo'],
  hard: ['Zamfara', 'Yobe', 'Taraba — deep inside', 'Bayelsa riverine', 'A village with no network', 'Borno'],
};

export function computePosting(s, rng) {
  const roll = rng() * 100 + s.cred * 0.35;
  if (roll > 95) return { tier: 'soft', place: pick(rng, POSTINGS.soft), emoji: '🎉' };
  if (roll > 55) return { tier: 'mid', place: pick(rng, POSTINGS.mid), emoji: '🙂' };
  return { tier: 'hard', place: pick(rng, POSTINGS.hard), emoji: '😭' };
}

/* ---------- lifecycle ---------- */
export function newGame(name, rng = Math.random) {
  return {
    name: (name || 'Otondo').slice(0, 16),
    platoon: 1 + Math.floor(rng() * 10),
    day: 1,
    actionsLeft: ACTIONS_PER_DAY,
    energy: 80, belle: 70, money: 20000, cred: 0,
    friends: 0, drills: 0, injured: false, punished: false,
    phase: 'day',
    log: [],
    posting: null,
  };
}

export function canDo(s, key) {
  const a = ACTIONS[key];
  if (!a) return false;
  if (s.phase !== 'day' || s.actionsLeft <= 0) return false;
  if (a.cost && s.money < a.cost) return false;
  if (key === 'manowar' && s.injured) return false;
  return true;
}

export function doAction(s, key, rng = Math.random) {
  if (!canDo(s, key)) return s;
  const msg = ACTIONS[key].run(s, rng);
  s.log.unshift({ day: s.day, text: msg });
  s.actionsLeft -= 1;
  if (s.actionsLeft <= 0) endDay(s, rng);
  return s;
}

function endDay(s, rng) {
  const ev = pick(rng, EVENTS);
  const line = typeof ev.text === 'function' ? ev.text(s, rng) : ev.text;
  ev.fx(s, rng);
  s.log.unshift({ day: s.day, text: line, event: true });

  /* No allawee inside camp. The ₦77,000 is paid 25th-30th into an account you
     only register once you get here — so it lands AFTER you pass out. You spend
     all 21 days on the money you brought. */

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

export function shareText(s) {
  if (!s.posting) return '';
  return `I survived camp as a Platoon ${s.platoon} otondo.\nCredibility ${s.cred} · ₦${s.money.toLocaleString()} · ${s.friends} friends\nPosted to: ${s.posting.place.toUpperCase()} ${s.posting.emoji}\n\nPlay Otondo:`;
}
