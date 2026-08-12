import Phaser from 'phaser';

export type MiniGamePhase = 'idle' | 'countdown' | 'mash' | 'betting';

type MiniGameCallbacks = {
  onMashDone: (investAmount: number) => void;
  onSpacePress: () => void;
};

export class MiniGameOverlay {
  private _container?: Phaser.GameObjects.Container;
  private _titleText?: Phaser.GameObjects.Text;
  private _subText?: Phaser.GameObjects.Text;
  private _phase: MiniGamePhase = 'idle';
  private _invest = 0;
  private _countdownTimer: Phaser.Time.TimerEvent | undefined;
  private _mashTimer: Phaser.Time.TimerEvent | undefined;
  private _lastSpaceAt = 0;

  constructor(
    private readonly _scene: Phaser.Scene,
    private readonly _callbacks: MiniGameCallbacks
  ) {}

  create(): void {
    const container = this._scene.add.container(0, 0);
    container.setVisible(false);
    container.setDepth(1950);

    const bg = this._scene.add.rectangle(0, 0, 480, 854, 0x000000, 0.75).setOrigin(0);
    container.add(bg);

    this._titleText = this._scene.add
      .text(240, 280, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '24px',
        color: '#ff0055',
      })
      .setOrigin(0.5);
    container.add(this._titleText);

    this._subText = this._scene.add
      .text(240, 330, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '10px',
        color: '#b0b8c8',
        align: 'center',
      })
      .setOrigin(0.5);
    container.add(this._subText);

    this._container = container;
  }

  bindKeyboard(): void {
    this._scene.input.keyboard?.on('keydown-SPACE', this.onSpace, this);
  }

  unbindKeyboard(): void {
    this._scene.input.keyboard?.off('keydown-SPACE', this.onSpace, this);
  }

  start(): void {
    if (!this._container) return;
    this._container.setVisible(true);
    this._invest = 0;
    this._phase = 'countdown';
    this.updateTexts('MINI GAME', '3...');
    this.clearTimers();

    let count = 3;
    this._countdownTimer = this._scene.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        count -= 1;
        if (count > 0) {
          this.updateTexts('MINI GAME', `${count}...`);
        } else {
          this.updateTexts('GO!', 'SPACE / CHIPS TO INVEST');
          this.beginMashPhase();
        }
      },
    });
  }

  private beginMashPhase(): void {
    this._phase = 'mash';
    let remaining = 10;
    this.updateMashText(remaining);

    this._mashTimer = this._scene.time.addEvent({
      delay: 1000,
      repeat: 9,
      callback: () => {
        remaining -= 1;
        if (remaining > 0) {
          this.updateMashText(remaining);
        } else {
          this.finishMash();
        }
      },
    });
  }

  private finishMash(): void {
    this._phase = 'betting';
    this._container?.setVisible(false);
    this.clearTimers();
    this._callbacks.onMashDone(this._invest);
  }

  private onSpace(): void {
    if (this._phase !== 'mash') return;
    const now = this._scene.time.now;
    if (now - this._lastSpaceAt < 80) return;
    this._lastSpaceAt = now;
    this._invest += 1;
    this._callbacks.onSpacePress();
    this.updateMashText(this.getRemainingSeconds());
  }

  addInvest(amount: number): void {
    if (this._phase !== 'mash' || amount <= 0) return;
    this._invest += amount;
    this.updateMashText(this.getRemainingSeconds());
  }

  getInvest(): number {
    return this._invest;
  }

  getPhase(): MiniGamePhase {
    return this._phase;
  }

  isActive(): boolean {
    return this._phase !== 'idle';
  }

  hide(): void {
    this._container?.setVisible(false);
    this._phase = 'idle';
    this._invest = 0;
    this.clearTimers();
  }

  private getRemainingSeconds(): number {
    if (!this._mashTimer) return 0;
    return Math.max(0, Math.ceil(this._mashTimer.getRemaining() / 1000));
  }

  private updateMashText(remaining: number): void {
    this.updateTexts(`INVEST: ${this._invest}`, `${remaining}s LEFT\nSPACE / CHIPS`);
  }

  private updateTexts(title: string, sub: string): void {
    this._titleText?.setText(title);
    this._subText?.setText(sub);
  }

  private clearTimers(): void {
    if (this._countdownTimer) {
      this._countdownTimer.remove();
      this._countdownTimer = undefined;
    }
    if (this._mashTimer) {
      this._mashTimer.remove();
      this._mashTimer = undefined;
    }
  }
}
