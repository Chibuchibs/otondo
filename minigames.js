/* Otondo — the playable bits.
   Two mini-games that decide the reward for an action instead of a dice roll,
   so skill matters. Both are phone-first: one thumb, no instructions needed.
   Each resolves to { score: 0..1, detail: 'one line for the camp log' }. */

/* ---------------------------------------------------------------- hoop ---- */
export function playHoop(host) {
  return new Promise(resolve => {
    const W = 320, H = 240, SHOTS = 5;
    host.innerHTML = `
      <div class="mg">
        <p class="mg-top"><b>Camp court</b><span id="mgInfo">Shot 1 of ${SHOTS}</span></p>
        <canvas id="mgCanvas" width="${W}" height="${H}"></canvas>
        <p class="mg-hint">Hold to aim your power. Let go to shoot.</p>
      </div>`;
    const cv = host.querySelector('#mgCanvas'), x = cv.getContext('2d');
    const info = host.querySelector('#mgInfo');

    let shot = 0, made = 0, made0 = 0, charging = false, chargeFrom = 0;
    let ball = null, hoopX = 0, done = false;
    /* Same fix as the parade: the meter used to fill per frame, so it charged
       at double speed on a 120Hz screen. */
    const CHARGE = 1100;                 // ms for a full up-and-down sweep
    const powerNow = () => {
      if (!charging) return 0;
      const u = ((performance.now() - chargeFrom) % CHARGE) / CHARGE;
      return u < 0.5 ? u * 2 : 2 - u * 2;
    };

    const newShot = () => {
      hoopX = 190 + Math.random() * 90;      // the distance changes every time
      charging = false; ball = null;
      info.textContent = `Shot ${Math.min(shot + 1, SHOTS)} of ${SHOTS} · ${made} in`;
    };
    newShot();

    function draw() {
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#f2e4c6'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#cdc0a0'; x.fillRect(0, H - 40, W, 40);       // ground
      x.fillStyle = '#b8aa88'; x.fillRect(0, H - 40, W, 3);

      // post and backboard
      x.fillStyle = '#8c7f5e'; x.fillRect(hoopX + 26, 74, 5, H - 114);
      x.fillStyle = '#fbf9f2'; x.fillRect(hoopX + 14, 52, 18, 28);
      // the ring, drawn as an ellipse so it reads as a hoop seen side-on
      x.strokeStyle = '#e0762a'; x.lineWidth = 4;
      x.beginPath(); x.ellipse(hoopX, 86, 20, 5, 0, 0, Math.PI * 2); x.stroke();
      // net
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        x.beginPath(); x.moveTo(hoopX + i * 6, 88); x.lineTo(hoopX + i * 3, 108); x.stroke();
      }

      // the shooter, in the same sports kit
      x.fillStyle = '#fbf9f2'; x.fillRect(37, H - 96, 18, 17);     // white shorts
      x.fillStyle = '#0a7a43'; x.fillRect(37, H - 96, 18, 2.4);    // waistband
      x.fillStyle = '#8d5524'; x.fillRect(39, H - 79, 7, 7);       // bare thigh
      x.fillRect(48, H - 79, 7, 7);
      x.fillStyle = '#fbf9f2'; x.fillRect(39, H - 72, 7, 7);       // white socks
      x.fillRect(48, H - 72, 7, 7);
      x.fillStyle = '#f2efe4'; x.fillRect(37, H - 66, 10, 5);      // trainers
      x.fillRect(47, H - 66, 10, 5);
      x.fillStyle = '#5a5a5a'; x.fillRect(37, H - 62, 10, 2);      // soles
      x.fillRect(47, H - 62, 10, 2);
      x.fillStyle = '#fbf9f2'; x.fillRect(36, H - 126, 20, 32);    // vest
      x.fillStyle = '#0a7a43'; x.fillRect(36, H - 126, 20, 2.6);   // collar
      x.beginPath(); x.arc(46, H - 114, 3.4, 0, 7); x.fill();      // crest
      x.fillStyle = '#8d5524'; x.beginPath(); x.arc(46, H - 136, 11, 0, 7); x.fill();
      x.fillStyle = '#fbf9f2'; x.beginPath();                      // white cap
      x.ellipse(46, H - 140, 12, 8, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#0a7a43'; x.fillRect(33, H - 143, 26, 4);

      if (ball) { x.fillStyle = '#e0762a'; x.beginPath(); x.arc(ball.x, ball.y, 8, 0, 7); x.fill();
                  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.2; x.stroke(); }
      else      { x.fillStyle = '#e0762a'; x.beginPath(); x.arc(62, H - 112, 8, 0, 7); x.fill(); }

      // power meter
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(16, 18, 120, 12);
      const p = powerNow();
      x.fillStyle = p > .82 ? '#c0392b' : '#0a7a43';
      x.fillRect(16, 18, 120 * p, 12);
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; x.strokeRect(16, 18, 120, 12);
    }

    function tick() {
      /* Bail if the canvas has been removed — switching to the other game
         detaches it, and without this the old loop runs forever. */
      if (done || !cv.isConnected) return;
      if (ball) {
        ball.x += ball.vx; ball.y += ball.vy; ball.vy += 0.42;
        /* Counted on the way DOWN only, so a flat drive through the ring does
           not score — the arc is the skill. */
        if (ball.vy > 0 && !ball.scored &&
            Math.abs(ball.x - hoopX) < 17 && ball.y > 80 && ball.y < 94) {
          ball.scored = true; made++;
        }
        if (ball.y > H - 28 || ball.x > W + 20) {
          shot++;
          if (shot >= SHOTS) return finish();
          newShot();
        }
      }
      draw();
      requestAnimationFrame(tick);
    }

    function shoot() {
      if (ball) return;
      /* Calibrated by sweeping every power value against the whole hoop-distance
         range. The first attempt (7 + power*9) put EVERY winning shot in the
         bottom quarter of the meter — charge to mid-power, as anyone naturally
         would, and the ball always sailed over. This puts the sweet spot at
         0.44-0.72, mid-bar, with ~17% of the meter scoring. */
      const v = 5 + lastPower * 5.5;
      ball = { x: 62, y: H - 112, vx: v * 0.76, vy: -v * 0.86, scored: false };
    }

    let lastPower = 0;
    const down = e => { e.preventDefault();
      if (!ball) { charging = true; chargeFrom = performance.now(); } };
    const up   = e => { e.preventDefault();
      if (charging) { lastPower = powerNow(); charging = false; shoot(); } };
    cv.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    const key = e => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      e.preventDefault();
      if (e.type === 'keydown' && !ball && !charging) { charging = true; chargeFrom = performance.now(); }
      if (e.type === 'keyup'   && charging) { lastPower = powerNow(); charging = false; shoot(); }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);

    function finish() {
      done = true;
      cv.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
      const line = made === SHOTS ? 'You no miss at all. Camp dey hail you.'
                 : made >= 3     ? 'Sharp shooter.'
                 : made >= 1     ? 'You try small.'
                 :                 'You miss everything. Na so e dey start.';
      resolve({ score: made / SHOTS, detail: `${made}/${SHOTS} baskets. ${line}` });
    }

    tick();
  });
}

/* -------------------------------------------------------- registration ---- */
/* Collect your kit off the counter before the queue moves on. The items shuffle
   every round, so it is attention rather than muscle memory. */
const KIT = [
  { id:'bag',   name:'kit bag',
    svg:`<rect x="7" y="16" width="26" height="20" rx="3" fill="#4a6fa5"/>
         <rect x="7" y="21" width="26" height="4" fill="#3b5a86"/>
         <path d="M15 16v-3a5 5 0 0 1 10 0v3" stroke="#3b5a86" stroke-width="2.5" fill="none"/>` },
  { id:'khaki', name:'khaki uniform',
    svg:`<rect x="10" y="12" width="20" height="26" rx="3" fill="#93b06d"/>
         <path d="M16 12h8l-4 7z" fill="#fbf9f2"/>
         <rect x="9" y="14" width="5" height="3" rx="1.5" fill="#5f7a42"/>
         <rect x="26" y="14" width="5" height="3" rx="1.5" fill="#5f7a42"/>` },
  { id:'boots', name:'jungle boots',
    svg:`<rect x="6" y="22" width="13" height="9" rx="2" fill="#e0762a"/>
         <rect x="6" y="29" width="13" height="3" rx="1.5" fill="#2a2520"/>
         <rect x="21" y="22" width="13" height="9" rx="2" fill="#c96620"/>
         <rect x="21" y="29" width="13" height="3" rx="1.5" fill="#1f1b17"/>` },
  { id:'card',  name:'camp ID card',
    svg:`<rect x="8" y="14" width="24" height="18" rx="2.5" fill="#fbf9f2" stroke="#ddd3b8" stroke-width="1.5"/>
         <circle cx="15" cy="21" r="3.5" fill="#8d5524"/>
         <rect x="21" y="19" width="8" height="2" fill="#b9ae7c"/>
         <rect x="21" y="23" width="8" height="2" fill="#b9ae7c"/>` },
  { id:'sheet', name:'camp itinerary',
    svg:`<rect x="10" y="11" width="20" height="26" rx="2" fill="#fbf9f2" stroke="#ddd3b8" stroke-width="1.5"/>
         <rect x="13" y="16" width="14" height="2" fill="#0a7a43"/>
         <rect x="13" y="21" width="14" height="2" fill="#b9ae7c"/>
         <rect x="13" y="26" width="10" height="2" fill="#b9ae7c"/>` },
];

