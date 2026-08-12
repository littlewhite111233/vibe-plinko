import Phaser from 'phaser';
import { CheatPanel } from '../cheat/CheatPanel';
import { resolveRound, RoundResultData } from '../cheat/CheatSettings';
import { calcPointsFromPayout } from '../meta/PointsEconomy';
import {
  addPoints,
  consumeEnergyForMiniGame,
  ENERGY_MAX,
  getProgressionState,
  loadProgression,
  recordBeadLoss,
  updateInventory,
} from '../meta/ProgressionStore';
import { applyInventoryModifiers, consumeInventory } from '../meta/RoundModifiers';
import { chargePullRatio, FEEL } from '../physics/FeelConfig';
import { MiniGameOverlay } from '../ui/MiniGameOverlay';
import { ShopPanel } from '../ui/ShopPanel';

type GameState = 'idle' | 'betting' | 'charging' | 'in_flight';

export class UIScene extends Phaser.Scene {
  private static readonly BASE_WIDTH = 480;
  private static readonly BASE_HEIGHT = 854;
  private _credits: number = 100;
  private _state: GameState = 'idle';
  private _betAmount: number = 0;
  private _chargeStartTime: number = 0;
  private _debugMultiBall: boolean = false;

  // UI Elements that update
  private _scoreText!: Phaser.GameObjects.Text;
  private _multiplierLEDs: Phaser.GameObjects.Image[] = [];
  private _statusText!: Phaser.GameObjects.Text;
  private _chargeBarFill!: Phaser.GameObjects.Rectangle;
  private _potentialWinText!: Phaser.GameObjects.Text;

  // Lever elements
  private _leverHandle!: Phaser.GameObjects.Arc;
  private _leverHighlight!: Phaser.GameObjects.Arc;
  private _leverBaseY: number = 754; // BOTTOM_Y + 20
  private _leverMaxPull: number = 70;

  private _roundData: RoundResultData | undefined;
  private _gameOverContainer?: Phaser.GameObjects.Container;
  private _activeGameSceneKey: 'GameScene' | 'MoonScene' = 'GameScene';
  private _travelLocked: boolean = false;
  private _mapSelectContainer?: Phaser.GameObjects.Container;
  private _cheatPanel?: CheatPanel;
  private _shopPanel?: ShopPanel;
  private _miniGameOverlay?: MiniGameOverlay;
  private _pointsText!: Phaser.GameObjects.Text;
  private _energyLeds: Phaser.GameObjects.Image[] = [];
  private _isMiniGameRound = false;
  private _pendingMiniGame = false;
  private _betChips: Array<{
    amount: number;
    button: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('UIScene');
  }

  create() {
    this.applyViewport();
    this.scale.on('resize', this.applyViewport, this);

    // Scaffold UI panels, buttons, LED strips, Lever
    this.createTopPanel();
    this.createBottomPanel();
    this.createOverlay();
    this.createMapSelect();

    loadProgression();

    this._shopPanel = new ShopPanel(this, {
      onBeadsPurchased: (amount) => {
        this.updateCredits(this._credits + amount);
      },
      onRefresh: () => this.refreshMetaHud(),
    });
    this._shopPanel.create();

    this._miniGameOverlay = new MiniGameOverlay(this, {
      onMashDone: (invest) => this.beginMiniGameBetting(invest),
      onSpacePress: () => this.refreshMetaHud(),
    });
    this._miniGameOverlay.create();
    this._miniGameOverlay.bindKeyboard();

    this._cheatPanel = new CheatPanel(this, {
      onApplyRound: () => this.applyCheatRound(),
      onClose: () => this.ensureUiOnTop(),
    });
    this._cheatPanel.create();

    this.onInsertBeads();

    this.input.keyboard?.on('keydown-B', () => {
      this._debugMultiBall = !this._debugMultiBall;
      this.setStatusText(this._debugMultiBall ? 'DEBUG: MULTIBALL' : 'DEBUG: OFF', '#ffb300');
    });

    this.input.keyboard?.on('keydown-F', this.onCheatCredits, this);
    this.input.keyboard?.on('keydown-M', this.onToggleMap, this);
    this.input.keyboard?.on('keydown-C', this.onToggleCheatPanel, this);
    this.input.keyboard?.on('keydown-S', this.onToggleShop, this);

    this.refreshMetaHud();
  }

