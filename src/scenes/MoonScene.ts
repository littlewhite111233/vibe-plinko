import Phaser from 'phaser';
import { FEEL, LANE_GUIDE_X, pegFitsInField } from '../physics/FeelConfig';
import { GameScene } from './GameScene';

export class MoonScene extends GameScene {
  private _moonRocks: Set<Phaser.Physics.Matter.Image> = new Set();
  private _sliderBodies: MatterJS.BodyType[] = [];
  private _sliderTweens: Phaser.Tweens.Tween[] = [];
  private _moonRng: Phaser.Math.RandomDataGenerator = new Phaser.Math.RandomDataGenerator([
    `${Date.now()}`,
  ]);
  private _onCollisionStart: ((event: MatterJS.IEventCollision<MatterJS.Body>) => void) | null = null;
  private _isShuttingDown: boolean = false;

  constructor() {
    super('MoonScene');
  }

  override create() {
    this._isShuttingDown = false;
    super.create();
    this.createMoonSliders();
    this._onCollisionStart = (event: MatterJS.IEventCollision<MatterJS.Body>) => {
      for (const pair of event.pairs) {
        this.handleSliderCollision(pair.bodyA as MatterJS.BodyType, pair.bodyB as MatterJS.BodyType);
      }
    };
    this.matter.world.on('collisionstart', this._onCollisionStart);
    this.events.once('shutdown', this.onShutdown, this);
    this.events.once('destroy', this.onShutdown, this);
  }

  protected override createPlayfield() {
    // Moon art zone + peg field background
    this.add.rectangle(10, 154, 460, 163, 0x111c2b).setOrigin(0);
    const moonBg = this.add.tileSprite(10, 317, 426, 331, 'moon_bg').setOrigin(0);
    moonBg.alpha = 0.7;

    // Arch Border
    const g = this.add.graphics();
    g.lineStyle(3, 0xffb300);
    g.strokeRoundedRect(10, 154, 460, 580, 20);

    // Side rails (gradient simulation + physics)
    this.add.rectangle(0, 154, 10, 580, 0x3a3f50).setOrigin(0);
    this.matter.add.rectangle(-20, 154 + 290, 50, 580, { isStatic: true });

    this.add.rectangle(470, 154, 10, 580, 0x3a3f50).setOrigin(0);
    this.matter.add.rectangle(500, 154 + 290, 50, 580, { isStatic: true });

    // Ceiling wall
    this.matter.add.rectangle(240, 154 - 25, 480, 50, { isStatic: true });

    // Lane Guide (right side)
    const LANE_GUIDE_Y = 350;
    const LANE_GUIDE_HEIGHT = 734 - LANE_GUIDE_Y;
    this.add.rectangle(LANE_GUIDE_X, LANE_GUIDE_Y, 4, LANE_GUIDE_HEIGHT, 0x888ea0).setOrigin(0);
    this.matter.add.rectangle(
      LANE_GUIDE_X + 2,
      LANE_GUIDE_Y + LANE_GUIDE_HEIGHT / 2,
      4,
      LANE_GUIDE_HEIGHT,
      { isStatic: true }
    );
    this.matter.add.circle(LANE_GUIDE_X + 2, LANE_GUIDE_Y, 2, { isStatic: true, restitution: 0.4 });

    this.addLaneWallBumpers(LANE_GUIDE_Y);
    this.addLeftWallBumpers();

    // Shooter Lane Spring
    this._springGraphics = this.add.graphics();
    this.drawSpring();

    // Solid Curved Deflector Block in top right
    g.fillStyle(0x1a1e2a);
    g.beginPath();
    g.moveTo(380, 154);
    g.lineTo(470, 154);
    g.lineTo(470, 260);

    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(470, 260),
      new Phaser.Math.Vector2(460, 180),
      new Phaser.Math.Vector2(380, 154)
    );
    const curvePoints = curve.getPoints(16);
    curvePoints.forEach((p) => g.lineTo(p.x, p.y));

    g.closePath();
    g.fillPath();

