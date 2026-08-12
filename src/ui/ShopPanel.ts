import Phaser from 'phaser';
import {
  addInventoryItem,
  getProgressionState,
  spendPoints,
} from '../meta/ProgressionStore';

type ShopCallbacks = {
  onBeadsPurchased: (amount: number) => void;
  onRefresh: () => void;
};

export class ShopPanel {
  private _container?: Phaser.GameObjects.Container;
  private _confirmContainer?: Phaser.GameObjects.Container;
  private _confirmText?: Phaser.GameObjects.Text;
  private _inventoryLabel?: Phaser.GameObjects.Text;
  private _pointsLabel?: Phaser.GameObjects.Text;
  private _pendingConfirm: (() => void) | undefined;

  constructor(
    private readonly _scene: Phaser.Scene,
    private readonly _callbacks: ShopCallbacks
  ) {}

  create(): void {
    const container = this._scene.add.container(0, 0);
    container.setVisible(false);
    container.setDepth(1900);

    const bg = this._scene.add.rectangle(0, 0, 480, 854, 0x000000, 0.85).setOrigin(0);
    bg.setInteractive();
    container.add(bg);

    const panel = this._scene.add.rectangle(240, 380, 400, 480, 0x1a1e2a).setOrigin(0.5);
    panel.setStrokeStyle(3, 0xffb300);
    container.add(panel);

    container.add(
      this._scene.add
        .text(240, 170, 'SHOP', {
          fontFamily: '"Press Start 2P"',
          fontSize: '16px',
          color: '#ffb300',
        })
        .setOrigin(0.5)
    );

    this._pointsLabel = this._scene.add
      .text(240, 200, 'PT: 0', {
        fontFamily: '"Press Start 2P"',
        fontSize: '10px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);
    container.add(this._pointsLabel);

    this._inventoryLabel = this._scene.add
      .text(240, 220, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#888ea0',
      })
      .setOrigin(0.5);
    container.add(this._inventoryLabel);

    const items: Array<{ y: number; label: string; confirm: string; onBuy: () => void }> = [
      {
        y: 270,
        label: '+1 LIGHT (20 PT)',
        confirm: 'BUY +1 LIGHT\nFOR 20 PT?',
        onBuy: () => {
          if (!spendPoints(20)) return;
          addInventoryItem('extraLight');
          this.afterBuy();
        },
      },
      {
        y: 320,
        label: 'MULT x2 (30 PT)',
        confirm: 'BUY MULT x2\nFOR 30 PT?',
        onBuy: () => {
          if (!spendPoints(30)) return;
          addInventoryItem('doubleMult');
          this.afterBuy();
        },
      },
    ];

    for (const item of items) {
      const btn = this.makeButton(240, item.y, 280, 36, item.label, () => {
        this.askConfirm(item.confirm, item.onBuy);
      });
      container.add([btn.bg, btn.label]);
    }

    const beadTitle = this._scene.add
      .text(240, 365, 'BEADS 1 PT = 1 BEAD', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);
    container.add(beadTitle);

    for (const [idx, amount] of [1, 5, 10].entries()) {
      const x = 120 + idx * 120;
      const btn = this.makeButton(x, 400, 90, 28, `+${amount}`, () => {
        this.askConfirm(`BUY +${amount} BEADS\nFOR ${amount} PT?`, () => {
          if (!spendPoints(amount)) return;
          this._callbacks.onBeadsPurchased(amount);
          this.afterBuy();
        });
      });
      container.add([btn.bg, btn.label]);
    }

    const closeBtn = this.makeButton(240, 460, 140, 32, 'CLOSE', () => this.hide());
    container.add([closeBtn.bg, closeBtn.label]);

    this.createConfirmDialog(container);

    this._container = container;
    this.refresh();
  }

  private createConfirmDialog(parent: Phaser.GameObjects.Container): void {
    const confirm = this._scene.add.container(0, 0);
    confirm.setVisible(false);

    const overlay = this._scene.add.rectangle(0, 0, 480, 854, 0x000000, 0.55).setOrigin(0);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.hideConfirm());
    confirm.add(overlay);

    const panel = this._scene.add.rectangle(240, 400, 320, 160, 0x1a1e2a).setOrigin(0.5);
    panel.setStrokeStyle(3, 0xffb300);
    confirm.add(panel);

    this._confirmText = this._scene.add
      .text(240, 365, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '10px',
        color: '#b0b8c8',
        align: 'center',
      })
      .setOrigin(0.5);
    confirm.add(this._confirmText);

    const yesBtn = this.makeButton(180, 430, 110, 32, 'YES', () => this.runConfirm());
    const noBtn = this.makeButton(300, 430, 110, 32, 'NO', () => this.hideConfirm());
    confirm.add([yesBtn.bg, yesBtn.label, noBtn.bg, noBtn.label]);

    parent.add(confirm);
    this._confirmContainer = confirm;
  }

  private askConfirm(message: string, onConfirm: () => void): void {
    this._confirmText?.setText(message);
    this._pendingConfirm = onConfirm;
    this._confirmContainer?.setVisible(true);
  }

  private hideConfirm(): void {
    this._confirmContainer?.setVisible(false);
    this._pendingConfirm = undefined;
  }

  private runConfirm(): void {
    const action = this._pendingConfirm;
    this.hideConfirm();
    action?.();
  }

  private afterBuy(): void {
    this.refresh();
    this._callbacks.onRefresh();
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void
  ): { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const bg = this._scene.add.rectangle(x, y, w, h, 0x3a3f50).setOrigin(0.5);
    bg.setStrokeStyle(1, 0x888ea0);
    bg.setInteractive({ cursor: 'pointer' });
    const label = this._scene.add
      .text(x, y, text, {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);
    bg.on('pointerdown', onClick);
    return { bg, label };
  }

  toggle(): void {
    if (!this._container) return;
    this._container.setVisible(!this._container.visible);
    if (this._container.visible) this.refresh();
  }

  hide(): void {
    this.hideConfirm();
    this._container?.setVisible(false);
  }

  isVisible(): boolean {
    return this._container?.visible ?? false;
  }

  refresh(): void {
    const state = getProgressionState();
    this._pointsLabel?.setText(`PT: ${state.points}`);
    this._inventoryLabel?.setText(
      `LIGHT x${state.inventory.extraLight}  MULT x${state.inventory.doubleMult}`
    );
  }
}
