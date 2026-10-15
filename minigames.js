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
