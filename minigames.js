/* Otondo — the playable bits.
   Two mini-games that decide the reward for an action instead of a dice roll,
   so skill matters. Both are phone-first: one thumb, no instructions needed.
   Each resolves to { score: 0..1, detail: 'one line for the camp log' }. */

/* ---------------------------------------------------------------- hoop ---- */
export function playHoop(host) {
  return new Promise(resolve => {
    const W = 320, H = 240, SHOTS = 3;
    host.innerHTML = `
      <div class="mg">
        <p class="mg-top"><b>Camp court</b><span id="mgInfo">Shot 1 of ${SHOTS}</span></p>
        <canvas id="mgCanvas" width="${W}" height="${H}"></canvas>
        <p class="mg-hint">Hold to aim your power. Let go to shoot.</p>
      </div>`;
    const cv = host.querySelector('#mgCanvas'), x = cv.getContext('2d');
    const info = host.querySelector('#mgInfo');

    let shot = 0, made = 0, power = 0, rising = true, charging = false;
    let ball = null, hoopX = 0, done = false;

    const newShot = () => {
      hoopX = 190 + Math.random() * 90;      // the distance changes every time
      power = 0; rising = true; ball = null;
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

      // the shooter
      x.fillStyle = '#8aa863'; x.fillRect(38, H - 96, 16, 42);     // trousers
      x.fillStyle = '#fbf9f2'; x.fillRect(36, H - 126, 20, 32);    // tee
      x.fillStyle = '#8d5524'; x.beginPath(); x.arc(46, H - 136, 11, 0, 7); x.fill();
      x.fillStyle = '#fbf9f2'; x.beginPath();
      x.ellipse(46, H - 140, 12, 8, 0, Math.PI, 0); x.fill();      // white cap
      x.fillStyle = '#0a7a43'; x.fillRect(33, H - 143, 26, 4);

      if (ball) { x.fillStyle = '#e0762a'; x.beginPath(); x.arc(ball.x, ball.y, 8, 0, 7); x.fill();
                  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.2; x.stroke(); }
      else      { x.fillStyle = '#e0762a'; x.beginPath(); x.arc(62, H - 112, 8, 0, 7); x.fill(); }

      // power meter
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(16, 18, 120, 12);
      x.fillStyle = power > .82 ? '#c0392b' : '#0a7a43';
      x.fillRect(16, 18, 120 * power, 12);
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; x.strokeRect(16, 18, 120, 12);
    }

    function tick() {
      if (done) return;
      if (charging) {
        power += rising ? 0.018 : -0.018;   // ~0.9s a sweep: tight, not twitchy
        if (power >= 1) { power = 1; rising = false; }
        if (power <= 0) { power = 0; rising = true; }
      }
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
      const v = 5 + power * 5.5;
      ball = { x: 62, y: H - 112, vx: v * 0.76, vy: -v * 0.86, scored: false };
    }

    const down = e => { e.preventDefault(); if (!ball) { charging = true; } };
    const up   = e => { e.preventDefault(); if (charging) { charging = false; shoot(); } };
    cv.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    const key = e => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      e.preventDefault();
      if (e.type === 'keydown' && !ball && !charging) charging = true;
      if (e.type === 'keyup'   && charging) { charging = false; shoot(); }
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
                 : made === 2    ? 'Two out of three. Solid.'
                 : made === 1    ? 'One in. You try small.'
                 :                 'You miss all three. Na so e dey start.';
      resolve({ score: made / SHOTS, detail: `${made}/${SHOTS} baskets. ${line}` });
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
    const W = 320, H = 240, KICKS = 3;
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
      reach = 30 + Math.random() * 50;      // 30-80: even the far post is not safe
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

      // the taker
      x.fillStyle = '#8aa863'; x.fillRect(150, H - 46, 14, 26);
      x.fillStyle = '#fbf9f2'; x.fillRect(148, H - 66, 18, 22);
      x.fillStyle = '#8d5524'; x.beginPath(); x.arc(157, H - 74, 9, 0, 7); x.fill();
      x.fillStyle = '#fbf9f2'; x.beginPath();
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
      if (done) return;
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
      const line = scored === KICKS ? 'Hat-trick. Keeper no see am at all.'
                 : scored === 2    ? 'Two goals. Striker material.'
                 : scored === 1    ? 'One goal. Manage am.'
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
