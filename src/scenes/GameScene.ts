import Phaser from 'phaser';
import { RoundResultData } from '../rng/RoundResult';
import {
  ballBodyOptions,
  computeLaunchVelocity,
  FEEL,
  LANE_GUIDE_X,
  pegClearsLaneWall,
} from '../physics/FeelConfig';

export class GameScene extends Phaser.Scene {
  private static readonly BASE_WIDTH = 480;
  private static readonly BASE_HEIGHT = 854;
  protected _ball: Phaser.Physics.Matter.Sprite | undefined;
  private _extraBalls: Phaser.Physics.Matter.Sprite[] = [];
  private _activeBalls: Set<Phaser.Physics.Matter.Sprite> = new Set();
  private _noBallCollisionGroup: number | undefined;
  private _lastStopLogTime: number = 0;
  private _lastStuckShakeTime: number = 0;
  private _ballLastMotion: Map<Phaser.Physics.Matter.Sprite, number> = new Map();
  private _ballLastSample: Map<Phaser.Physics.Matter.Sprite, { x: number; y: number }> =
    new Map();
  private _settlingBalls: Set<Phaser.Physics.Matter.Sprite> = new Set();
  private _roundActive: boolean = false;
  private _roundData: RoundResultData | undefined;
  private _pendingOutcome:
    | {
        isWin: boolean;
        multiplier: number;
        tunnelIndex: number;
      }
    | undefined;
  private readonly _springX: number = 453;
  private readonly _springTop: number = 668;
  private readonly _springBottom: number = 722;
  private _springCompression: number = 0;
  protected _springGraphics!: Phaser.GameObjects.Graphics;

  private _tunnelLEDs: Phaser.GameObjects.Image[] = [];
  protected _astronaut?: Phaser.GameObjects.Image;
  private _astronautTween: Phaser.Tweens.Tween | null = null;
  protected _astronautBaseX: number = 210;
  private _astronautMoveDuration: number = 1400;
  private _mapTravelTriggered: boolean = false;
  private _lastCredits: number | null = null;

  constructor(key: string = 'GameScene') {
    super(key);
  }

  create() {
    this.applyViewport();
    this.scale.on('resize', this.applyViewport, this);

    // Scaffold out physics playfield, pegs, tunnel sensors
    this.createPlayfield();
    this.createPegGrid();
    this.createTunnels();

    // Set world bounds (left, top, right, bottom)
    this.matter.world.setBounds(0, 0, GameScene.BASE_WIDTH, GameScene.BASE_HEIGHT);

    // Launching logic hooks
    this.events.on('launchBall', this.launchBall, this);
    this.events.on('prepare_ball', this.prepareBall, this);
    this.events.on('spring_charge', this.setSpringCompression, this);
    this.events.on('ui_update_tunnels', this.updateTunnels, this);
    this.events.on('ui_update_credits', this.onCreditsUpdate, this);

    this.matter.world.on('collisionstart', (event: MatterJS.IEventCollision<MatterJS.Body>) => {
      for (const pair of event.pairs) {
        this.checkTunnelCollision(pair.bodyA as MatterJS.BodyType, pair.bodyB as MatterJS.BodyType);
        this.checkPegCollision(pair.bodyA as MatterJS.BodyType, pair.bodyB as MatterJS.BodyType);
      }
    });
  }

  override update(_time: number, _delta: number): void {
    // Expose ball coordinates for e2e tests
    if (this._ball && this._ball.body) {
      (window as any).debug_ball_x = this._ball.x;
      (window as any).debug_ball_y = this._ball.y;
      (window as any).debug_ball_vx = this._ball.body.velocity.x;
      (window as any).debug_ball_vy = this._ball.body.velocity.y;

      const activeBalls = this._activeBalls.size > 0 ? Array.from(this._activeBalls) : [this._ball];
      for (const ball of activeBalls) {
        if (!ball) continue;
        const body = ball.body as MatterJS.BodyType | undefined;
        if (!body) continue;

        this.handleBallMotion(ball, body);
      }

      // Failed launch detection (fell back down shooter lane)
      if (this._ball && this._ball.body && this._ball.y > 740 && this._ball.x > 430) {
        this.events.emit('failed_launch');
        this._ball.destroy();
        this._ball = undefined;
      }
    }
  }