export function playRegister(host) {
  return new Promise(resolve => {
    const ROUNDS = 4, LIMIT = 3400;
    const order = [...KIT].sort(() => Math.random() - 0.5).slice(0, ROUNDS);
    let i = 0, got = 0, timer = null, deadline = 0, raf = 0;

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>Camp registration</b><span id="mgInfo"></span></p>
      <p class="reg-ask" id="regAsk"></p>
      <div class="reg-bar"><i id="regFill"></i></div>
      <div class="reg-grid" id="regGrid"></div>
      <p class="mg-hint" id="regFb">Three hours for queue. Grab the right thing.</p></div>`;
    const ask = host.querySelector('#regAsk'), grid = host.querySelector('#regGrid');
    const info = host.querySelector('#mgInfo'), fb = host.querySelector('#regFb');
    const fill = host.querySelector('#regFill');

    function round() {
      const want = order[i];
      const shown = [...KIT].sort(() => Math.random() - 0.5).slice(0, 4);
      if (!shown.find(k => k.id === want.id)) shown[0] = want;
      shown.sort(() => Math.random() - 0.5);
      info.textContent = `${i + 1} of ${ROUNDS} · ${got} collected`;
      ask.textContent = `Collect your ${want.name}`;
      grid.innerHTML = shown.map(k =>
        `<button class="reg-item" data-id="${k.id}">
           <svg viewBox="0 0 40 48" aria-hidden="true">${k.svg}</svg>
           <span>${k.name}</span></button>`).join('');
      deadline = performance.now() + LIMIT;
      cancelAnimationFrame(raf);
      const sweep = () => {
        const left = Math.max(0, deadline - performance.now());
        fill.style.width = (100 * left / LIMIT) + '%';
        if (left <= 0) { pick(null); return; }
        raf = requestAnimationFrame(sweep);
      };
      sweep();
    }

    function pick(id) {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      const want = order[i];
      const right = id === want.id;
      if (right) got++;
      grid.querySelectorAll('.reg-item').forEach(b => {
        b.disabled = true;
        if (b.dataset.id === want.id) b.classList.add('right');
        else if (b.dataset.id === id) b.classList.add('wrong');
      });
      fb.textContent = right ? 'Got it.' : id ? `That is not it.` : 'Queue moved on. Gone.';
      timer = setTimeout(() => {
        i++;
        if (i >= ROUNDS) {
          const line = got === ROUNDS ? 'Full kit collected. You don enter camp proper.'
                     : got >= 2       ? `You collected ${got} of ${ROUNDS}. Manage like that.`
                     :                  'You barely collected anything. Queue win you.';
          resolve({ score: got / ROUNDS, detail: line });
          return;
        }
        fb.textContent = '\u00a0';
        round();
      }, 800);
    }

    grid.addEventListener('click', e => {
      const b = e.target.closest('.reg-item');
      if (b && !b.disabled) pick(b.dataset.id);
    });
    round();
  });
}

/* ------------------------------------------------------------- parade ----- */
/* Marching is a rhythm problem. Tap as the marker crosses the green band to
   take a step in time; mistime it and you break step and lose ground. */
export function playParade(host) {
  return new Promise(resolve => {
    const W = 320, H = 240, STEPS = 12;
    host.innerHTML = `
      <div class="mg">
        <p class="mg-top"><b>Morning parade</b><span id="mgInfo">0 of ${STEPS} steps</span></p>
        <canvas id="mgCanvas" width="${W}" height="${H}"></canvas>
        <p class="mg-hint">Tap in step as the marker hits the green.</p>
      </div>`;
    const cv = host.querySelector('#mgCanvas'), x = cv.getContext('2d');
    const info = host.querySelector('#mgInfo');

    let steps = 0, missed = 0, done = false, flash = 0, flashGood = false;
    const BAND = 0.16;                   // half-width of the in-step window
    /* Driven by the CLOCK, not the frame count. Per-frame movement ran twice as
       fast on a 120Hz phone as on a 60Hz one, and froze entirely whenever the
       browser throttled frames — which made the parade unwinnable. */
    const SWEEP = 1500;                  // ms for one there-and-back
    const t0 = performance.now();
    const marker = () => {
      const u = ((performance.now() - t0) % SWEEP) / SWEEP;
      return u < 0.5 ? u * 2 : 2 - u * 2;
    };

    function draw() {
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#e8f0f6'; x.fillRect(0, 0, W, H);
      // the sun, because the sun is the point
      x.fillStyle = '#f3c969'; x.beginPath(); x.arc(286, 30, 20, 0, 7); x.fill();
      x.strokeStyle = 'rgba(243,201,105,.55)'; x.lineWidth = 3;
      for (let a = 0; a < 8; a++){ const r = a * Math.PI / 4;
        x.beginPath(); x.moveTo(286 + Math.cos(r) * 25, 30 + Math.sin(r) * 25);
        x.lineTo(286 + Math.cos(r) * 32, 30 + Math.sin(r) * 32); x.stroke(); }
      x.fillStyle = '#c9b88e'; x.fillRect(0, 152, W, H - 152);     // parade ground

      /* Marking time on the spot, in formation — which is what drill actually
         is, and holding still means they can be drawn big enough to see the
         kit. Progress shows on the bar, not by walking off-screen. */
      for (let n = 0; n < 3; n++){
        const bx = 80 + n * 80;
        const up = (steps + n) % 2 === 0;          // legs alternate on each step
        const lift = flash > 14 && flashGood ? 3 : 0;
        // legs: one knee raised
        x.fillStyle = '#7b9856';
        x.fillRect(bx - 9, 126, 8, up ? 22 - lift : 22);
        x.fillStyle = '#8aa863';
        x.fillRect(bx + 1, 126, 8, up ? 22 : 22 - lift);
        x.fillStyle = '#e0762a';                    // boots
        x.fillRect(bx - 10, up ? 148 - lift : 148, 10, 5);
        x.fillRect(bx,      up ? 148 : 148 - lift, 10, 5);
        x.fillStyle = '#2a2520';
        x.fillRect(bx - 10, up ? 151 - lift : 151, 10, 2);
        x.fillRect(bx,      up ? 151 : 151 - lift, 10, 2);
        // torso and arms
        x.fillStyle = '#fbf9f2'; x.fillRect(bx - 11, 100, 22, 28);
        x.fillStyle = '#0a7a43'; x.fillRect(bx - 11, 100, 22, 3);
        x.beginPath(); x.arc(bx, 112, 3.4, 0, 7); x.fill();
        x.fillStyle = '#5f7a42'; x.fillRect(bx - 11, 122, 22, 4);   // belt
        x.fillStyle = '#fbf9f2';
        x.fillRect(bx - 16, 102, 5, up ? 16 : 20);
        x.fillRect(bx + 11, 102, 5, up ? 20 : 16);
        // head and cap
        x.fillStyle = '#8d5524'; x.beginPath(); x.arc(bx, 92, 9, 0, 7); x.fill();
        x.fillStyle = '#fbf9f2'; x.beginPath();
        x.ellipse(bx, 89, 10, 7, 0, Math.PI, 0); x.fill();
        x.fillStyle = '#0a7a43'; x.fillRect(bx - 11, 87, 22, 3);
      }

      // how far through the parade they are
      const pw = W - 48;
      x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(24, 166, pw, 8);
      x.fillStyle = '#0a7a43'; x.fillRect(24, 166, pw * (steps / STEPS), 8);
      x.fillStyle = '#7a7257'; x.font = '700 10px system-ui, sans-serif';
      x.fillText('A', 24, 163); x.fillText('B', W - 30, 163);

      // rhythm bar
      const by = 200, bw = W - 48;
      x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(24, by, bw, 16);
      x.fillStyle = '#d9ece1';
      x.fillRect(24 + bw * (0.5 - BAND), by, bw * BAND * 2, 16);
      x.fillStyle = '#0a7a43';
      x.fillRect(24 + bw * marker() - 2, by - 4, 4, 24);
      x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1; x.strokeRect(24, by, bw, 16);

      if (flash > 0) {
        x.fillStyle = flashGood ? '#0a7a43' : '#b0432f';
        x.font = '700 18px system-ui, sans-serif'; x.textAlign = 'center';
        x.fillText(flashGood ? 'IN STEP' : 'OUT OF STEP', W / 2, 190);
        x.textAlign = 'left';
        flash--;
      }
    }

    function tick() {
      if (done || !cv.isConnected) return;
      draw();
      requestAnimationFrame(tick);
    }

    function step() {
      if (done) return;
      const good = Math.abs(marker() - 0.5) <= BAND;
      flash = 26; flashGood = good;
      /* A miss costs you the step but never takes one back. Decrementing meant
         anyone tapping off the beat went backwards and could never reach B at
         all — the score already punishes sloppiness. */
      if (good) steps++; else missed++;
      info.textContent = `${steps} of ${STEPS} steps`;
      if (steps >= STEPS) finish();
    }

    const tap = e => { e.preventDefault(); step(); };
    cv.addEventListener('pointerdown', tap);
    const key = e => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); step(); } };
    window.addEventListener('keydown', key);

    /* A floor on the score: reaching B at all is worth something, and a parade
       you can fail outright would just be annoying. */
    function finish() {
      done = true;
      cv.removeEventListener('pointerdown', tap);
      window.removeEventListener('keydown', key);
      const sc = Math.max(0.25, 1 - missed / 14);
      const line = missed === 0 ? 'Perfect step from A to B. Soldier nod at you.'
                 : missed <= 3  ? 'You reached B, mostly in step.'
                 : missed <= 7  ? 'You wobbled but you got there.'
                 :                'Soldier shout your name twice. You still reach.';
      resolve({ score: sc, detail: `Parade: ${line}` });
    }

    tick();
  });
}

/* ------------------------------------------------------------- penalty ---- */
/* The skill is anticipation, not luck: the keeper never stops moving, and the
   ball takes long enough to arrive that you must shoot where he WILL be, not
   where he is. Three penalties, one tap each. */
export function playPenalty(host) {
  return new Promise(resolve => {
    const W = 320, H = 240, KICKS = 5;
    const GL = 54, GR = 266, GT = 46, GB = 132;      // goal mouth
    host.innerHTML = `
      <div class="mg">
        <p class="mg-top"><b>Penalty spot</b><span id="mgInfo">Kick 1 of ${KICKS}</span></p>
        <canvas id="mgCanvas" width="${W}" height="${H}"></canvas>
        <p class="mg-hint">Tap where you want it. The keeper no dey sleep.</p>
      </div>`;
    const cv = host.querySelector('#mgCanvas'), x = cv.getContext('2d');
    const info = host.querySelector('#mgInfo');

    let kick = 0, scored = 0, done = false, t = 0;
    let keeper = (GL + GR) / 2, dir = 1, speed = 2.3;
    let ball = null, msg = '', msgT = 0, lunge = 0, reach = 0;

    const newKick = () => {
      ball = null;
      speed = 2.1 + Math.random() * 1.4;             // a different keeper each time
      dir = Math.random() < 0.5 ? 1 : -1;
      /* How far he can throw himself, decided before the kick and unknown to
         you. Without a dive the corners were nearly free — 3/3 every time by
         just always aiming wide. */
      /* 15-40. The previous 30-80 was a genuine bug: save radius is reach+26,
         so a high roll gave him 106px either side against a 188px goal — near
         the middle he covered the WHOLE goal and no shot could score. At 15-40
         there is never an unwinnable kick, and shooting the corners scores
         about three times in four. */
      reach = 15 + Math.random() * 25;
      lunge = 0;
      info.textContent = `Kick ${Math.min(kick + 1, KICKS)} of ${KICKS} · ${scored} scored`;
    };
    newKick();

    function draw() {
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#cfe3f2'; x.fillRect(0, 0, W, H);            // sky
      x.fillStyle = '#7fa864'; x.fillRect(0, GB, W, H - GB);      // pitch
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, GB + 34); x.lineTo(W, GB + 34); x.stroke();

      // goal frame
      x.strokeStyle = '#fbf9f2'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(GL, GB); x.lineTo(GL, GT);
      x.lineTo(GR, GT); x.lineTo(GR, GB); x.stroke();
      // net
      x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1;
      for (let i = GL + 10; i < GR; i += 16) {
        x.beginPath(); x.moveTo(i, GT + 3); x.lineTo(i, GB - 2); x.stroke();
      }
      for (let j = GT + 12; j < GB; j += 14) {
        x.beginPath(); x.moveTo(GL + 3, j); x.lineTo(GR - 3, j); x.stroke();
      }

      // the keeper, in green
      const ky = GB - 40, kx = keeper + lunge;                    // lunge shows the save
      x.fillStyle = '#0a7a43';
      x.fillRect(kx - 13, ky, 26, 34);                            // body
      x.fillRect(kx - 26, ky + 4, 13, 7);                         // arms out
      x.fillRect(kx + 13, ky + 4, 13, 7);
      x.fillStyle = '#8d5524';
      x.beginPath(); x.arc(kx, ky - 9, 9, 0, 7); x.fill();        // head

      /* Sports kit, not the khaki: camp PT and matches are played in the white
         crested vest and white shorts, with canvas shoes. */
      x.fillStyle = '#fbf9f2'; x.fillRect(149, H - 46, 16, 15);     // white shorts
      x.fillStyle = '#0a7a43'; x.fillRect(149, H - 46, 16, 2);      // waistband
      x.fillStyle = '#8d5524'; x.fillRect(150, H - 31, 6, 5);       // bare thigh
      x.fillRect(158, H - 31, 6, 5);
      x.fillStyle = '#fbf9f2'; x.fillRect(150, H - 26, 6, 5);       // white socks
      x.fillRect(158, H - 26, 6, 5);
      x.fillStyle = '#f2efe4'; x.fillRect(148, H - 22, 9, 4);       // trainers
      x.fillRect(157, H - 22, 9, 4);
      x.fillStyle = '#5a5a5a'; x.fillRect(148, H - 19, 9, 1.6);     // soles
      x.fillRect(157, H - 19, 9, 1.6);
      x.fillStyle = '#fbf9f2'; x.fillRect(148, H - 66, 18, 22);     // vest
      x.fillStyle = '#0a7a43'; x.fillRect(148, H - 66, 18, 2.4);    // collar
      x.beginPath(); x.arc(157, H - 56, 3, 0, 7); x.fill();         // crest
      x.fillStyle = '#8d5524'; x.beginPath(); x.arc(157, H - 74, 9, 0, 7); x.fill();
      x.fillStyle = '#fbf9f2'; x.beginPath();                        // white cap
      x.ellipse(157, H - 78, 10, 7, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#0a7a43'; x.fillRect(146, H - 80, 22, 3);

      if (ball) {
        x.fillStyle = '#fbf9f2'; x.beginPath(); x.arc(ball.x, ball.y, 7, 0, 7); x.fill();
        x.strokeStyle = '#333'; x.lineWidth = 1.4; x.stroke();
      } else {
        x.fillStyle = '#fbf9f2'; x.beginPath(); x.arc(170, H - 24, 7, 0, 7); x.fill();
        x.strokeStyle = '#333'; x.lineWidth = 1.4; x.stroke();
      }

      if (msg && t < msgT + 55) {
        x.fillStyle = msg === 'GOAL!' ? '#0a7a43' : '#b0432f';
        x.font = '700 22px system-ui, sans-serif'; x.textAlign = 'center';
        x.fillText(msg, W / 2, 30);
        x.textAlign = 'left';
      }
    }

    function tick() {
      if (done || !cv.isConnected) return;
      t++;
      keeper += dir * speed;
      if (keeper < GL + 22) { keeper = GL + 22; dir = 1; }
      if (keeper > GR - 22) { keeper = GR - 22; dir = -1; }

      if (ball) {
        ball.p += 0.035;
        ball.x = ball.x0 + (ball.tx - ball.x0) * ball.p;
        ball.y = ball.y0 + (ball.ty - ball.y0) * ball.p;
        if (ball.p >= 1) {
          const gap = Math.abs(keeper - ball.tx);
          const saved = gap <= reach + 26;
          lunge = saved ? Math.sign(ball.tx - keeper) * Math.min(reach, gap) : 0;
          if (saved) { msg = 'SAVED'; }
          else { scored++; msg = 'GOAL!'; }
          msgT = t;
          ball = null;
          kick++;
          setTimeout(() => { lunge = 0; }, 700);
          if (kick >= KICKS) { setTimeout(finish, 900); done = false; }
          else setTimeout(newKick, 850);
        }
      }
      draw();
      requestAnimationFrame(tick);
    }

    function shoot(px, py) {
      if (ball || kick >= KICKS) return;
      const tx = Math.max(GL + 12, Math.min(GR - 12, px));
      const ty = Math.max(GT + 12, Math.min(GB - 8, py));
      ball = { x0: 170, y0: H - 24, x: 170, y: H - 24, tx, ty, p: 0 };
    }

    const tap = e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const cx = (e.clientX - r.left) * (W / r.width);
      const cy = (e.clientY - r.top)  * (H / r.height);
      shoot(cx, cy);
    };
    cv.addEventListener('pointerdown', tap);

    function finish() {
      done = true;
      cv.removeEventListener('pointerdown', tap);
      const line = scored === KICKS ? 'Perfect. Keeper no see am at all.'
                 : scored >= 3     ? 'Striker material.'
                 : scored >= 1     ? 'Manage am.'
                 :                   'Keeper save everything. Chai.';
      resolve({ score: scored / KICKS, detail: `${scored}/${KICKS} penalties. ${line}` });
    }

    tick();
  });
}

/* --------------------------------------------------------------- mami ---- */
/* Mami market: the stalls are open, your belle is empty and your money is
   finite. Every plate fills you and empties your pocket. Walk away when you
   have had enough — or keep eating and find out. */
const MAMI = [
  { n:'Indomie and egg',      p:1200, f:30, k:'indomie' },
  { n:'Boli and groundnut',   p:700,  f:20, k:'boli'    },
  { n:'Soaked garri + milk',  p:600,  f:22, k:'garri'   },
  { n:'Cold minerals',        p:400,  f:10, k:'mineral' },
  { n:'Suya, one stick',      p:900,  f:18, k:'suya'    },
  { n:'Amala and ewedu',      p:1300, f:32, k:'amala'   },
  { n:'Fried rice',           p:1500, f:34, k:'rice'    },
  { n:'Puff puff, four',      p:500,  f:14, k:'puff'    },
];

/* Each dish drawn rather than shown as a coloured disc, in the same flat style
   as JOB_ART. Worth the lines: the menu is the only place the player chooses
   with their own money, and "Amala and ewedu" has to be recognisable at 34px
   to anyone who has eaten it. Shared bowl and plate parts are composed in so
   the dishes sit on the same crockery. */
const BOWL = `<path d="M7 21c0 6.8 5.8 12 13 12s13-5.2 13-12z" fill="#e4dcc8"/>`;
const RIM  = `<rect x="5" y="18.6" width="30" height="3.6" rx="1.8" fill="#cfc4aa"/>`;
const PLATE = `<ellipse cx="20" cy="26.5" rx="14" ry="6.3" fill="#eae3d1"/>
               <ellipse cx="20" cy="25.4" rx="11.4" ry="4.8" fill="#dcd3ba"/>`;

const MAMI_ART = {
  /* Noodle mound heaped above the rim, egg sitting on top of it. */
  indomie: `<path d="M9 19.2c1.4-5.1 5.7-7.8 11-7.8s9.6 2.7 11 7.8z" fill="#e8b14e"/>
    <path d="M12.2 18.2c1.1-2.7 3-4.2 5.5-4.7M20.4 13.3c2.6.3 4.5 1.8 5.8 4.4"
      stroke="#c8882c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <ellipse cx="23.6" cy="14.6" rx="6" ry="4.2" fill="#fbf7ec"/>
    <circle cx="23.6" cy="14.6" r="2.4" fill="#f0b429"/>${BOWL}${RIM}`,

  /* Roasted plantain with the char lines from the grill, groundnuts beside. */
  boli: `<rect x="7.5" y="18.6" width="19.5" height="10" rx="5" fill="#d2963c"/>
    <path d="M12 19.4v8.4M17 19v9.2M22 19.4v8.4"
      stroke="#8a5a21" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="30.4" cy="24.4" rx="2.5" ry="3.3" fill="#c9a06a"/>
    <ellipse cx="29.6" cy="29.4" rx="2.5" ry="3.3" fill="#b98f59"/>`,

  /* Granules showing through, milk pooled on one side. */
  garri: `<ellipse cx="20" cy="19.8" rx="13" ry="4.6" fill="#f1e8d1"/>
    <ellipse cx="16.6" cy="19.4" rx="5.2" ry="2.5" fill="#fdfcf8"/>
    <circle cx="25" cy="18.6" r=".9" fill="#d9ca9f"/><circle cx="27.4" cy="20.6" r=".8" fill="#d9ca9f"/>
    <circle cx="22.6" cy="21.4" r=".8" fill="#d9ca9f"/><circle cx="12.4" cy="21.2" r=".8" fill="#d9ca9f"/>
    ${BOWL}${RIM}`,

  /* A capped bottle, sweating. */
  mineral: `<rect x="16.8" y="6.4" width="6.4" height="3.2" rx="1" fill="#9aa3ad"/>
    <path d="M15.2 15.6c0-1.4 1.2-1.8 1.2-2.6v-3.4h7.2v3.4c0 .8 1.2 1.2 1.2 2.6V31a2.2 2.2 0 0 1-2.2 2.2h-5.2A2.2 2.2 0 0 1 15.2 31z" fill="#c94f4f"/>
    <rect x="15.2" y="20.4" width="9.6" height="5.6" fill="#fbf7ec"/>
    <rect x="15.2" y="22.6" width="9.6" height="1.4" fill="#c94f4f"/>`,

  /* One stick, three pieces, pepper on the outside. */
  suya: `<rect x="19" y="5.6" width="2" height="29" rx="1" fill="#b08a56"/>
    <rect x="11" y="9.6" width="18" height="6.4" rx="2.6" fill="#8c4a2f"/>
    <rect x="11" y="17.4" width="18" height="6.4" rx="2.6" fill="#9b5433"/>
    <rect x="11" y="25.2" width="18" height="6.4" rx="2.6" fill="#8c4a2f"/>
    <circle cx="15" cy="12.4" r=".9" fill="#cf5a2c"/><circle cx="24.6" cy="13.6" r=".9" fill="#cf5a2c"/>
    <circle cx="16.4" cy="20.6" r=".9" fill="#cf5a2c"/><circle cx="25" cy="28.4" r=".9" fill="#cf5a2c"/>
    <circle cx="14.6" cy="28.8" r=".9" fill="#cf5a2c"/>`,

  /* The mound and the soup beside it, which is how it arrives. */
  amala: `${PLATE}<path d="M9.6 25.2c0-4.3 3-7.4 6.8-7.4s6.8 3.1 6.8 7.4z" fill="#584431"/>
    <ellipse cx="27" cy="24.2" rx="5.4" ry="3.1" fill="#4e7a35"/>
    <ellipse cx="26.2" cy="23.4" rx="2.4" ry="1.3" fill="#5f9142"/>`,

  /* Pale grains with the vegetables showing. */
  rice: `${PLATE}<path d="M8.8 25c0-4.9 5-8.8 11.2-8.8S31.2 20.1 31.2 25z" fill="#e3d49a"/>
    <circle cx="15" cy="21.4" r="1.3" fill="#5d8a3a"/><circle cx="24.6" cy="20.6" r="1.3" fill="#5d8a3a"/>
    <circle cx="19.6" cy="18.6" r="1.2" fill="#d2823c"/><circle cx="27" cy="23.4" r="1.2" fill="#d2823c"/>
    <circle cx="12.6" cy="23.6" r="1.2" fill="#5d8a3a"/>`,

  /* Four, because that is what the label says. */
  puff: `<circle cx="14" cy="15.6" r="6.3" fill="#d79a4e"/>
    <circle cx="26" cy="15.6" r="6.3" fill="#c98f43"/>
    <circle cx="14" cy="26.4" r="6.3" fill="#c98f43"/>
    <circle cx="26" cy="26.4" r="6.3" fill="#d79a4e"/>
    <path d="M11.4 13c.9-1.1 2-1.7 3.2-1.8M23.4 23.8c.9-1.1 2-1.7 3.2-1.8"
      stroke="#e8b878" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
};

/* Takes the live game state so the stalls price against money you actually
   have, and so the action can deduct exactly what was spent. */
export function playMami(host, st) {
  const money = st && typeof st.money === 'number' ? st.money : 20000;
  return new Promise(resolve => {
    const stalls = [...MAMI].sort(() => Math.random() - 0.5).slice(0, 4);
    let belle = 0, spent = 0, bought = [];

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>Mami market</b><span id="mgInfo"></span></p>
      <div class="mami-grid" id="mamiGrid"></div>
      <p class="mg-hint" id="mamiFb">Eat till your belle settle. Your money dey finish.</p>
      <button class="mami-done" id="mamiDone">I don finish</button></div>`;
    const grid = host.querySelector('#mamiGrid'), info = host.querySelector('#mgInfo');
    const fb = host.querySelector('#mamiFb');

    const money_ = () => money - spent;
    function render() {
      info.textContent = `Belle ${belle} · \u20a6${money_().toLocaleString()} left`;
      grid.innerHTML = stalls.map((it, i) => {
        const tooDear = it.p > money_();
        return `<button class="mami-item" data-i="${i}" ${tooDear ? 'disabled' : ''}>
          <svg class="plate" viewBox="0 0 40 40" aria-hidden="true">${MAMI_ART[it.k]}</svg>
          <b>${it.n}</b>
          <em>\u20a6${it.p.toLocaleString()} · belle +${it.f}</em></button>`;
      }).join('');
    }

    grid.addEventListener('click', e => {
      const b = e.target.closest('.mami-item');
      if (!b || b.disabled) return;
      const it = stalls[+b.dataset.i];
      spent += it.p; belle = Math.min(100, belle + it.f);
      bought.push(it.n);
      fb.textContent = belle >= 100 ? 'Your belle don full. Stop now.'
                     : `${it.n} enter. Belle dey settle.`;
      render();
      if (belle >= 100 || money_() < 400) finish();
    });

    host.querySelector('#mamiDone').onclick = () => finish();

    function finish() {
      /* Scored on belle filled per naira — overeating is not skill, and neither
         is leaving hungry with a full pocket. */
      const value = spent > 0 ? belle / (spent / 1000) : 0;
      const score = Math.max(0, Math.min(1, value / 22));
      const line = !bought.length ? 'You looked, you bought nothing, you waka.'
        : belle >= 100 ? `You chopped ${bought.length} plates. Belle full, pocket light.`
        : `You faced ${bought[0].toLowerCase()}${bought.length > 1 ? ' and more' : ''}. Belle dey settle.`;
      resolve({ score, detail: line, spent, belle });
    }

    render();
  });
}

/* ------------------------------------------------------------- hustle ---- */
/* Camp hustle. Each job pays differently and costs different energy, and the
   good ones need a skill you may not have yet. Pick three. */
const JOBS = [
  { n:'Wash khaki for three people', pay:[400,700],   e:14, icon:'bucket' },
  { n:'Charge phones at the gen',    pay:[600,1000],  e:8,  icon:'phone'  },
  { n:'Sell recharge cards',         pay:[500,900],   e:6,  icon:'card'   },
  { n:'Plait hair for the hostel',   pay:[800,1400],  e:16, icon:'comb'   },
  { n:'Snap photos for camp IDs',    pay:[900,1600],  e:10, icon:'camera' },
  { n:'Run errands to Mami',         pay:[300,600],   e:12, icon:'bag'    },
  { n:'Help with SAED content',      pay:[1000,1800], e:9,  icon:'laptop' },
  { n:'Iron uniforms before parade', pay:[500,950],   e:13, icon:'iron'   },
];
const JOB_ART = {
  bucket:`<rect x="11" y="17" width="18" height="16" rx="2" fill="#4a6fa5"/><rect x="10" y="15" width="20" height="3" rx="1.5" fill="#3b5a86"/>`,
  phone: `<rect x="14" y="12" width="12" height="22" rx="3" fill="#2f3b47"/><rect x="16" y="15" width="8" height="14" fill="#8fd4c0"/>`,
  card:  `<rect x="9" y="16" width="22" height="14" rx="2" fill="#0a7a43"/><rect x="12" y="24" width="16" height="2" fill="#fbf9f2"/>`,
  comb:  `<rect x="11" y="14" width="18" height="6" rx="2" fill="#8d5524"/><rect x="13" y="20" width="2" height="9" fill="#8d5524"/><rect x="19" y="20" width="2" height="9" fill="#8d5524"/><rect x="25" y="20" width="2" height="9" fill="#8d5524"/>`,
  camera:`<rect x="8" y="16" width="24" height="15" rx="3" fill="#2f3b47"/><circle cx="20" cy="23" r="5" fill="#8fd4c0"/><rect x="15" y="12" width="8" height="4" rx="1" fill="#2f3b47"/>`,
  bag:   `<rect x="11" y="17" width="18" height="16" rx="2" fill="#b9683f"/><path d="M15 17v-3a5 5 0 0 1 10 0v3" stroke="#8c4a2f" stroke-width="2" fill="none"/>`,
  laptop:`<rect x="9" y="13" width="22" height="14" rx="1.5" fill="#2f3b47"/><rect x="11" y="15" width="18" height="10" fill="#8fd4c0"/><rect x="6" y="27" width="28" height="3" rx="1.5" fill="#55606c"/>`,
  iron:  `<path d="M9 26h22l-3-9H13z" fill="#9aa3ad"/><rect x="9" y="26" width="22" height="3" rx="1.5" fill="#6f7882"/><rect x="17" y="12" width="6" height="5" rx="2" fill="#6f7882"/>`,
};

export function playHustle(host) {
  return new Promise(resolve => {
    const PICKS = 3;
    const offered = [...JOBS].sort(() => Math.random() - 0.5).slice(0, 5);
    let picks = 0, earned = 0, tired = 0, taken = [];

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>Camp hustle</b><span id="mgInfo"></span></p>
      <p class="mg-hint" style="margin:0 2px 9px">Pick ${PICKS} jobs. Big pay costs you energy.</p>
      <div class="hus-grid" id="husGrid"></div>
      <p class="mg-hint" id="husFb">\u00a0</p></div>`;
    const grid = host.querySelector('#husGrid'), info = host.querySelector('#mgInfo');
    const fb = host.querySelector('#husFb');

    function render() {
      info.textContent = `${picks} of ${PICKS} · \u20a6${earned.toLocaleString()}`;
      grid.innerHTML = offered.map((j, i) =>
        `<button class="hus-item" data-i="${i}" ${taken.includes(i) ? 'disabled' : ''}>
           <svg viewBox="0 0 40 40" aria-hidden="true">${JOB_ART[j.icon]}</svg>
           <span><b>${j.n}</b><em>\u20a6${j.pay[0]}\u2013${j.pay[1]} · energy \u2212${j.e}</em></span>
         </button>`).join('');
    }

    grid.addEventListener('click', e => {
      const b = e.target.closest('.hus-item');
      if (!b || b.disabled) return;
      const i = +b.dataset.i, j = offered[i];
      const pay = j.pay[0] + Math.floor(Math.random() * (j.pay[1] - j.pay[0]));
      earned += pay; tired += j.e; taken.push(i); picks++;
      fb.textContent = `${j.n} \u2014 \u20a6${pay.toLocaleString()} entered.`;
      render();
      if (picks >= PICKS) setTimeout(finish, 750);
    });

    function finish() {
      const best = offered.map(j => j.pay[1]).sort((a,b) => b-a).slice(0, PICKS)
        .reduce((a,b) => a+b, 0);
      resolve({
        score: Math.max(0, Math.min(1, earned / best)),
        detail: `You hustled \u20a6${earned.toLocaleString()} off ${PICKS} jobs.`,
        earned, tired,
      });
    }
    render();
  });
}

/* ----------------------------------------------------------- man o war ---- */
/* The rope bridge. You advance automatically; the bridge swings under you and
   you tap the low side to counter. Lean too far and you are in the net. */
export function playManOWar(host) {
  return new Promise(resolve => {
    const W = 320, H = 240, LEN = 100;
    host.innerHTML = `
      <div class="mg">
        <p class="mg-top"><b>Man O War</b><span id="mgInfo">0%</span></p>
        <canvas id="mgCanvas" width="${W}" height="${H}"></canvas>
        <p class="mg-hint">Tap the side you are falling towards.</p>
      </div>`;
    const cv = host.querySelector('#mgCanvas'), x = cv.getContext('2d');
    const info = host.querySelector('#mgInfo');

    let pos = 0, tilt = 0, vel = 0, done = false, wobbles = 0, fell = 0;
    let push = 0, t0 = performance.now();

    function draw() {
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#cfe3f2'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#7fa864'; x.fillRect(0, 186, W, H - 186);

      // towers and ropes
      x.strokeStyle = '#8c7f5e'; x.lineWidth = 7;
      x.beginPath(); x.moveTo(22, 186); x.lineTo(22, 66); x.stroke();
      x.beginPath(); x.moveTo(W - 22, 186); x.lineTo(W - 22, 66); x.stroke();
      const sag = (p) => 112 + Math.sin(p * Math.PI) * 26 + tilt * 14;
      x.strokeStyle = '#c9b183'; x.lineWidth = 4;
      for (const off of [0, 44]) {
        x.beginPath();
        for (let i = 0; i <= 20; i++){ const p = i / 20;
          const yy = sag(p) - off; i ? x.lineTo(22 + p * (W - 44), yy) : x.moveTo(22, yy); }
        x.stroke();
      }
      x.lineWidth = 2;
      for (let i = 1; i < 10; i++){ const p = i / 10;
        x.beginPath(); x.moveTo(22 + p*(W-44), sag(p)); x.lineTo(22 + p*(W-44), sag(p)-44); x.stroke(); }

      // the climber, leaning with the bridge
      const px = 22 + (pos / LEN) * (W - 44), py = sag(pos / LEN);
      x.save(); x.translate(px, py); x.rotate(tilt * 0.5);
      x.fillStyle = '#8aa863'; x.fillRect(-6, -18, 12, 18);
      x.fillStyle = '#93b06d'; x.fillRect(-8, -36, 16, 20);
      x.fillStyle = '#5f7a42'; x.fillRect(-8, -36, 16, 2.4);
      x.fillStyle = '#8d5524'; x.beginPath(); x.arc(0, -43, 7, 0, 7); x.fill();
      x.fillStyle = '#93b06d'; x.beginPath(); x.ellipse(0, -46, 8, 5.5, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#e0762a'; x.fillRect(-7, -3, 14, 4);
      x.restore();

      // balance meter
      x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(60, 206, W - 120, 12);
      x.fillStyle = '#d9ece1'; x.fillRect(W/2 - 22, 206, 44, 12);
      x.fillStyle = Math.abs(tilt) > 0.72 ? '#b0432f' : '#0a7a43';
      x.fillRect(W/2 + tilt * (W - 120) / 2 - 3, 202, 6, 20);
      x.fillStyle = '#7a7257'; x.font = '700 10px system-ui, sans-serif';
      x.fillText('LEFT', 24, 216); x.fillText('RIGHT', W - 52, 216);
    }

    function tick() {
      if (done || !cv.isConnected) return;
      const now = performance.now(), dt = Math.min(50, now - t0); t0 = now;
      const k = dt / 16.7;
      /* The bridge pushes you around on its own; your taps are the only thing
         resisting it. */
      vel += (Math.random() - 0.5) * 0.012 * k + push;
      push = 0;
      vel *= 0.97;
      tilt += vel * k;
      if (Math.abs(tilt) > 1) {
        tilt = Math.sign(tilt); vel = 0; fell++;
        pos = Math.max(0, pos - 8);         // slip back, do not end the run
        tilt *= 0.3;
      }
      if (Math.abs(tilt) > 0.72) wobbles++;
      pos += 0.22 * k;
      info.textContent = Math.min(100, Math.round(pos)) + '%';
      if (pos >= LEN) return finish();
      draw();
      requestAnimationFrame(tick);
    }

    const lean = dir => { push = dir * 0.055; };
    const tap = e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      lean(((e.clientX - r.left) / r.width) < 0.5 ? -1 : 1);
    };
    cv.addEventListener('pointerdown', tap);
    const key = e => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); lean(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); lean(1); }
    };
    window.addEventListener('keydown', key);

    function finish() {
      done = true;
      cv.removeEventListener('pointerdown', tap);
      window.removeEventListener('keydown', key);
      const sc = Math.max(0.15, 1 - fell * 0.18 - wobbles / 900);
      const line = fell === 0 ? 'Across without one slip. Instructor nod.'
                 : fell <= 2  ? 'You wobbled but you crossed.'
                 :              'You fell into the net more than once. You still finish.';
      resolve({ score: Math.min(1, sc), detail: `Rope bridge: ${line}`, fell });
    }
    tick();
  });
}