    g.lineStyle(4, 0x888ea0);
    g.beginPath();
    curvePoints.forEach((p, index) => {
      if (index === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    });
    g.strokePath();

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

      this.matter.add.circle(p1.x, p1.y, 2, {
        isStatic: true,
        restitution: 0.2,
      });
    }
    const lastP = curvePoints[curvePoints.length - 1];
    if (lastP) {
      this.matter.add.circle(lastP.x, lastP.y, 2, { isStatic: true, restitution: 0.2 });
    }

    this._astronautBaseX = 210;
    this._astronaut = this.add.image(this._astronautBaseX, 235, 'astronaut');

    const rng = new Phaser.Math.RandomDataGenerator('moon_stars_seed');
    g.fillStyle(0x9fb5c9);
    for (let i = 0; i < 36; i++) {
      g.fillRect(rng.integerInRange(20, 420), rng.integerInRange(160, 300), 2, 2);
    }
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
  }

  protected override createPegGrid() {
    const PLAYFIELD_X1 = 10;
    const ROW_SPACING = 48;
    const COL_SPACING = 48;
    const LEFT_OFFSET = 18;
    const PEG_FIELD_Y = 317;

    const rng = this._moonRng;
    let rows = Math.max(5, Math.floor(331 / ROW_SPACING));

    for (let r = 0; r < rows; r++) {
      const isIndented = r % 2 === 1;
      const cols = isIndented ? 8 : 9;
      const xOffset = isIndented ? LEFT_OFFSET + COL_SPACING / 2 : LEFT_OFFSET;

      for (let c = 0; c < cols; c++) {
        const px = PLAYFIELD_X1 + xOffset + c * COL_SPACING;
        const py = PEG_FIELD_Y + 20 + r * ROW_SPACING;

        if (r === 0) {
          if (pegFitsInField(px, FEEL.washer.circleRadius)) {
            this.addPegAt(px, py, true);
          }
          continue;
        }

        const isBigRock = rng.frac() < 0.2;
        const isRock = !isBigRock && rng.frac() < 0.3;
        const circleRadius = isBigRock ? 7 : 5;
        if (!pegFitsInField(px, circleRadius)) continue;

        const textureKey = isBigRock ? 'moon_rock_big' : isRock ? 'moon_rock' : 'peg';
        const label = isBigRock ? 'moon_rock_big' : isRock ? 'moon_rock' : 'peg';
        const peg = this.matter.add.image(px, py, textureKey, undefined, {
          isStatic: true,
          circleRadius: circleRadius,
          restitution: 0.05,
          friction: 0.05,
          label,
        });

        if (isRock || isBigRock) this._moonRocks.add(peg);
      }
    }
  }

  protected override checkPegCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    if (!this._ball) return;

    const isBallA = bodyA.gameObject === this._ball;
    const isBallB = bodyB.gameObject === this._ball;

    if (!isBallA && !isBallB) return;

    const pegBody = isBallA ? bodyB : bodyA;

    if (
      (pegBody.label === 'peg' ||
        pegBody.label === 'peg_washer' ||
        pegBody.label === 'moon_rock' ||
        pegBody.label === 'moon_rock_big') &&
      pegBody.gameObject
    ) {
      this.triggerPegBloom(
        pegBody.gameObject as Phaser.Physics.Matter.Image,
        pegBody.label === 'peg_washer'
      );
    }
  }

  protected override triggerPegBloom(pegImage: Phaser.Physics.Matter.Image, isWasher = false): void {
    if (isWasher) {
      super.triggerPegBloom(pegImage, true);
      return;
    }

    this.sound.play('sfx_peg', { volume: 0.5 });

    const bloomKey = this._moonRocks.has(pegImage) ? 'moon_bloom' : 'peg_bloom';
    const bloom = this.add.sprite(pegImage.x, pegImage.y - 2, bloomKey);
    bloom.setBlendMode(Phaser.BlendModes.ADD);

    const colors = this._moonRocks.has(pegImage)
      ? [0x9fb5c9, 0x7b8a99, 0xbad0df]
      : [0xffb300, 0x00d9ff, 0xff0055, 0x00ff88, 0xbf00ff];
    const tint = colors[Math.floor(Math.random() * colors.length)];
    if (tint !== undefined) bloom.setTint(tint);

    this.tweens.add({
      targets: bloom,
      scale: this._moonRocks.has(pegImage) ? 1.8 : 1.5,
      alpha: 0,
      duration: this._moonRocks.has(pegImage) ? 420 : 300,
      ease: 'Power2',
      onComplete: () => {
        bloom.destroy();
      },
    });

    this.cameras.main.shake(120, 0.003);
  }

  private createMoonSliders(): void {
    const PEG_FIELD_X1 = 10;
    const PEG_FIELD_WIDTH = 426;
    const PEG_FIELD_Y = 317;
    const ROW_SPACING = 48;
    const rowStartY = PEG_FIELD_Y + 20;
    const sliderY = [1, 3, 5].map((row) => rowStartY + (row - 1) * ROW_SPACING + ROW_SPACING / 2);
    const sliderWidth = 90;
    const sliderHeight = 10;
    const sliderBounds = {
      minX: PEG_FIELD_X1 + sliderWidth / 2,
      maxX: PEG_FIELD_X1 + PEG_FIELD_WIDTH - sliderWidth / 2,
    };

    sliderY.forEach((y, index) => {
      const startX = sliderBounds.minX;
      const sliderBody = this.matter.add.rectangle(startX, y, sliderWidth, sliderHeight, {
        isStatic: true,
        label: 'moon_slider',
      });
      const sliderRect = this.add.rectangle(startX, y, sliderWidth, sliderHeight, 0x6a6e78);
      sliderRect.setStrokeStyle(2, 0x9fb5c9);

      this._sliderBodies.push(sliderBody);

      const tween = this.tweens.add({
        targets: sliderRect,
        x: sliderBounds.maxX,
        duration: 2400 + index * 400,
        delay: index * 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          if (this._isShuttingDown) return;
          const body = sliderBody;
          if (!body || !body.position) return;
          this.matter?.body?.setPosition(body, {
            x: Math.round(sliderRect.x),
            y: Math.round(sliderRect.y),
          });
        },
        onRepeat: () => {
          if (this._isShuttingDown) return;
          this.matter?.body?.setPosition(sliderBody, {
            x: Math.round(sliderRect.x),
            y: Math.round(sliderRect.y),
          });
        },
      });

      this._sliderTweens.push(tween);
    });
  }

  private onShutdown(): void {
    this._isShuttingDown = true;
    if (this._onCollisionStart) {
      this.matter?.world?.off('collisionstart', this._onCollisionStart);
      this._onCollisionStart = null;
    }

    for (const tween of this._sliderTweens) {
      tween.stop();
      tween.remove();
    }
    this._sliderTweens = [];
    this._sliderBodies = [];
  }

  private handleSliderCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    if (this._isShuttingDown) return;
    const sliderBody = this.getSliderBody(bodyA, bodyB);
    if (!sliderBody) return;

    const ballBody = bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : undefined;
    if (!ballBody) return;
    if (!ballBody.position) return;

    const velocity = ballBody.velocity;
    if (!velocity) return;

    const baseSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    const speed = Phaser.Math.Clamp(baseSpeed + 1.5, 4, 9);
    const angle = this._moonRng.realInRange(-0.6, 0.6);
    const dirX = Math.sin(angle);
    const dirY = -Math.cos(angle);
    const nextVx = Phaser.Math.Clamp(velocity.x + dirX * speed, -9, 9);
    const nextVy = Phaser.Math.Clamp(velocity.y + dirY * speed, -13, 6);
    this.matter?.body?.setVelocity(ballBody, { x: nextVx, y: nextVy });
  }

  private getSliderBody(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): MatterJS.BodyType | undefined {
    if (bodyA.label === 'moon_slider') return bodyA;
    if (bodyB.label === 'moon_slider') return bodyB;
    return undefined;
  }
}