  protected createPlayfield() {
    // Backgrounds
    // Art Zone (154 -> 317)
    this.add.rectangle(10, 154, 460, 163, 0x0d2040).setOrigin(0);
    // Peg Field (317 -> 648)
    const bgTile = this.add.tileSprite(10, 317, 426, 331, 'bg_tile').setOrigin(0);
    bgTile.alpha = 0.5; // Tone down the dithering a bit

    // Arch Border
    const g = this.add.graphics();
    g.lineStyle(3, 0xffb300);
    g.strokeRoundedRect(10, 154, 460, 580, 20); // covers art zone, peg field, tunnels, and lane

    // Side rails (gradient simulation + physics)
    this.add.rectangle(0, 154, 10, 580, 0x3a3f50).setOrigin(0); // left rail
    // Widen invisible wall outside the left edge to prevent tunneling
    this.matter.add.rectangle(-20, 154 + 290, 50, 580, { isStatic: true });

    this.add.rectangle(470, 154, 10, 580, 0x3a3f50).setOrigin(0); // right rail
    // Widen invisible wall outside the right edge to prevent tunneling
    this.matter.add.rectangle(500, 154 + 290, 50, 580, { isStatic: true });

    // Ceiling wall (widen to 50 thick, moved 20px up so the bottom edge sits exactly at 154)
    this.matter.add.rectangle(240, 154 - 25, 480, 50, { isStatic: true });

    // Lane Guide (right side) - start lower at 350 so ball can escape
    const LANE_GUIDE_Y = 350;
    const LANE_GUIDE_HEIGHT = 734 - LANE_GUIDE_Y; // 384
    this.add.rectangle(LANE_GUIDE_X, LANE_GUIDE_Y, 4, LANE_GUIDE_HEIGHT, 0x888ea0).setOrigin(0); // chrome guide wall
    this.matter.add.rectangle(
      LANE_GUIDE_X + 2,
      LANE_GUIDE_Y + LANE_GUIDE_HEIGHT / 2,
      4,
      LANE_GUIDE_HEIGHT,
      { isStatic: true }
    );
    this.matter.add.circle(LANE_GUIDE_X + 2, LANE_GUIDE_Y, 2, { isStatic: true, restitution: 0.4 });

    this.addLaneWallBumpers(LANE_GUIDE_Y);

    // Shooter Lane Spring
    this._springGraphics = this.add.graphics();
    this.drawSpring();

    // Solid Curved Deflector Block in top right
    g.fillStyle(0x1a1e2a); // gunmetal cabinet color
    g.beginPath();
    g.moveTo(380, 154); // start on ceiling
    g.lineTo(470, 154); // over to corner
    g.lineTo(470, 260); // down right wall

    // Smooth curve back up
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(470, 260), // Start (bottom right)
      new Phaser.Math.Vector2(460, 180), // Control point
      new Phaser.Math.Vector2(380, 154) // End (ceiling)
    );
    const curvePoints = curve.getPoints(16);
    curvePoints.forEach((p) => g.lineTo(p.x, p.y));

    g.closePath();
    g.fillPath();

    // Chrome face of the curved deflector
    g.lineStyle(4, 0x888ea0);
    g.beginPath();
    curvePoints.forEach((p, index) => {
      if (index === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    });
    g.strokePath();

    // Physics for curved deflector using small rectangles (segments) to ensure perfect alignment
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const p1 = curvePoints[i];
      const p2 = curvePoints[i + 1];
      if (!p1 || !p2) continue;

      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
      const length = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);