  override update(_time: number, _delta: number): void {
    // Handle lever charge animation if active
    if (this._state === 'charging') {
      const ratio = chargePullRatio(this.time.now - this._chargeStartTime);
      const newY = this._leverBaseY + ratio * this._leverMaxPull;

      this._leverHandle.y = newY;
      this._leverHighlight.y = newY;

      this._chargeBarFill.scaleY = ratio;
      this.emitToGameScene('spring_charge', ratio);
      if (ratio >= 0.98) {
        this.setStatusText('MAX!', '#ff2200');
        this._chargeBarFill.fillColor = 0xff2200;
      } else {
        this.setStatusText('CHARGING...', '#ffb300');
        this._chargeBarFill.fillColor = 0xffb300;
      }
    }
  }

  private createTopPanel() {
    // 0 -> 154: Gunmetal
    this.add.rectangle(0, 0, 480, 154, 0x1a1e2a).setOrigin(0);
    // Amber accent
    this.add.rectangle(0, 151, 480, 3, 0xffb300).setOrigin(0);

    this._statusText = this.add
      .text(240, 20, 'INSERT BEADS', {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);

    // Logo badge
    this.add.rectangle(70, 60, 120, 56, 0x050b14).setOrigin(0.5);
    this.add.rectangle(70, 60, 114, 50, 0x0d1520).setOrigin(0.5); // inner inset
    this.add
      .text(70, 60, 'SUPER\nBALL', {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#b0b8c8',
        align: 'center',
      })
      .setOrigin(0.5);

    // Score / credits display (shifted to right)
    this.add.rectangle(370, 60, 150, 56, 0x000000).setOrigin(0.5);
    this._scoreText = this.add
      .text(370, 60, this._credits.toString().padStart(4, '0'), {
        fontFamily: '"Press Start 2P"',
        fontSize: '36px',
        color: '#ff2200',
      })
      .setOrigin(0.5);

    // Bet x multiplier display (same row as logo)
    this.add.rectangle(215, 60, 150, 56, 0x0d1520).setOrigin(0.5);
    this._potentialWinText = this.add
      .text(215, 60, 'BET x MULT\n0 x 0 = 0', {
        fontFamily: '"Press Start 2P"',
        fontSize: '13px',
        color: '#b0b8c8',
        align: 'center',
      })
      .setOrigin(0.5);

    this._pointsText = this.add
      .text(70, 130, 'PT 000', {
        fontFamily: '"Press Start 2P"',
        fontSize: '10px',
        color: '#ffb300',
      })
      .setOrigin(0.5);

    this._energyLeds = [];
    for (let i = 0; i < ENERGY_MAX; i++) {
      const led = this.add.image(300 + i * 16, 132, 'led_unlit');
      this._energyLeds.push(led);
    }

    // Multiplier LEDs (placeholder unlit)
    const mults = [2, 4, 6, 8, 10];
    this._multiplierLEDs = [];
    mults.forEach((m, idx) => {
      const led = this.add.image(120 + idx * 60, 126, 'led_unlit');
      this._multiplierLEDs.push(led);
      this.add
        .text(120 + idx * 60, 142, m + 'X', {
          fontFamily: '"Press Start 2P"',
          fontSize: '10px',
          color: '#b0b8c8',
        })
        .setOrigin(0.5);
    });
  }

  private createBottomPanel() {
    // 734 -> 854
    const BOTTOM_Y = 734;
    this.add.rectangle(0, BOTTOM_Y, 480, 120, 0x1a1e2a).setOrigin(0);
    this.add.rectangle(0, BOTTOM_Y, 480, 3, 0xffb300).setOrigin(0);

    // Preset bet chips (single row)
    const chipValues = [1, 5, 10, 50, 100];
    const chipStartX = 52;
    const chipY = BOTTOM_Y + 50;
    const chipSpacing = 68;
    const chipWidth = 64;
    const chipHeight = 56;

    this._betChips = [];
    chipValues.forEach((value, index) => {
      const chipX = chipStartX + index * chipSpacing;
      const chip = this.add
        .rectangle(chipX, chipY, chipWidth, chipHeight, 0x2a4a8a)
        .setInteractive({ cursor: 'pointer' });
      chip.setStrokeStyle(4, 0x1a3a6a);
      const label = this.add
        .text(chipX, chipY, `+${value}`, {
          fontFamily: '"Press Start 2P"',
          fontSize: '14px',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      chip.on('pointerdown', () => this.onBetChip(value));
      this._betChips.push({ amount: value, button: chip, label });
    });

    this.updateBetChipState();


    // Charge bar (hidden initially)
    this.add.rectangle(416, BOTTOM_Y + 56, 10, 96, 0x050b14).setOrigin(0.5);
    this._chargeBarFill = this.add
      .rectangle(416, BOTTOM_Y + 104, 10, 96, 0xffb300)
      .setOrigin(0.5, 1);
    this._chargeBarFill.scaleY = 0;

    // Lever slot background
    this.add.rectangle(458, BOTTOM_Y + 56, 12, 96, 0x050b14).setOrigin(0.5);
    // Lever shaft
    this.add.rectangle(458, BOTTOM_Y + 46, 4, 76, 0x888ea0).setOrigin(0.5);
    // Lever handle (resting at top of slot)
    this._leverHandle = this.add.circle(458, BOTTOM_Y + 16, 14, 0x3a3f50); // main handle
    this._leverHighlight = this.add.circle(458, BOTTOM_Y + 16, 6, 0x4a5060); // handle highlight

    this._leverBaseY = BOTTOM_Y + 16;
    this._leverMaxPull = 70;

    // Interactive hit zone for the lever
    const leverHitZone = this.add
      .zone(458, BOTTOM_Y + 56, 50, 120)
      .setInteractive({ cursor: 'pointer' });
    leverHitZone.on('pointerdown', this.onLeverDown, this);
    this.input.on('pointerup', this.onLeverUp, this);

    // Listen for events from GameScene
    this.bindGameSceneEvents(this._activeGameSceneKey);
  }

  private onInsertBeads(): void {
    if (this._state === 'idle') {
      if (this._credits >= 5) {
        this.updateCredits(this._credits - 5);
        this._betAmount = 5;
        this._state = 'betting';
        this.setStatusText('HOLD LEVER / RAISE?', '#ffb300');
        this.updateBetChipState();

        this._roundData = this.buildRoundWithModifiers();
        this.emitToGameScene('prepare_ball');
        this.syncRoundDisplay();
      }
    }
  }

  private buildRoundWithModifiers(): RoundResultData {
    const base = resolveRound();
    const state = getProgressionState();
    const { round, usage } = applyInventoryModifiers(base, state.inventory);
    updateInventory(consumeInventory(state.inventory, usage));
    return round;
  }

  private refreshMetaHud(): void {
    const state = getProgressionState();
    this._pointsText?.setText(`PT ${state.points.toString().padStart(3, '0')}`);
    this._energyLeds.forEach((led, i) => {
      led.setTexture(i < state.energy ? 'led_lit' : 'led_unlit');
    });
    this._shopPanel?.refresh();
  }

  private syncRoundDisplay(): void {
    if (!this._roundData) return;

    if (this._potentialWinText) {
      this._potentialWinText.setText(
        `BET x MULT\n${this._betAmount} x ${this._roundData.multiplier} = ${
          this._betAmount * this._roundData.multiplier
        }`
      );
    }

    const mults = [2, 4, 6, 8, 10];
    const ledIndex = mults.indexOf(this._roundData.multiplier);
    this._multiplierLEDs.forEach((led, i) => {
      led.setTexture(i === ledIndex ? 'led_lit' : 'led_unlit');
    });

    this.emitToGameScene('ui_update_tunnels', this._roundData.winningTunnels);
  }

  private applyCheatRound(): void {
    if (this._state !== 'betting') {
      this.setStatusText('CHEAT: START A ROUND FIRST', '#ff0055');
      return;
    }
    this._roundData = this.buildRoundWithModifiers();
    this.syncRoundDisplay();
    this.setStatusText(`CHEAT APPLIED ${this._roundData.multiplier}X`, '#ff0055');
  }

  private onToggleShop(): void {
    if (this._travelLocked) return;
    this._mapSelectContainer?.setVisible(false);
    this._cheatPanel?.hide();
    this._shopPanel?.toggle();
    this.ensureUiOnTop();
  }

  private onToggleCheatPanel(): void {
    if (this._travelLocked) return;
    this._mapSelectContainer?.setVisible(false);
    this._shopPanel?.hide();
    this._cheatPanel?.toggle();
    this.ensureUiOnTop();
  }

  private onBetChip(amount: number): void {
    if (this._miniGameOverlay?.getPhase() === 'mash') {
      this._miniGameOverlay.addInvest(amount);
      return;
    }

    if (this._state === 'betting' && !this._isMiniGameRound) {
      if (this._credits >= amount) {
        this.updateCredits(this._credits - amount);
        this._betAmount += amount;

        if (this._roundData && this._potentialWinText) {
          this._potentialWinText.setText(
            `BET x MULT\n${this._betAmount} x ${this._roundData.multiplier} = ${
              this._betAmount * this._roundData.multiplier
            }`
          );
        }
      }
    }
  }

  private onCheatCredits(): void {
    this.updateCredits(this._credits + 500);
  }

  private onToggleMap(): void {
    if (this._travelLocked) return;
    if (!this._mapSelectContainer) return;
    this.ensureUiOnTop();
    const isVisible = this._mapSelectContainer.visible;
    this._mapSelectContainer.setVisible(!isVisible);
  }

  private switchMap(nextScene: 'GameScene' | 'MoonScene'): void {
    if (this._travelLocked) return;
    if (this._activeGameSceneKey === nextScene) return;
    this._travelLocked = true;

    const prevScene = this._activeGameSceneKey;
    this._roundData = undefined;
    this._betAmount = 0;
    this.scene.stop(prevScene);
    this.scene.launch(nextScene);
    this.waitForSceneReady(nextScene, () => {
      this.setActiveGameScene(nextScene);
      this.ensureUiOnTop();
      this.resetForMapSwitch();
      this._mapSelectContainer?.setVisible(false);
      this._travelLocked = false;
    });
  }

  private setActiveGameScene(key: 'GameScene' | 'MoonScene'): void {
    if (this._activeGameSceneKey === key) return;
    this.unbindGameSceneEvents(this._activeGameSceneKey);
    this._activeGameSceneKey = key;
    this.time.delayedCall(0, () => {
      if (!this.scene.isActive(this._activeGameSceneKey)) return;
      this.bindGameSceneEvents(this._activeGameSceneKey);
      this.emitToGameScene('ui_update_credits', this._credits);
      const tunnels = this._roundData ? this._roundData.winningTunnels : [];
      this.emitToGameScene('ui_update_tunnels', tunnels);
    });
  }

  private bindGameSceneEvents(key: 'GameScene' | 'MoonScene'): void {
    const scene = this.scene.get(key);
    scene.events.on('round_complete', this.onRoundComplete, this);
    scene.events.on('failed_launch', this.onFailedLaunch, this);
    scene.events.on('map_travel_complete', this.onMapTravelComplete, this);
    scene.events.on('map_travel_begin', this.onMapTravelBegin, this);
  }

  private unbindGameSceneEvents(key: 'GameScene' | 'MoonScene'): void {
    const scene = this.scene.get(key);
    scene.events.off('round_complete', this.onRoundComplete, this);
    scene.events.off('failed_launch', this.onFailedLaunch, this);
    scene.events.off('map_travel_complete', this.onMapTravelComplete, this);
    scene.events.off('map_travel_begin', this.onMapTravelBegin, this);
  }

  private emitToGameScene(eventName: string, ...args: unknown[]): void {
    try {
      const scene = this.scene.get(this._activeGameSceneKey);
      if (!scene || !scene.events) return;
      scene.events.emit(eventName, ...args);
    } catch {
      return;
    }
  }

  private onLeverDown(): void {
    if (this._cheatPanel?.isVisible() || this._shopPanel?.isVisible()) return;
    if (this._miniGameOverlay?.isActive()) return;
    if (this._state === 'betting' && !this._travelLocked) {
      this._state = 'charging';
      this._chargeStartTime = this.time.now;
      this.setStatusText('CHARGING...', '#ffb300');
      this._chargeBarFill.fillColor = 0xffb300;
      this.updateBetChipState();
    }
  }

  private onLeverUp(): void {
    if (this._state === 'charging' && !this._travelLocked && this._roundData) {
      if (this._isMiniGameRound) {
        const stake = Math.min(this._betAmount, this._credits);
        if (stake <= 0) {
          this._state = 'betting';
          this.setStatusText('NEED BEADS TO LAUNCH', '#ff4444');
          return;
        }
        this._betAmount = stake;
        this.updateCredits(this._credits - stake);
      }

      const power = chargePullRatio(this.time.now - this._chargeStartTime);

      this._chargeBarFill.scaleY = 0;
      this.emitToGameScene('spring_charge', 0);
      this._leverHandle.y = this._leverBaseY;
      this._leverHighlight.y = this._leverBaseY;

      if (power < FEEL.launch.minPull) {
        this.setStatusText('PULL / RELEASE TIMING', '#ffb300');
        return;
      }

      this._state = 'in_flight';
      this.setStatusText('IN FLIGHT...', '#b0b8c8');
      this.updateBetChipState();

      const ballCount = this._debugMultiBall ? 10 : 1;
      this.emitToGameScene('launchBall', power, this._roundData, ballCount);
    }
  }

  private onFailedLaunch(): void {
    if (this._state === 'in_flight') {
      this._state = 'betting';
      this.setStatusText('TRY AGAIN / HOLD LEVER', '#ffb300');
    }
  }

  private onRoundComplete(data: { isWin: boolean; multiplier: number; tunnelIndex: number }): void {
    const stake = this._betAmount;

    if (this._isMiniGameRound) {
      this.finishMiniGameRound(data.isWin, stake);
      return;
    }

    const payout = stake * data.multiplier;

    this.setStatusText(
      data.isWin ? `WIN +${payout} BEADS` : 'NO WIN / TRY AGAIN',
      data.isWin ? '#ffb300' : '#b0b8c8'
    );

    if (data.isWin) {
      const slotWidth = 426 / 12;
      const tunnelX = 10 + data.tunnelIndex * slotWidth + slotWidth / 2;
      const tunnelY = 648 + 43;
      const bead = this.add.image(tunnelX, tunnelY, 'ball');
      bead.setTint(0xffb300);
      bead.setBlendMode(Phaser.BlendModes.ADD);

      this.tweens.add({
        targets: bead,
        x: 330,
        y: 60,
        duration: 800,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          bead.destroy();
          this.sound.play('sfx_win');
          this.updateCredits(this._credits + payout);
          const pts = calcPointsFromPayout(payout);
          if (pts > 0) {
            addPoints(pts);
            this.showFloatText(`+${pts} PT`, 240, 90, '#ffb300');
          }
          this.refreshMetaHud();
          this.showFloatText(`+${payout} BEADS`, 330, 60, '#FFB300');
          this.playBeadWinFX();
          this.resetRoundState();
        },
      });
    } else {
      this.sound.play('sfx_lose');
      this.showFloatText('+0 BEADS', 330, 60, '#888ea0');
      const { triggerMiniGame } = recordBeadLoss(stake);
      this.refreshMetaHud();
      if (triggerMiniGame) {
        this._pendingMiniGame = true;
      }
      this.time.delayedCall(600, () => this.resetRoundState());
    }
  }

  private finishMiniGameRound(isWin: boolean, stake: number): void {
    this._isMiniGameRound = false;

    if (isWin) {
      this.setStatusText(`MINI WIN +${stake}`, '#ffb300');
      this.sound.play('sfx_win');
      this.updateCredits(this._credits + stake);
      this.showFloatText(`+${stake} BEADS`, 330, 60, '#FFB300');
      this.playBeadWinFX();
    } else {
      this.setStatusText('MINI LOST', '#b0b8c8');
      this.sound.play('sfx_lose');
      recordBeadLoss(stake);
      this.refreshMetaHud();
    }

    this.time.delayedCall(600, () => this.resetRoundState());
  }

  private beginMiniGameBetting(invest: number): void {
    this._isMiniGameRound = true;
    this._betAmount = invest;
    this._state = 'betting';
    this._roundData = this.buildRoundWithModifiers();
    this.emitToGameScene('prepare_ball');
    this.syncRoundDisplay();

    if (invest <= 0) {
      this.setStatusText('INVEST BEADS / HOLD LEVER', '#ffb300');
    } else {
      this.setStatusText(`STAKE ${invest} / HOLD LEVER`, '#ffb300');
    }
    this.updateBetChipState();
  }

  private tryStartMiniGame(): void {
    if (!this._pendingMiniGame) return;
    this._pendingMiniGame = false;
    if (!consumeEnergyForMiniGame()) return;
    this.refreshMetaHud();
    this._state = 'idle';
    this._miniGameOverlay?.start();
  }

  private resetRoundState(autoInsert: boolean = true): void {
    // Reset multiplier LEDs first
    this._multiplierLEDs.forEach((led) => led.setTexture('led_unlit'));

    // Reset state
    this._state = 'idle';
    this._betAmount = 0;
    this._roundData = undefined;
    this.updateBetChipState();
    this.emitToGameScene('ui_update_tunnels', []);

    if (this._potentialWinText) {
      this._potentialWinText.setText('BET x MULT\n0 x 0 = 0');
      this._potentialWinText.setColor('#b0b8c8');
    }

    this._chargeBarFill.scaleY = 0;
    this._leverHandle.y = this._leverBaseY;
    this._leverHighlight.y = this._leverBaseY;

    if (this._credits < 5) {
      this.showGameOver();
    } else if (autoInsert && !this._pendingMiniGame) {
      this.onInsertBeads();
    } else if (autoInsert) {
      this.tryStartMiniGame();
    }
  }

  private resetForMapSwitch(): void {
    this._travelLocked = false;
    this._state = 'idle';
    this._betAmount = 0;
    this._roundData = undefined;
    this.setStatusText('INSERT BEADS', '#b0b8c8');
    this.updateBetChipState();
    this.resetRoundState(false);
    this.time.delayedCall(50, () => {
      if (this._credits >= 5) {
        this.onInsertBeads();
        if (this._roundData) {
          this.emitToGameScene('ui_update_tunnels', this._roundData.winningTunnels);
        }
      }
    });
  }

  private updateBetChipState(): void {
    const inMash = this._miniGameOverlay?.getPhase() === 'mash';
    const canBet = (this._state === 'betting' && !this._travelLocked) || inMash;
    this._betChips.forEach((chip) => {
      const enabled = canBet && (inMash || this._credits >= chip.amount);
      if (enabled) {
        chip.button.setInteractive({ cursor: 'pointer' });
        chip.button.setAlpha(1);
        chip.label.setAlpha(1);
      } else {
        chip.button.disableInteractive();
        chip.button.setAlpha(0.4);
        chip.label.setAlpha(0.4);
      }
    });
  }

  private onMapTravelBegin(): void {
    this._travelLocked = true;
    this._state = 'idle';
    this.setStatusText('TRAVELING...', '#ffb300');
    this.updateBetChipState();
  }

  private onMapTravelComplete(): void {
    this._travelLocked = false;
    if (this._activeGameSceneKey !== 'MoonScene') {
      this._roundData = undefined;
      this._betAmount = 0;
      this.scene.stop('GameScene');
      this.scene.launch('MoonScene');
      this.waitForSceneReady('MoonScene', () => {
        this.setActiveGameScene('MoonScene');
        this.ensureUiOnTop();
        this.resetForMapSwitch();
      });
    }
  }

  private ensureUiOnTop(): void {
    this.scene.bringToTop('UIScene');
  }

  private waitForSceneReady(
    sceneKey: 'GameScene' | 'MoonScene',
    callback: () => void
  ): void {
    const scene = this.scene.get(sceneKey);
    if (scene.sys?.isActive()) {
      callback();
      return;
    }
    scene.events.once(Phaser.Scenes.Events.CREATE, () => {
      callback();
    });
  }

  private playBeadWinFX(): void {
    // Scale up score text
    this.tweens.add({
      targets: this._scoreText,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 150,
      yoyo: true,
      ease: 'Power2',
    });

    // Add a little bloom/flash behind the score text
    const flash = this.add.circle(330, 60, 30, 0xffb300, 0.8);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });
  }