/* ---------------------------------------------------------------- saed ---- */
/* Pick a trade, then prove you were paying attention: the instructor shows a
   sequence and you repeat it. */
const TRADES = [
  { n:'Fashion & design',   tools:['Fabric','Scissors','Needle','Tape'] },
  { n:'Catering',           tools:['Flour','Whisk','Oven','Icing'] },
  { n:'ICT & digital',      tools:['Laptop','Router','Code','Data'] },
  { n:'Beauty & cosmetics', tools:['Brush','Palette','Mirror','Gele'] },
  { n:'Agribusiness',       tools:['Seed','Feed','Water','Harvest'] },
  { n:'Photography',        tools:['Camera','Lens','Light','Edit'] },
];

export function playSaed(host) {
  return new Promise(resolve => {
    const ROUNDS = 4;
    const trade = TRADES[Math.floor(Math.random() * TRADES.length)];
    let round = 0, right = 0, seq = [], input = [], showing = false;

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>SAED: ${trade.n}</b><span id="mgInfo"></span></p>
      <p class="mg-hint" id="saedFb" style="margin:0 2px 10px">Watch the order, then repeat it.</p>
      <div class="saed-grid" id="saedGrid"></div></div>`;
    const grid = host.querySelector('#saedGrid'), info = host.querySelector('#mgInfo');
    const fb = host.querySelector('#saedFb');

    const paint = () => {
      grid.innerHTML = trade.tools.map((t, i) =>
        `<button class="saed-step" data-i="${i}">${t}</button>`).join('');
    };

    async function show() {
      showing = true;
      info.textContent = `Step ${round + 1} of ${ROUNDS}`;
      fb.textContent = 'Watch…';
      seq = Array.from({ length: round + 2 },
        () => Math.floor(Math.random() * trade.tools.length));
      await new Promise(r => setTimeout(r, 500));
      for (const i of seq) {
        const b = grid.querySelector(`[data-i="${i}"]`);
        b.classList.add('lit');
        await new Promise(r => setTimeout(r, 460));
        b.classList.remove('lit');
        await new Promise(r => setTimeout(r, 190));
      }
      fb.textContent = 'Now you.';
      input = []; showing = false;
    }

    grid.addEventListener('click', e => {
      const b = e.target.closest('.saed-step');
      if (!b || showing) return;
      const i = +b.dataset.i;
      b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 170);
      input.push(i);
      const n = input.length - 1;
      if (input[n] !== seq[n]) { fb.textContent = 'Wrong order. Next one.'; return next(false); }
      if (input.length === seq.length) { right++; fb.textContent = 'Correct.'; return next(true); }
    });

    function next() {
      round++;
      setTimeout(() => {
        if (round >= ROUNDS) {
          const line = right === ROUNDS ? `You mastered ${trade.n.toLowerCase()}. Instructor impressed.`
                     : right >= 2       ? `You picked up some ${trade.n.toLowerCase()}.`
                     :                    `You slept through most of ${trade.n.toLowerCase()}.`;
          resolve({ score: right / ROUNDS, detail: `SAED: ${line}` });
          return;
        }
        show();
      }, 800);
    }

    paint(); show();
  });
}

/* -------------------------------------------------------- social night ---- */
/* The MC calls a move and you have to do it before the music moves on. Gets
   faster every round. */
const MOVES = ['Zanku', 'Shaku Shaku', 'Gwara Gwara', 'Legwork', 'Soapy', 'Shoki'];

export function playSocial(host) {
  return new Promise(resolve => {
    const ROUNDS = 8;
    let round = 0, hit = 0, want = '', deadline = 0, raf = 0, locked = false;

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>Social night</b><span id="mgInfo"></span></p>
      <p class="soc-call" id="socCall"></p>
      <div class="reg-bar"><i id="socFill"></i></div>
      <div class="soc-grid" id="socGrid"></div>
      <p class="mg-hint" id="socFb">MC go call the step. Do am sharp sharp.</p></div>`;
    const call = host.querySelector('#socCall'), grid = host.querySelector('#socGrid');
    const info = host.querySelector('#mgInfo'), fb = host.querySelector('#socFb');
    const fill = host.querySelector('#socFill');

    function go() {
      locked = false;
      const limit = Math.max(900, 2200 - round * 170);     // the music speeds up
      want = MOVES[Math.floor(Math.random() * MOVES.length)];
      info.textContent = `${round + 1} of ${ROUNDS} · ${hit} hit`;
      call.textContent = want + '!';
      const opts = [...MOVES].sort(() => Math.random() - 0.5).slice(0, 4);
      if (!opts.includes(want)) opts[0] = want;
      grid.innerHTML = opts.sort(() => Math.random() - 0.5)
        .map(m => `<button class="soc-move" data-m="${m}">${m}</button>`).join('');
      deadline = performance.now() + limit;
      cancelAnimationFrame(raf);
      const sweep = () => {
        const left = Math.max(0, deadline - performance.now());
        fill.style.width = (100 * left / limit) + '%';
        if (left <= 0) return answer(null);
        raf = requestAnimationFrame(sweep);
      };
      sweep();
    }

    function answer(m) {
      if (locked) return;
      locked = true;
      cancelAnimationFrame(raf);
      const good = m === want;
      if (good) hit++;
      fb.textContent = good ? 'Yes! Camp dey hail you.' : m ? 'Wrong step.' : 'Too slow.';
      grid.querySelectorAll('.soc-move').forEach(b => {
        b.disabled = true;
        if (b.dataset.m === want) b.classList.add('right');
        else if (b.dataset.m === m) b.classList.add('wrong');
      });
      setTimeout(() => {
        round++;
        if (round >= ROUNDS) {
          const line = hit >= 7 ? 'You carried the night. Everybody dey record you.'
                     : hit >= 4 ? 'You held your own on the floor.'
                     : hit >= 1 ? 'You tried, but the MC fast pass you.'
                     :            'You froze. Camp no forget.';
          resolve({ score: hit / ROUNDS, detail: `Social night: ${line}` });
          return;
        }
        fb.textContent = '\u00a0';
        go();
      }, 650);
    }

    grid.addEventListener('click', e => {
      const b = e.target.closest('.soc-move');
      if (b && !b.disabled) answer(b.dataset.m);
    });
    go();
  });
}