      this.matter.add.rectangle(cx, cy, length, 4, {
        isStatic: true,
        angle: angle,
        restitution: 0.2,
      });

      // Smooth out the joints with tiny circles so the ball never snags on a corner
      this.matter.add.circle(p1.x, p1.y, 2, {
        isStatic: true,
        restitution: 0.2,
      });
    }
    const lastP = curvePoints[curvePoints.length - 1];
    if (lastP) {
      this.matter.add.circle(lastP.x, lastP.y, 2, { isStatic: true, restitution: 0.2 });
    }

    // Also add the vertical right wall part of the deflector (down to 260)
    // The right rail goes from 154 -> 734. The curve ends at 470, 260.
    // The ball needs to smoothly hit the curve from the right wall.

    // (Removed old thin 10px ceiling wall since the new 50px thick one is declared above)

    // Astronaut Mascot in Art Zone
    this._astronautBaseX = 210;
    this._astronaut = this.add.image(this._astronautBaseX, 235, 'astronaut'); // shifted slightly left

    // Draw 28 deterministic stars in art zone
    const rng = new Phaser.Math.RandomDataGenerator('stars_seed');
    g.fillStyle(0xffffff);
    for (let i = 0; i < 28; i++) {
      g.fillRect(rng.integerInRange(20, 420), rng.integerInRange(160, 300), 2, 2);
    }
  }

  private onCreditsUpdate(credits: number): void {
    if (this._lastCredits === null) {
      this._lastCredits = credits;
      return;
    }

    const crossedTravelThreshold = this._lastCredits <= 1000 && credits > 1000;
    if (crossedTravelThreshold && !this._mapTravelTriggered && this.scene.key === 'GameScene') {
      this._mapTravelTriggered = true;
      this._lastCredits = credits;
      if (this._astronaut) {
        if (this._astronautTween) {
          this._astronautTween.stop();
          this._astronautTween.remove();
          this._astronautTween = null;
        }
        this.events.emit('map_travel_begin');
        this.tweens.add({
          targets: this._astronaut,
          x: this._astronautBaseX + 40,
          y: 170,
          alpha: 0,
          duration: 1000,
          ease: 'Cubic.easeIn',
          onUpdate: () => {
            if (this._astronaut) {
              this._astronaut.x = Math.round(this._astronaut.x);
              this._astronaut.y = Math.round(this._astronaut.y);
            }
          },
          onComplete: () => {
            this.events.emit('map_travel_complete');
          },
        });
      }
      return;
    }

    this._lastCredits = credits;

    const shouldMove = credits > 500;
    if (!this._astronaut) return;

    if (shouldMove) {
      const step = Phaser.Math.Clamp(Math.floor((credits - 500) / 100), 0, 5);
      const duration = Math.max(600, 1400 - step * 160);
      if (this._astronautTween?.isPlaying() && this._astronautMoveDuration === duration) return;

      if (this._astronautTween) {
        this._astronautTween.stop();
        this._astronautTween.remove();
        this._astronautTween = null;
      }
      this._astronautMoveDuration = duration;
      this._astronautTween = this.tweens.add({
        targets: this._astronaut,
        x: this._astronautBaseX + 28,
        duration: this._astronautMoveDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          if (this._astronaut) this._astronaut.x = Math.round(this._astronaut.x);
        },
      });
      return;
    }

    if (this._astronautTween) {
      this._astronautTween.stop();
      this._astronautTween.remove();
      this._astronautTween = null;
    }
    this._astronaut.x = this._astronautBaseX;
  }

  protected addLaneWallBumpers(laneGuideY: number): void {
    for (let y = laneGuideY + 30; y <= FEEL.tunnelY - 20; y += 65) {
      this.matter.add.circle(LANE_GUIDE_X - 5, y, 4, {
        isStatic: true,
        restitution: 0.35,
        friction: 0.005,
      });
    }
  }

  protected applyViewport(): void {
    const { width, height } = this.scale;
    const zoom = Math.min(width / GameScene.BASE_WIDTH, height / GameScene.BASE_HEIGHT);
    const roundedZoom = Math.max(0.5, Math.floor(zoom * 100) / 100);
    this.cameras.main.setZoom(roundedZoom);
    this.cameras.main.centerOn(GameScene.BASE_WIDTH / 2, GameScene.BASE_HEIGHT / 2);
  }

  protected createPegGrid() {
    // 9 cols even rows, 8 cols odd rows to make spacing wider
    // Y: 317 -> 648
    const PLAYFIELD_X1 = 10;
    const ROW_SPACING = 48; // increased from 36
    const COL_SPACING = 48; // increased from 44
    const LEFT_OFFSET = 18; // pushed close to left wall
    const PEG_FIELD_Y = 317;

    let rows = Math.max(5, Math.floor(331 / ROW_SPACING));

    for (let r = 0; r < rows; r++) {
      const isIndented = r % 2 === 1;
      const cols = isIndented ? 8 : 9;
      const xOffset = isIndented ? LEFT_OFFSET + COL_SPACING / 2 : LEFT_OFFSET;

      for (let c = 0; c < cols; c++) {
        const px = PLAYFIELD_X1 + xOffset + c * COL_SPACING;
        const py = PEG_FIELD_Y + 20 + r * ROW_SPACING;

        const pegRadius = r === 0 ? FEEL.washer.circleRadius : FEEL.peg.circleRadius;
        if (pegClearsLaneWall(px, pegRadius)) {
          this.addPegAt(px, py, r === 0);
        }
      }
    }
  }

  protected addPegAt(px: number, py: number, isWasherRow: boolean): void {
    if (isWasherRow) {
      this.matter.add.image(px, py, 'peg_washer', undefined, {
        isStatic: true,
        circleRadius: FEEL.washer.circleRadius,
        restitution: FEEL.washer.restitution,
        friction: FEEL.washer.friction,
        label: 'peg_washer',
      });
      return;
    }

    this.matter.add.image(px, py, 'peg', undefined, {
      isStatic: true,
      circleRadius: FEEL.peg.circleRadius,
      restitution: FEEL.peg.restitution,
      friction: FEEL.peg.friction,
      label: 'peg',
    });
  }

  protected createTunnels() {
    // 12 slots, red LEDs
    // Y: 648 -> 735
    const TUNNEL_Y = 648;
    const TUNNEL_HEIGHT = 86;
    const TUNNEL_WIDTH = 426;

    this._tunnelLEDs = [];

    this.add.rectangle(10, TUNNEL_Y, TUNNEL_WIDTH, TUNNEL_HEIGHT, 0x050b14).setOrigin(0);

    const slotWidth = TUNNEL_WIDTH / 12; // 35.5px

    // Full-width tunnel catcher sensor to avoid missed slot sensors
    this.matter.add.rectangle(
      10 + TUNNEL_WIDTH / 2,
      TUNNEL_Y + TUNNEL_HEIGHT / 2,
      TUNNEL_WIDTH,
      TUNNEL_HEIGHT,
      {
        isStatic: true,
        isSensor: true,
        label: 'tunnel_catcher',
      }
    );

    // Solid floor so the ball can settle in a tunnel
    this.matter.add.rectangle(
      10 + TUNNEL_WIDTH / 2,
      TUNNEL_Y + TUNNEL_HEIGHT - 2,
      TUNNEL_WIDTH,
      4,
      {
        isStatic: true,
        restitution: 0,
      }
    );

    // Corner guides to prevent wall wedging in tunnels
    const guideWidth = 14;
    const guideHeight = 4;
    const guideY = TUNNEL_Y + TUNNEL_HEIGHT - 8;
    const guideAngle = Phaser.Math.DegToRad(30);
    this.matter.add.rectangle(10 + 6, guideY, guideWidth, guideHeight, {
      isStatic: true,
      angle: guideAngle,
      restitution: 0.05,
      friction: 0.2,
    });
    this.matter.add.rectangle(10 + TUNNEL_WIDTH - 6, guideY, guideWidth, guideHeight, {
      isStatic: true,
      angle: -guideAngle,
      restitution: 0.05,
      friction: 0.2,
    });

    for (let i = 0; i < 12; i++) {
      const x = 10 + i * slotWidth;
      // Divider
      this.add.rectangle(x, TUNNEL_Y, 2, TUNNEL_HEIGHT, 0x888ea0).setOrigin(0);
      this.matter.add.rectangle(x + 1, TUNNEL_Y + TUNNEL_HEIGHT / 2, 3, TUNNEL_HEIGHT, {
        isStatic: true,
        restitution: 0.1,
      });

      // Unlit LED (vertically centered in the 86px tall tunnel)
      const led = this.add.image(x + slotWidth / 2, TUNNEL_Y + TUNNEL_HEIGHT / 2, 'led_unlit');
      this._tunnelLEDs.push(led);

      // Add a sensor at the bottom of the tunnel to detect the ball
      const sensorHeight = TUNNEL_HEIGHT;
      this.matter.add.rectangle(
        x + slotWidth / 2,
        TUNNEL_Y + TUNNEL_HEIGHT - sensorHeight / 2,
        slotWidth - 4, // slightly narrower than the slot
        sensorHeight,
        {
          isStatic: true,
          isSensor: true,
          label: `tunnel_sensor_${i}`,
        }
      );
    }
  }

  public updateTunnels(winningTunnels: number[]): void {
    this._tunnelLEDs.forEach((led, idx) => {
      led.setTexture(winningTunnels.includes(idx) ? 'led_lit' : 'led_unlit');
    });
  }

  public launchBall(power: number, roundData: RoundResultData, count: number = 1): void {
    const velocity = computeLaunchVelocity(power);
    if (!velocity) {
      this.events.emit('failed_launch');
      return;
    }

    this.sound.play('sfx_launch');

    this._roundActive = true;
    this._roundData = roundData;
    this._pendingOutcome = undefined;

    this.clearExtraBalls();
    this._activeBalls.clear();

    const noBallCollision = count > 1;
    if (noBallCollision && this._noBallCollisionGroup === undefined) {
      this._noBallCollisionGroup = this.matter.world.nextGroup(true);
    }

    const spawnX = this._springX;
    const compressionPixels = 14 * this._springCompression;
    const spawnY = this._springTop - 8 + compressionPixels;

    const mainBody = this._ball?.body as MatterJS.BodyType | undefined;
    if (this._ball && mainBody && mainBody.isStatic) {
      this._ball.setPosition(spawnX, spawnY);
    } else {
      if (this._ball) {
        this._ball.destroy();
      }

      this._ball = this.matter.add.sprite(spawnX, spawnY, 'ball', undefined, ballBodyOptions());
      // Prevent the ball from ever sleeping
      if (this._ball.body) {
        this.matter.body.set(this._ball.body as MatterJS.BodyType, 'sleepThreshold', -1);
      }
    }

    this._ball.setStatic(false);
    this._ball.setIgnoreGravity(false);
    this.applyBallCollisionGroup(this._ball, noBallCollision);
    this._activeBalls.add(this._ball);

    const { vx, vy } = velocity;
    this._ball.setVelocity(vx, vy);

    const extraCount = Math.max(0, Math.floor(count) - 1);
    const spread = 12;
    for (let i = 0; i < extraCount; i++) {
      const offsetX = (i - (extraCount - 1) / 2) * (spread / Math.max(1, extraCount));
      const extra = this.matter.add.sprite(spawnX + offsetX, spawnY, 'ball', undefined, ballBodyOptions());
      if (extra.body) {
        this.matter.body.set(extra.body as MatterJS.BodyType, 'sleepThreshold', -1);
      }
      this.applyBallCollisionGroup(extra, noBallCollision);
      extra.setVelocity(vx, vy);
      this._extraBalls.push(extra);
      this._activeBalls.add(extra);
    }
  }

  public prepareBall(): void {
    this.clearAllBalls();

    const spawnX = this._springX;
    const compressionPixels = 14 * this._springCompression;
    const spawnY = this._springTop - 8 + compressionPixels;

    this._ball = this.matter.add.sprite(spawnX, spawnY, 'ball', undefined, ballBodyOptions());

    if (this._ball.body) {
      this.matter.body.set(this._ball.body as MatterJS.BodyType, 'sleepThreshold', -1);
    }
    this._ball.setStatic(true);
    this._ball.setIgnoreGravity(true);
    this.applyBallCollisionGroup(this._ball, false);
  }

  public setSpringCompression(ratio: number): void {
    this._springCompression = Phaser.Math.Clamp(ratio, 0, 1);
    this.drawSpring();
  }

  protected drawSpring(): void {
    if (!this._springGraphics) return;

    const springX = this._springX;
    const springTop = this._springTop;
    const springBottom = this._springBottom;
    const springSegments = 7;
    const springWidth = 10;
    const compression = 14 * this._springCompression;

    const topY = springTop + compression;
    const bottomY = springBottom;

    this._springGraphics.clear();
    this._springGraphics.lineStyle(2, 0x888ea0);
    this._springGraphics.beginPath();
    for (let i = 0; i <= springSegments; i++) {
      const t = i / springSegments;
      const y = topY + (bottomY - topY) * t;
      const x = springX + (i % 2 === 0 ? -springWidth / 2 : springWidth / 2);
      if (i === 0) this._springGraphics.moveTo(x, y);
      else this._springGraphics.lineTo(x, y);
    }
    this._springGraphics.strokePath();
    this._springGraphics.fillStyle(0x3a3f50);
    this._springGraphics.fillRect(springX - 8, topY - 4, 16, 4);
    this._springGraphics.fillRect(springX - 8, bottomY, 16, 6);
  }

  public beginRound(): void {
    // Initialize betting cycle
  }

  private checkTunnelCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    if (!this._roundActive) return;

    const ball = this.getActiveBall(bodyA, bodyB);
    if (!ball) return;

    const sensorBody = bodyA.gameObject === ball ? bodyB : bodyA;

    if (!sensorBody.label) return;

    // The tunnel sensor's label should start with 'tunnel_sensor_'
    if (sensorBody.label.startsWith('tunnel_sensor_')) {
      const tunnelIndexStr = sensorBody.label.replace('tunnel_sensor_', '');
      const tunnelIndex = parseInt(tunnelIndexStr, 10);

      this.handleTunnelEntry(ball, tunnelIndex);
      return;
    }

    if (sensorBody.label === 'tunnel_catcher') {
      const TUNNEL_X = 10;
      const TUNNEL_WIDTH = 426;
      const slotWidth = TUNNEL_WIDTH / 12;
      const relativeX = ball.x - TUNNEL_X;

      if (relativeX >= 0 && relativeX <= TUNNEL_WIDTH) {
        const tunnelIndex = Math.min(11, Math.max(0, Math.floor(relativeX / slotWidth)));
        this.handleTunnelEntry(ball, tunnelIndex);
      }
    }
  }

  protected checkPegCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    if (!this._ball) return;

    const isBallA = bodyA.gameObject === this._ball;
    const isBallB = bodyB.gameObject === this._ball;

    if (!isBallA && !isBallB) return;

    const pegBody = isBallA ? bodyB : bodyA;

    if (
      (pegBody.label === 'peg' || pegBody.label === 'peg_washer') &&
      pegBody.gameObject
    ) {
      this.triggerPegBloom(
        pegBody.gameObject as Phaser.Physics.Matter.Image,
        pegBody.label === 'peg_washer'
      );
    }
  }

  protected triggerPegBloom(pegImage: Phaser.Physics.Matter.Image, isWasher = false): void {
    this.sound.play('sfx_peg', { volume: isWasher ? 0.65 : 0.5 });

    const bloom = this.add.sprite(pegImage.x, pegImage.y - 2, 'peg_bloom');
    bloom.setBlendMode(Phaser.BlendModes.ADD);

    const colors = isWasher
      ? [0xff3344, 0xff6677, 0xffb300]
      : [0xffb300, 0x00d9ff, 0xff0055, 0x00ff88, 0xbf00ff];
    const tint = colors[Math.floor(Math.random() * colors.length)];
    if (tint !== undefined) bloom.setTint(tint);

    this.tweens.add({
      targets: bloom,
      scale: isWasher ? 1.8 : 1.5,
      alpha: 0,
      duration: isWasher ? 260 : 300,
      ease: 'Power2',
      onComplete: () => {
        bloom.destroy();
      },
    });

    this.cameras.main.shake(100, isWasher ? 0.004 : 0.002);
  }

  private handleTunnelEntry(ball: Phaser.Physics.Matter.Sprite, tunnelIndex: number): void {
    if (!this._roundActive) return;
    if (!this._activeBalls.has(ball)) return;
    if (this._settlingBalls.has(ball)) return;
    this._settlingBalls.add(ball);

    console.log('ROUND_COMPLETE_TUNNEL_ENTRY');

    if (!this._roundData) return;

    const isWin = this._roundData.winningTunnels.includes(tunnelIndex);
    const multiplier = isWin ? this._roundData.multiplier : 0;

    if (!this._pendingOutcome) {
      this._pendingOutcome = { isWin, multiplier, tunnelIndex };
    } else if (isWin && !this._pendingOutcome.isWin) {
      this._pendingOutcome = { isWin: true, multiplier, tunnelIndex };
    }

    this.settleBallToTunnel(ball, tunnelIndex, () => {
      this._activeBalls.delete(ball);
      this._settlingBalls.delete(ball);
      this.checkFinalizeRound();
    });
  }

  private clearExtraBalls(): void {
    if (this._extraBalls.length === 0) return;
    for (const ball of this._extraBalls) {
      this._ballLastMotion.delete(ball);
      this._ballLastSample.delete(ball);
      this._settlingBalls.delete(ball);
      ball.destroy();
    }
    this._extraBalls = [];
  }

  private clearAllBalls(): void {
    if (this._ball) {
      this._ballLastMotion.delete(this._ball);
      this._ballLastSample.delete(this._ball);
      this._settlingBalls.delete(this._ball);
      this._ball.destroy();
      this._ball = undefined;
    }
    this.clearExtraBalls();
    this._activeBalls.clear();
    this._settlingBalls.clear();
  }

  private handleBallMotion(ball: Phaser.Physics.Matter.Sprite, body: MatterJS.BodyType): void {
    const MAX_SPEED = FEEL.maxSpeed;
    const currentSpeed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
    if (currentSpeed > MAX_SPEED) {
      const scale = MAX_SPEED / currentSpeed;
      ball.setVelocity(body.velocity.x * scale, body.velocity.y * scale);
    }

    const sample = this._ballLastSample.get(ball);
    if (sample) {
      const moved = Phaser.Math.Distance.Between(ball.x, ball.y, sample.x, sample.y);
      if (moved > FEEL.stuckMoveEpsilon) {
        this._ballLastMotion.set(ball, this.time.now);
      }
    }
    this._ballLastSample.set(ball, { x: ball.x, y: ball.y });

    if (!this._roundActive) return;

    const inPegField = ball.y >= FEEL.pegFieldTop && ball.y < FEEL.tunnelY;
    const inTunnelBand = ball.y >= FEEL.tunnelY && ball.y <= FEEL.tunnelY + 86;
    const lastMotion = this._ballLastMotion.get(ball) ?? this.time.now;
    const stuckTime = this.time.now - lastMotion;

    if (inPegField && stuckTime > FEEL.stuckAfterMs && this.time.now - this._lastStuckShakeTime > 800) {
      this.cameras.main.shake(120, 0.003);
      const nearLaneWall = ball.x > LANE_GUIDE_X - 60;
      const nudgeVx = nearLaneWall
        ? -2.8 - Math.random() * 1.2
        : (Math.random() - 0.5) * 2.0;
      const nudgeVy = 1.0 + Math.random() * 1.2;
      if (nearLaneWall) {
        ball.setPosition(LANE_GUIDE_X - FEEL.ball.circleRadius - 10, ball.y);
      }
      ball.setVelocity(nudgeVx, nudgeVy);
      this._ballLastMotion.set(ball, this.time.now);
      this._ballLastSample.set(ball, { x: ball.x, y: ball.y });
      this._lastStuckShakeTime = this.time.now;
      return;
    }

    if (currentSpeed < 0.05 && !inTunnelBand && this.time.now - this._lastStopLogTime > 1000) {
      console.log('DEBUG_BALL_STOPPED_OUTSIDE_TUNNEL', {
        x: Math.round(ball.x),
        y: Math.round(ball.y),
        vx: Number(body.velocity.x.toFixed(3)),
        vy: Number(body.velocity.y.toFixed(3)),
      });
      this._lastStopLogTime = this.time.now;
    }
  }

  private applyBallCollisionGroup(
    ball: Phaser.Physics.Matter.Sprite,
    noBallCollision: boolean
  ): void {
    if (!noBallCollision || this._noBallCollisionGroup === undefined) return;
    ball.setCollisionGroup(this._noBallCollisionGroup);
  }

  private finalizeRound(): void {
    this.updateTunnels([]);

    const outcome =
      this._pendingOutcome ?? ({ isWin: false, multiplier: 0, tunnelIndex: 0 } as const);

    this.events.emit('round_complete', outcome);

    this._roundActive = false;
    this._roundData = undefined;
    this._pendingOutcome = undefined;
    this._settlingBalls.clear();
  }

  private checkFinalizeRound(): void {
    if (this._activeBalls.size === 0) {
      this.finalizeRound();
    }
  }

  private settleBallToTunnel(
    ball: Phaser.Physics.Matter.Sprite,
    tunnelIndex: number,
    onComplete: () => void
  ): void {
    const TUNNEL_Y = 648;
    const TUNNEL_HEIGHT = 86;
    const TUNNEL_X = 10;
    const TUNNEL_WIDTH = 426;
    const slotWidth = TUNNEL_WIDTH / 12;
    const tunnelCenterX = TUNNEL_X + tunnelIndex * slotWidth + slotWidth / 2;
    const settleY = TUNNEL_Y + TUNNEL_HEIGHT - 12;

    ball.setVelocity(0, 0.5);
    ball.setAngularVelocity(0);
    ball.setIgnoreGravity(false);

    this.tweens.add({
      targets: ball,
      x: tunnelCenterX,
      y: settleY,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => {
        ball.setVelocity(0, 0);
        ball.setAngularVelocity(0);
        ball.setStatic(true);
        ball.setIgnoreGravity(true);
        onComplete();
      },
    });
  }

  private getActiveBall(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType
  ): Phaser.Physics.Matter.Sprite | undefined {
    const gameObjectA = bodyA.gameObject as Phaser.Physics.Matter.Sprite | undefined;
    if (gameObjectA && this._activeBalls.has(gameObjectA)) return gameObjectA;

    const gameObjectB = bodyB.gameObject as Phaser.Physics.Matter.Sprite | undefined;
    if (gameObjectB && this._activeBalls.has(gameObjectB)) return gameObjectB;

    return undefined;
  }
}