  private showFloatText(msg: string, x: number, y: number, color: string) {
    const txt = this.add
      .text(x, y, msg, {
        fontFamily: '"Press Start 2P"',
        fontSize: '24px',
        color: color,
      })
      .setOrigin(0.5);
    txt.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  private setStatusText(msg: string, color: string) {
    if (this._statusText) {
      this._statusText.setText(msg);
      this._statusText.setColor(color);
    }
  }

  private createOverlay() {
    this._gameOverContainer = this.add.container(0, 0);
    this._gameOverContainer.setVisible(false);

    // Semi-transparent background
    const bg = this.add.rectangle(0, 0, 480, 854, 0x000000, 0.8).setOrigin(0);
    this._gameOverContainer.add(bg);

    // Panel
    const panel = this.add.rectangle(240, 427, 300, 160, 0x1a1e2a).setOrigin(0.5);
    panel.setStrokeStyle(4, 0xffb300);
    this._gameOverContainer.add(panel);

    // Game Over text
    const goText = this.add
      .text(240, 390, 'GAME OVER', {
        fontFamily: '"Press Start 2P"',
        fontSize: '24px',
        color: '#ff2200',
      })
      .setOrigin(0.5);
    this._gameOverContainer.add(goText);

    // Play Again button
    const btn = this.add
      .rectangle(240, 460, 200, 50, 0x3a3f50)
      .setInteractive({ cursor: 'pointer' });
    btn.setStrokeStyle(2, 0xffb300);
    const btnText = this.add
      .text(240, 460, 'PLAY AGAIN', {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#888ea0',
      })
      .setOrigin(0.5);

    this._gameOverContainer.add([btn, btnText]);

    btn.on('pointerdown', () => {
      this._gameOverContainer?.setVisible(false);
      this.updateCredits(100);
      this._state = 'idle';
      this.setStatusText('INSERT BEADS', '#b0b8c8');
      this.onInsertBeads();
    });
  }

  private createMapSelect(): void {
    this._mapSelectContainer = this.add.container(0, 0);
    this._mapSelectContainer.setVisible(false);

    const bg = this.add.rectangle(0, 0, 480, 854, 0x000000, 0.6).setOrigin(0);
    this._mapSelectContainer.add(bg);

    const panel = this.add.rectangle(240, 300, 320, 200, 0x1a1e2a).setOrigin(0.5);
    panel.setStrokeStyle(4, 0xffb300);
    this._mapSelectContainer.add(panel);

    const title = this.add
      .text(240, 235, 'SELECT MAP', {
        fontFamily: '"Press Start 2P"',
        fontSize: '16px',
        color: '#ffb300',
      })
      .setOrigin(0.5);

    const earthBtn = this.add.rectangle(240, 295, 220, 40, 0x3a3f50).setOrigin(0.5);
    earthBtn.setStrokeStyle(2, 0xffb300);
    earthBtn.setInteractive({ cursor: 'pointer' });
    const earthText = this.add
      .text(240, 295, 'EARTH', {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);

    const moonBtn = this.add.rectangle(240, 345, 220, 40, 0x3a3f50).setOrigin(0.5);
    moonBtn.setStrokeStyle(2, 0xffb300);
    moonBtn.setInteractive({ cursor: 'pointer' });
    const moonText = this.add
      .text(240, 345, 'MOON', {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);

    earthBtn.on('pointerdown', () => this.switchMap('GameScene'));
    moonBtn.on('pointerdown', () => this.switchMap('MoonScene'));

    this._mapSelectContainer.add([title, earthBtn, earthText, moonBtn, moonText]);
  }

  private applyViewport(): void {
    const { width, height } = this.scale;
    const zoom = Math.min(width / UIScene.BASE_WIDTH, height / UIScene.BASE_HEIGHT);
    const roundedZoom = Math.max(0.5, Math.floor(zoom * 100) / 100);
    this.cameras.main.setZoom(roundedZoom);
    this.cameras.main.centerOn(UIScene.BASE_WIDTH / 2, UIScene.BASE_HEIGHT / 2);
  }

  private showGameOver() {
    this._gameOverContainer?.setVisible(true);
  }

  public updateCredits(val: number): void {
    this._credits = val;
    if (this._credits < 0) this._credits = 0;
    // Update score text
    if (this._scoreText) {
      this._scoreText.setText(this._credits.toString().padStart(4, '0'));
    }
    this.updateBetChipState();
    this.emitToGameScene('ui_update_credits', this._credits);
  }
}