/* --------------------------------------------------------------- dodge ---- */
/* Press your luck. Every snooze buys sleep and raises the odds the soldier
   finds you in mufti. Five gets you the full dodge — if you last. */
export function playDodge(host) {
  return new Promise(resolve => {
    const TARGET = 5;
    let snoozes = 0, risk = 0, over = false;

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>4:30am bugle</b><span id="mgInfo"></span></p>
      <div class="dodge-clock" id="dodgeClock">04:30</div>
      <p class="mg-hint" id="dodgeFb" style="min-height:2.4em">Bugle don blow. Snooze am?</p>
      <div class="reg-bar"><i id="dodgeRisk" style="background:#b0432f;width:0%"></i></div>
      <button class="dodge-btn" id="dodgeSnooze">Hit snooze</button>
      <button class="mami-done" id="dodgeUp" style="background:var(--muted);margin-top:7px">Get up and go</button>
      </div>`;
    const info = host.querySelector('#mgInfo'), fb = host.querySelector('#dodgeFb');
    const clock = host.querySelector('#dodgeClock'), bar = host.querySelector('#dodgeRisk');

    const paint = () => {
      info.textContent = `${snoozes} of ${TARGET} snoozed`;
      clock.textContent = '04:' + String(30 + snoozes * 9).padStart(2, '0');
      bar.style.width = Math.round(risk * 100) + '%';
    };

    host.querySelector('#dodgeSnooze').onclick = () => {
      if (over) return;
      snoozes++;
      risk = Math.min(0.95, risk + 0.17 + Math.random() * 0.07);
      paint();
      if (Math.random() < risk) {
        over = true;
        fb.textContent = 'Soldier find you for mufti. Frog jump.';
        setTimeout(() => resolve({
          score: 0,
          detail: `You snoozed ${snoozes} times and got caught. Frog jump for everybody to see.`,
          caught: true,
        }), 900);
        return;
      }
      fb.textContent = snoozes >= TARGET
        ? 'Five times. You dodged the whole parade.'
        : 'Nobody notice. Sleep sweet.';
      if (snoozes >= TARGET) {
        over = true;
        setTimeout(() => resolve({
          score: 1, detail: 'You snoozed five times and dodged parade completely. Sweet.',
        }), 900);
      }
    };

    host.querySelector('#dodgeUp').onclick = () => {
      if (over) return;
      over = true;
      resolve({
        score: snoozes / TARGET,
        detail: snoozes === 0
          ? 'You got up at the first bugle like a good corper.'
          : `You snoozed ${snoozes} time${snoozes === 1 ? '' : 's'} then got up before they caught you.`,
      });
    };

    paint();
  });
}

/* ----------------------------------------------------------- socialise ---- */
/* Camp gist. Someone says something and you pick your reply. There is no
   factual answer here — it is about reading the room, which is why it is
   scored on friends made rather than on being right. */
const GIST = [
  { say: 'Platoon mate: "Abeg, borrow me 2k. I go pay you after allawee."',
    opts: [
      ['"My brother, I don tell you — allawee never enter for me too."', 2],
      ['"Take am. No pay me back."', 1],
      ['"Who are you again?"', 0] ] },
  { say: 'Somebody from your platoon: "You dey come NCCF tonight?"',
    opts: [
      ['"I dey come. Save space for me."', 2],
      ['"Depends. Dem go share food?"', 1],
      ['"No. I dey sleep."', 0] ] },
  { say: 'Corper beside you at Mami: "This indomie no sweet at all."',
    opts: [
      ['"Na the hunger dey sweet, no be the indomie."', 2],
      ['"Try the boli side. Madam sabi."', 1],
      ['"Then why you dey chop am?"', 0] ] },
  { say: 'Your bunkmate at 2am: "You dey awake? I no fit sleep."',
    opts: [
      ['"Same. Make we gist small."', 2],
      ['"Count the ceiling. Na so I take dey do."', 1],
      ['"Bugle go blow by 4:30. Abeg."', 0] ] },
  { say: 'Platoon leader: "We need one person for the drama for social night."',
    opts: [
      ['"I fit try. Wetin be the role?"', 2],
      ['"Give am to Chidi. He get mouth."', 1],
      ['"Count me out completely."', 0] ] },
  { say: 'Somebody: "Which state you think dem go post you?"',
    opts: [
      ['"Anywhere wey get network, I don happy."', 2],
      ['"I dey pray for Lagos but I dey prepare for Zamfara."', 2],
      ['"I no wan talk about am."', 0] ] },
  { say: 'Soldier pass. Corper beside you whisper: "Oga dey look us."',
    opts: [
      ['Straighten up and say nothing.', 2],
      ['Whisper back: "Make we just dey move."', 1],
      ['Laugh out loud.', 0] ] },
];

export function playSocialise(host) {
  return new Promise(resolve => {
    const N = 5;
    const picked = [...GIST].sort(() => Math.random() - 0.5).slice(0, N);
    let i = 0, points = 0, locked = false;

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>Camp gist</b><span id="mgInfo"></span></p>
      <p class="gist-say" id="gistSay"></p>
      <div class="gist-opts" id="gistOpts"></div>
      <p class="mg-hint" id="gistFb">Read the room.</p></div>`;
    const say = host.querySelector('#gistSay'), opts = host.querySelector('#gistOpts');
    const info = host.querySelector('#mgInfo'), fb = host.querySelector('#gistFb');

    const esc = t => String(t).replace(/[&<>"]/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

    function render() {
      const it = picked[i];
      info.textContent = `${i + 1} of ${N}`;
      say.textContent = it.say;
      const shuffled = [...it.opts].sort(() => Math.random() - 0.5);
      opts.innerHTML = shuffled.map(([t, v], n) =>
        `<button class="gist-opt" data-v="${v}">${esc(t)}</button>`).join('');
      locked = false;
    }

    opts.addEventListener('click', e => {
      const b = e.target.closest('.gist-opt');
      if (!b || locked) return;
      locked = true;
      const v = +b.dataset.v;
      points += v;
      opts.querySelectorAll('.gist-opt').forEach(x => x.disabled = true);
      b.classList.add(v === 2 ? 'right' : v === 1 ? 'okay' : 'wrong');
      fb.textContent = v === 2 ? 'That landed well.'
                     : v === 1 ? 'Fair enough.'
                     :           'Awkward. Dem look you somehow.';
      setTimeout(() => {
        i++;
        if (i >= N) {
          const sc = points / (N * 2);
          const line = sc >= 0.85 ? 'Everybody for your platoon sabi you now.'
                     : sc >= 0.5  ? 'You made small friends.'
                     : sc >= 0.25 ? 'You said the wrong thing a few times.'
                     :              'You should have kept quiet.';
          resolve({ score: sc, detail: `Camp gist: ${line}`, friends: Math.round(sc * 3) });
          return;
        }
        fb.textContent = '\u00a0';
        render();
      }, 850);
    });

    render();
  });
}

/* ------------------------------------------------------------ rehearse ---- */
/* Passing-out drill. Obey the command — unless it is "AS YOU WERE", which means
   stand still. The trap is doing something when you should do nothing. */
const DRILL = ['ATTENTION', 'AT EASE', 'RIGHT TURN', 'LEFT TURN', 'SALUTE'];

export function playRehearse(host) {
  return new Promise(resolve => {
    const N = 10;
    let i = 0, good = 0, cmd = '', locked = false, deadline = 0, raf = 0, hold = false;

    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>Passing-out drill</b><span id="mgInfo"></span></p>
      <p class="soc-call" id="drillCmd"></p>
      <div class="reg-bar"><i id="drillFill"></i></div>
      <div class="soc-grid" id="drillGrid"></div>
      <button class="mami-done" id="drillStill" style="background:var(--muted);margin-top:7px">Stand still</button>
      <p class="mg-hint" id="drillFb">Obey the command. "As you were" means do nothing.</p></div>`;
    const cmdEl = host.querySelector('#drillCmd'), grid = host.querySelector('#drillGrid');
    const info = host.querySelector('#mgInfo'), fb = host.querySelector('#drillFb');
    const fill = host.querySelector('#drillFill');

    function go() {
      locked = false;
      hold = Math.random() < 0.3;                 // roughly one in three is a trap
      cmd = hold ? 'AS YOU WERE' : DRILL[Math.floor(Math.random() * DRILL.length)];
      const limit = Math.max(1100, 2200 - i * 110);
      info.textContent = `${i + 1} of ${N} · ${good} right`;
      cmdEl.textContent = cmd;
      grid.innerHTML = DRILL.map(d =>
        `<button class="soc-move" data-d="${d}">${d}</button>`).join('');
      deadline = performance.now() + limit;
      cancelAnimationFrame(raf);
      const sweep = () => {
        const left = Math.max(0, deadline - performance.now());
        fill.style.width = (100 * left / limit) + '%';
        if (left <= 0) return answer(hold ? 'STILL' : null);   // standing still is the default
        raf = requestAnimationFrame(sweep);
      };
      sweep();
    }

    function answer(given) {
      if (locked) return;
      locked = true;
      cancelAnimationFrame(raf);
      const want = hold ? 'STILL' : cmd;
      const ok = given === want;
      if (ok) good++;
      fb.textContent = ok ? 'Correct.'
        : hold ? 'You moved on "as you were". Sergeant saw that.'
        : given ? 'Wrong movement.' : 'Too slow.';
      grid.querySelectorAll('.soc-move').forEach(b => {
        b.disabled = true;
        if (!hold && b.dataset.d === cmd) b.classList.add('right');
        else if (b.dataset.d === given) b.classList.add('wrong');
      });
      setTimeout(() => {
        i++;
        if (i >= N) {
          const sc = good / N;
          const line = sc >= 0.9 ? 'Your line was the sharpest on the ground.'
                     : sc >= 0.6 ? 'You held the drill together.'
                     : sc >= 0.3 ? 'Sergeant made the whole platoon start again. Twice.'
                     :             'You were a step behind the whole rehearsal.';
          resolve({ score: sc, detail: `Rehearsal: ${line}` });
          return;
        }
        fb.textContent = '\u00a0';
        go();
      }, 700);
    }

    grid.addEventListener('click', e => {
      const b = e.target.closest('.soc-move');
      if (b && !b.disabled) answer(b.dataset.d);
    });
    host.querySelector('#drillStill').onclick = () => { if (!locked) answer('STILL'); };
    go();
  });
}

/* ---------------------------------------------------------------- quiz ---- */
/* Deliberately general Nigerian knowledge rather than NYSC trivia — the camp
   framing is already everywhere else, and this has to be answerable by anyone. */
const BANK = [
  ['Which city is the capital of Nigeria?', ['Abuja','Lagos','Kano','Ibadan'], 0],
  ['How many states does Nigeria have?', ['36','30','24','42'], 0],
  ['In what year did Nigeria gain independence?', ['1960','1957','1963','1970'], 0],
  ['Who won the Nobel Prize in Literature in 1986?', ['Wole Soyinka','Chinua Achebe','Ben Okri','Cyprian Ekwensi'], 0],
  ['Which two rivers meet at Lokoja?', ['Niger and Benue','Niger and Cross','Benue and Ogun','Niger and Kaduna'], 0],
  ['What is the Nigerian currency called?', ['Naira','Cedi','Shilling','Dalasi'], 0],
  ['Which novel did Chinua Achebe publish in 1958?', ['Things Fall Apart','No Longer at Ease','Arrow of God','A Man of the People'], 0],
  ['How many times has Nigeria won the Africa Cup of Nations?', ['3','1','5','2'], 0],
  ['What is the name of Nigeria’s mens football team?', ['Super Eagles','Black Stars','Indomitable Lions','Bafana Bafana'], 0],
  ['Which Nigerian city is famous for its film industry, Nollywood?', ['Lagos','Jos','Enugu','Benin City'], 0],
  ['Which festival is celebrated by the Osun people in Osogbo?', ['Osun-Osogbo','Eyo','Argungu','Calabar Carnival'], 0],
  ['What does "danfo" refer to?', ['A yellow minibus','A motorcycle taxi','A market','A type of soup'], 0],
  ['Which state is known as the Centre of Commerce?', ['Aba, Abia State','Kano State','Rivers State','Oyo State'], 0],
  ['Jollof rice is commonly argued over between Nigeria and which country?', ['Ghana','Kenya','Egypt','Senegal'], 0],
  ['What is "suya"?', ['Spiced grilled meat','A fried pastry','A soup','A drink'], 0],
  ['Which language is spoken by the largest group in the south-west?', ['Yoruba','Igbo','Hausa','Tiv'], 0],
  ['What is the highest point in Nigeria?', ['Chappal Waddi','Zuma Rock','Olumo Rock','Shere Hills'], 0],
  ['Which Nigerian won a Grammy for Best Global Music Album in 2021?', ['Burna Boy','Davido','Wizkid','Tiwa Savage'], 0],
  ['What does "owambe" describe?', ['A big party','A traffic jam','A market day','A rainstorm'], 0],
  ['Which city is known as the Garden City?', ['Port Harcourt','Calabar','Kaduna','Akure'], 0],
  ['What is "amala" usually made from?', ['Yam flour','Maize','Rice','Cassava leaves'], 0],
  ['Which Nigerian author wrote "Half of a Yellow Sun"?', ['Chimamanda Ngozi Adichie','Buchi Emecheta','Sefi Atta','Lola Shoneyin'], 0],
  ['What is the official language of Nigeria?', ['English','Hausa','Yoruba','French'], 0],
  ['Zuma Rock sits near which city?', ['Abuja','Jos','Minna','Lokoja'], 0],
  ['Which Nigerian state has the smallest land area?', ['Lagos','Ebonyi','Anambra','Bayelsa'], 0],
  ['"Keke napep" is a common name for what?', ['A tricycle taxi','A bus stop','A phone','A hairstyle'], 0],
  ['Which sea or ocean borders Nigeria to the south?', ['Atlantic Ocean','Indian Ocean','Red Sea','Mediterranean Sea'], 0],
  ['What is "pure water" normally sold in?', ['A sachet','A clay pot','A glass bottle','A carton'], 0],
  ['Which city hosted the 2nd World Black Festival of Arts in 1977?', ['Lagos','Kaduna','Ibadan','Enugu'], 0],
  ['What is "egusi" made from?', ['Melon seeds','Groundnuts','Beans','Okra'], 0],
];

export function playQuiz(host) {
  return new Promise(resolve => {
    const N = 5;
    const picked = [...BANK].sort(() => Math.random() - 0.5).slice(0, N)
      .map(([q, opts, correct]) => {
        const order = opts.map((t, i) => [t, i]).sort(() => Math.random() - 0.5);
        return { q, opts: order.map(o => o[0]), correct: order.findIndex(o => o[1] === correct) };
      });

    let i = 0, right = 0, locked = false;
    host.innerHTML = `<div class="mg">
      <p class="mg-top"><b>Camp quiz</b><span id="mgInfo"></span></p>
      <p class="quiz-q" id="quizQ"></p>
      <div class="quiz-opts" id="quizO"></div>
      <p class="mg-hint" id="quizFb">Five questions. No second chances.</p></div>`;
    const qEl = host.querySelector('#quizQ'), oEl = host.querySelector('#quizO');
    const info = host.querySelector('#mgInfo'), fb = host.querySelector('#quizFb');

    function render() {
      const item = picked[i];
      info.textContent = `${i + 1} of ${N} · ${right} right`;
      qEl.textContent = item.q;
      oEl.innerHTML = item.opts.map((t, n) =>
        `<button class="quiz-opt" data-n="${n}">${t.replace(/[&<>"]/g, c =>
          ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</button>`).join('');
      locked = false;
    }

    oEl.addEventListener('click', e => {
      const b = e.target.closest('.quiz-opt');
      if (!b || locked) return;
      locked = true;
      const n = Number(b.dataset.n), item = picked[i];
      const buttons = [...oEl.querySelectorAll('.quiz-opt')];
      buttons.forEach(x => x.disabled = true);
      buttons[item.correct].classList.add('right');
      if (n === item.correct) { right++; fb.textContent = 'Correct.'; }
      else { b.classList.add('wrong'); fb.textContent = `No — it is ${item.opts[item.correct]}.`; }
      setTimeout(() => {
        i++;
        if (i >= N) {
          const line = right === 5 ? 'Five out of five. Who send you?'
                     : right >= 3 ? `${right} out of 5. Correct guy.`
                     : right >= 1 ? `${right} out of 5. You need read small.`
                     :              'Zero. Na wa for you.';
          resolve({ score: right / N, detail: `Camp quiz: ${line}` });
          return;
        }
        fb.textContent = ' ';
        render();
      }, 950);
    });

    render();
  });
}
